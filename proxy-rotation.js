// Proxy Rotation System
// Manages proxy pool with failure tracking and automatic rotation

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const R = require('./lib/runtime');

const PROXY_FILE = path.join(__dirname, 'storage', 'proxies.txt');
const PROXY_STATS_FILE = R.seededDataPath('storage', 'proxy-stats.json');

class ProxyRotation {
    constructor(options = {}) {
        this.poolSize = options.poolSize || 100;
        this.maxFailures = options.maxFailures || 3;
        this.rotationInterval = options.rotationInterval || 300000; // 5 minutes
        this.proxies = [];
        this.currentProxyIndex = 0;
        this.stats = {};
        
        this.loadProxies();
        this.loadStats();
        this.startRotation();
    }

    loadProxies() {
        try {
            if (fs.existsSync(PROXY_FILE)) {
                const content = fs.readFileSync(PROXY_FILE, 'utf8');
                this.proxies = content.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'))
                    .map(line => this.parseProxy(line));
                console.log(`[PROXY] Loaded ${this.proxies.length} proxies`);
            } else {
                console.log('[PROXY] No proxy file found, using direct connection');
                this.proxies = [null]; // null = direct connection
            }
        } catch (error) {
            console.error('[PROXY] Error loading proxies:', error.message);
            this.proxies = [null];
        }
    }

    parseProxy(line) {
        // Format: ip:port or ip:port:user:pass
        const parts = line.split(':');
        if (parts.length >= 2) {
            return {
                host: parts[0],
                port: parts[1],
                username: parts[2] || null,
                password: parts[3] || null,
                url: parts.length >= 4 
                    ? `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`
                    : `http://${parts[0]}:${parts[1]}`
            };
        }
        return null;
    }

    loadStats() {
        try {
            if (fs.existsSync(PROXY_STATS_FILE)) {
                this.stats = JSON.parse(fs.readFileSync(PROXY_STATS_FILE, 'utf8'));
            }
        } catch (error) {
            console.error('[PROXY] Error loading stats:', error.message);
            this.stats = {};
        }
    }

    saveStats() {
        try {
            fs.writeFileSync(PROXY_STATS_FILE, JSON.stringify(this.stats, null, 2));
        } catch (error) {
            console.error('[PROXY] Error saving stats:', error.message);
        }
    }

    getNextProxy() {
        if (this.proxies.length === 0 || this.proxies[0] === null) {
            return null; // Direct connection
        }

        // Find a working proxy
        let attempts = 0;
        const maxAttempts = this.proxies.length;

        while (attempts < maxAttempts) {
            const proxy = this.proxies[this.currentProxyIndex];
            const proxyKey = proxy ? `${proxy.host}:${proxy.port}` : 'direct';

            // Check if proxy has too many failures
            if (this.stats[proxyKey] && this.stats[proxyKey].failures >= this.maxFailures) {
                this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
                attempts++;
                continue;
            }

            this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
            return proxy;
        }

        // All proxies failed, return null (direct connection)
        return null;
    }

    recordSuccess(proxy) {
        const proxyKey = proxy ? `${proxy.host}:${proxy.port}` : 'direct';
        if (!this.stats[proxyKey]) {
            this.stats[proxyKey] = { successes: 0, failures: 0, lastUsed: Date.now() };
        }
        this.stats[proxyKey].successes++;
        this.stats[proxyKey].lastUsed = Date.now();
        this.stats[proxyKey].failures = 0; // Reset failures on success
        this.saveStats();
    }

    recordFailure(proxy) {
        const proxyKey = proxy ? `${proxy.host}:${proxy.port}` : 'direct';
        if (!this.stats[proxyKey]) {
            this.stats[proxyKey] = { successes: 0, failures: 0, lastUsed: Date.now() };
        }
        this.stats[proxyKey].failures++;
        this.stats[proxyKey].lastUsed = Date.now();
        this.saveStats();
        
        console.log(`[PROXY] Failure recorded for ${proxyKey}: ${this.stats[proxyKey].failures}/${this.maxFailures}`);
    }

    startRotation() {
        setInterval(() => {
            this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
            console.log('[PROXY] Rotating proxy');
        }, this.rotationInterval);
    }

    getStats() {
        return this.stats;
    }

    getProxyUrl(proxy) {
        if (!proxy) return null;
        return proxy.url;
    }

    async validateProxy(proxy) {
        if (!proxy) return false;

        try {
            const start = Date.now();
            const response = await axios.get('https://www.roblox.com', {
                proxy: {
                    host: proxy.host,
                    port: parseInt(proxy.port),
                    auth: proxy.username && proxy.password ? {
                        username: proxy.username,
                        password: proxy.password
                    } : undefined
                },
                timeout: 5000,
                validateStatus: () => true
            });
            const latency = Date.now() - start;

            // Check if proxy is working
            if (response.status === 200 || response.status === 302) {
                const proxyKey = `${proxy.host}:${proxy.port}`;
                if (!this.stats[proxyKey]) {
                    this.stats[proxyKey] = { successes: 0, failures: 0, lastUsed: Date.now(), latency: 0 };
                }
                this.stats[proxyKey].latency = latency;
                this.stats[proxyKey].lastChecked = Date.now();
                this.saveStats();
                return true;
            }

            return false;
        } catch (error) {
            console.error(`[PROXY] Validation failed for ${proxy.host}:${proxy.port}:`, error.message);
            return false;
        }
    }

    async validateAllProxies() {
        console.log('[PROXY] Validating all proxies...');
        const results = [];

        for (const proxy of this.proxies) {
            if (!proxy) continue;
            const isValid = await this.validateProxy(proxy);
            results.push({
                proxy: `${proxy.host}:${proxy.port}`,
                valid: isValid
            });
        }

        console.log(`[PROXY] Validation complete: ${results.filter(r => r.valid).length}/${results.length} valid`);
        return results;
    }

    getHealthyProxies() {
        const healthy = [];
        for (const proxy of this.proxies) {
            if (!proxy) continue;
            const proxyKey = `${proxy.host}:${proxy.port}`;
            const stats = this.stats[proxyKey];
            
            if (!stats || stats.failures < this.maxFailures) {
                healthy.push(proxy);
            }
        }
        return healthy;
    }

    getProxyStats(proxyKey) {
        return this.stats[proxyKey] || null;
    }
}

module.exports = ProxyRotation;
