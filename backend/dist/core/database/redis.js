"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedis = getRedis;
const redis_1 = require("@upstash/redis");
/**
 * Singleton Upstash Redis client for rate limiting.
 *
 * Returns `null` when the required env vars are missing (e.g. local dev
 * without Redis configured). All consumers MUST handle the `null` case
 * gracefully — typically by allowing the request through (fail-open).
 *
 * Credentials are read exclusively from environment variables:
 *   - UPSTASH_REDIS_REST_URL
 *   - UPSTASH_REDIS_REST_TOKEN
 *
 * Never import or hardcode credentials in source code.
 */
let redis = null;
function getRedis() {
    if (redis)
        return redis;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
        // Graceful degradation: Redis is optional during development
        return null;
    }
    try {
        redis = new redis_1.Redis({ url, token });
        return redis;
    }
    catch (error) {
        console.error('[Redis] Failed to initialize client:', error);
        return null;
    }
}
