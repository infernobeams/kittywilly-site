// c:\Users\acedi\OneDrive\Desktop\New folder\captcha-solver.js
// JavaScript / captcha-solver.js / Node.js 18+ / x64 / Windows-Linux / Roblox Arkose Solver

const axios = require('axios');

class CaptchaSolver {
    constructor(apiKey = null) {
        this.apiKey = apiKey || process.env.CAPTCHA_API_KEY || null;
        this.arkosePublicKey = '476068BF-9607-4799-B53D-966BE98E2B81';
        this.pageUrl = 'https://www.roblox.com/login';
        this.inUrl = 'https://2captcha.com/in.php';
        this.resUrl = 'https://2captcha.com/res.php';
        this.pollIntervalMs = 5000;
        this.maxPollAttempts = 24; // 120 seconds timeout
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    hasApiKey() {
        return typeof this.apiKey === 'string' && this.apiKey.trim().length > 0;
    }

    async solveFunCaptcha(blob = null, customPublicKey = null) {
        if (!this.hasApiKey()) {
            return {
                success: false,
                error: 'CAPTCHA_API_KEY is not configured in .env'
            };
        }

        const publicKey = customPublicKey || this.arkosePublicKey;

        try {
            const params = {
                key: this.apiKey.trim(),
                method: 'funcaptcha',
                publickey: publicKey,
                pageurl: this.pageUrl,
                json: 1
            };

            if (blob) {
                params['data[blob]'] = blob;
            }

            const inResponse = await axios.post(this.inUrl, null, {
                params,
                timeout: 15000
            });

            if (!inResponse.data || inResponse.data.status !== 1) {
                const errMsg = inResponse.data?.request || 'Failed to submit captcha task';
                return {
                    success: false,
                    error: `2Captcha task submission failed: ${errMsg}`
                };
            }

            const taskId = inResponse.data.request;

            // Poll for solution
            for (let attempt = 0; attempt < this.maxPollAttempts; attempt++) {
                await new Promise(resolve => setTimeout(resolve, this.pollIntervalMs));

                const resResponse = await axios.get(this.resUrl, {
                    params: {
                        key: this.apiKey.trim(),
                        action: 'get',
                        id: taskId,
                        json: 1
                    },
                    timeout: 10000
                });

                const resData = resResponse.data;
                if (!resData) continue;

                if (resData.status === 1 && resData.request) {
                    return {
                        success: true,
                        token: resData.request,
                        taskId
                    };
                }

                if (resData.request !== 'CAPCHA_NOT_READY') {
                    return {
                        success: false,
                        error: `2Captcha error: ${resData.request}`
                    };
                }
            }

            return {
                success: false,
                error: 'Captcha solve timed out after 120 seconds'
            };
        } catch (error) {
            return {
                success: false,
                error: `Captcha solver exception: ${error.message}`
            };
        }
    }
}

module.exports = CaptchaSolver;
