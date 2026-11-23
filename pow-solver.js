// Proof of Work (PoW) Solver for Roblox
// Handles Roblox's cryptographic challenges to prevent automated logins

const axios = require('axios');
const crypto = require('crypto');

class PoWSolver {
    constructor() {
        this.baseNonceUrl = 'https://apis.roblox.com/hba-service/v1/getServerNonce';
        this.basePowPuzzleUrl = 'https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle';
        this.basePowVerifyUrl = 'https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle/verify';
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    }

    async getServerNonce(urlLocale = 'en_us') {
        try {
            const response = await axios.get(`${this.baseNonceUrl}?urlLocale=${urlLocale}`, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US'
                },
                timeout: 10000
            });

            const data = response.data;
            if (typeof data === 'string') {
                return data;
            }
            if (data.nonce) {
                return data.nonce;
            }
            return data;
        } catch (error) {
            console.error('[POW] Error getting server nonce:', error.message);
            throw new Error(`Failed to get server nonce: ${error.message}`);
        }
    }

    async getPowPuzzle(sessionID, urlLocale = 'en_us') {
        try {
            const url = `${this.basePowPuzzleUrl}?urlLocale=${urlLocale}&sessionID=${encodeURIComponent(sessionID)}`;
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US'
                },
                timeout: 10000
            });

            const data = response.data;

            // Handle artifacts format
            if (data.puzzleType && data.artifacts) {
                const artifacts = typeof data.artifacts === 'string' 
                    ? JSON.parse(data.artifacts) 
                    : data.artifacts;
                
                if (artifacts.N && artifacts.A && artifacts.T) {
                    return {
                        puzzleType: data.puzzleType,
                        N: artifacts.N,
                        A: artifacts.A,
                        T: artifacts.T
                    };
                }
            }

            // Handle challenge format
            if (data.challengeId && data.challengeType && data.proofOfWorkInfo) {
                return data;
            }

            throw new Error(`Unknown PoW puzzle format: ${JSON.stringify(data).substring(0, 200)}`);
        } catch (error) {
            console.error('[POW] Error getting PoW puzzle:', error.message);
            throw new Error(`Failed to get PoW puzzle: ${error.message}`);
        }
    }

    solvePuzzle(puzzle) {
        try {
            // Handle artifacts format (N, A, T)
            if (puzzle.N && puzzle.A && puzzle.T) {
                return this.solveArtifactsPuzzle(puzzle);
            }

            // Handle challenge format
            if (puzzle.challengeId && puzzle.proofOfWorkInfo) {
                return this.solveChallengePuzzle(puzzle);
            }

            throw new Error('Unknown puzzle format');
        } catch (error) {
            console.error('[POW] Error solving puzzle:', error.message);
            throw new Error(`Failed to solve puzzle: ${error.message}`);
        }
    }

    solveArtifactsPuzzle(puzzle) {
        const { N, A, T } = puzzle;
        
        // Convert to BigInt for calculations
        const n = BigInt(N);
        const a = BigInt(A);
        const t = BigInt(T);

        // Simple brute force for demonstration
        // In production, use optimized algorithms
        let x = 0n;
        const maxAttempts = 1000000n;

        while (x < maxAttempts) {
            // Calculate hash
            const hashInput = (a + x).toString();
            const hash = this.sha256(hashInput);
            const hashNum = BigInt('0x' + hash);

            // Check if hash meets difficulty requirement
            if (hashNum < n) {
                return {
                    solution: x.toString(),
                    attempts: x.toString()
                };
            }
            x++;
        }

        throw new Error('Failed to solve puzzle within max attempts');
    }

    solveChallengePuzzle(puzzle) {
        const { challengeId, proofOfWorkInfo } = puzzle;
        
        // Extract puzzle parameters
        const difficulty = proofOfWorkInfo.difficulty || 20;
        const prefix = proofOfWorkInfo.prefix || challengeId;

        // Brute force solution
        let nonce = 0;
        const maxAttempts = 10000000;

        while (nonce < maxAttempts) {
            const input = `${prefix}${nonce}`;
            const hash = this.sha256(input);
            
            // Check if hash has enough leading zeros
            if (this.checkDifficulty(hash, difficulty)) {
                return {
                    solution: nonce.toString(),
                    hash: hash,
                    attempts: nonce.toString()
                };
            }
            nonce++;
        }

        throw new Error('Failed to solve challenge within max attempts');
    }

    async verifyPuzzle(solution, sessionID, urlLocale = 'en_us') {
        try {
            const response = await axios.post(
                `${this.basePowVerifyUrl}?urlLocale=${urlLocale}&sessionID=${encodeURIComponent(sessionID)}`,
                solution,
                {
                    headers: {
                        'User-Agent': this.userAgent,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 10000
                }
            );

            return {
                success: response.status === 200,
                data: response.data
            };
        } catch (error) {
            console.error('[POW] Error verifying puzzle:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async solve(sessionID, urlLocale = 'en_us') {
        try {
            console.log('[POW] Getting PoW puzzle...');
            const puzzle = await this.getPowPuzzle(sessionID, urlLocale);
            console.log('[POW] Puzzle type:', puzzle.puzzleType || 'challenge');

            console.log('[POW] Solving puzzle...');
            const solution = this.solvePuzzle(puzzle);
            console.log('[POW] Solved in', solution.attempts, 'attempts');

            console.log('[POW] Verifying solution...');
            const verification = await this.verifyPuzzle(solution, sessionID, urlLocale);

            if (verification.success) {
                console.log('[POW] Solution verified successfully');
                return {
                    success: true,
                    solution: solution.solution,
                    verification: verification.data
                };
            } else {
                console.error('[POW] Verification failed');
                return {
                    success: false,
                    error: verification.error
                };
            }
        } catch (error) {
            console.error('[POW] Solve error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    sha256(input) {
        return crypto.createHash('sha256').update(input).digest('hex');
    }

    checkDifficulty(hash, difficulty) {
        // Check if hash has enough leading zeros
        const target = '0'.repeat(difficulty);
        return hash.startsWith(target);
    }
}

module.exports = PoWSolver;
