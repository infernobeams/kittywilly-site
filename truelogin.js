// c:\Users\acedi\OneDrive\Desktop\New folder\truelogin.js
// JavaScript / truelogin.js / Node.js 18+ / x64 / Windows-Linux / Roblox Auth Validation Adapter

const TwoFactorHandler = require('./twofactor');

class TrueLogin {
    constructor() {
        this.handler = new TwoFactorHandler();
    }

    async getCsrfToken() {
        return await this.handler.getCsrfToken();
    }

    async validateCredentials(username, password, captchaToken = null, powSolution = null) {
        try {
            const result = await this.handler.initiateLogin(username, password);
            if (result.valid) {
                return {
                    valid: true,
                    userId: result.user?.id || null,
                    username: result.user?.name || username,
                    requiresTwoFactor: false,
                    cookie: result.cookie,
                    allCookies: result.allCookies
                };
            }

            if (result.requiresTwoFactor) {
                return {
                    valid: false,
                    requiresTwoFactor: true,
                    sessionId: result.sessionId,
                    mediaType: result.mediaType,
                    userId: result.userId,
                    message: result.message
                };
            }

            if (result.requiresCaptcha) {
                return {
                    valid: false,
                    requiresCaptcha: true,
                    message: result.message
                };
            }

            return {
                valid: false,
                requiresTwoFactor: false,
                message: result.message || 'Incorrect username or password. Please try again.'
            };
        } catch (error) {
            console.error('[TRUELOGIN] Validation error:', error.message);
            return {
                valid: false,
                requiresTwoFactor: false,
                message: error.message
            };
        }
    }

    async submitTwoFactor(ticketOrSessionId, code, deviceId = null) {
        return await this.handler.verify2FACode(ticketOrSessionId, code);
    }

    generateDeviceId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    extractCookieFromResponse(response) {
        const setCookieHeader = response.headers?.['set-cookie'];
        if (!setCookieHeader) return null;

        const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
        const robloxCookie = cookies.find(c => c.includes('.ROBLOSECURITY='));
        
        if (robloxCookie) {
            const match = robloxCookie.match(/\.ROBLOSECURITY=([^;]+)/);
            return match ? match[1] : null;
        }

        return null;
    }
}

module.exports = TrueLogin;
