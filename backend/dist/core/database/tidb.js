"use strict";
/**
 * TiDB Cloud Connection Pool (Singleton)
 *
 * Uses mysql2/promise with SSL for secure TiDB Cloud connections.
 * Singleton pattern prevents connection exhaustion in serverless (Vercel).
 *
 * Environment variables required:
 *   TIDB_HOST, TIDB_PORT, TIDB_USER, TIDB_PASSWORD, TIDB_DATABASE
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = getPool;
exports.isTiDBConfigured = isTiDBConfigured;
exports.query = query;
exports.execute = execute;
exports.queryOne = queryOne;
exports.testConnection = testConnection;
exports.closePool = closePool;
const mysql = __importStar(require("mysql2/promise"));
let pool = null;
function getTiDBConfig() {
    const host = process.env.TIDB_HOST;
    const port = parseInt(process.env.TIDB_PORT || '4000', 10);
    const user = process.env.TIDB_USER;
    const password = process.env.TIDB_PASSWORD;
    const database = process.env.TIDB_DATABASE;
    if (!host || !user || !password || !database) {
        throw new Error('Missing TiDB environment variables. Required: TIDB_HOST, TIDB_USER, TIDB_PASSWORD, TIDB_DATABASE');
    }
    return {
        host,
        port,
        user,
        password,
        database,
        ssl: {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true,
        },
        // Optimized for serverless — low connection limit per instance
        connectionLimit: 5,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        // Auto-reconnect on idle timeout
        waitForConnections: true,
        queueLimit: 0,
    };
}
/**
 * Get the TiDB connection pool (creates one if it doesn't exist).
 */
function getPool() {
    if (!pool) {
        pool = mysql.createPool(getTiDBConfig());
    }
    return pool;
}
/**
 * Check if TiDB is configured (env vars present).
 */
function isTiDBConfigured() {
    return !!(process.env.TIDB_HOST &&
        process.env.TIDB_USER &&
        process.env.TIDB_PASSWORD &&
        process.env.TIDB_DATABASE);
}
/**
 * Execute a SELECT query and return typed rows.
 */
async function query(sql, params) {
    const db = getPool();
    const [rows] = await db.query(sql, params);
    return rows;
}
/**
 * Execute an INSERT/UPDATE/DELETE and return the result header.
 */
async function execute(sql, params) {
    const db = getPool();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result] = await db.execute(sql, params);
    return result;
}
/**
 * Execute a single-row SELECT query.
 */
async function queryOne(sql, params) {
    const rows = await query(sql, params);
    return rows[0] ?? null;
}
/**
 * Test the TiDB connection. Returns true if successful.
 */
async function testConnection() {
    try {
        const db = getPool();
        const conn = await db.getConnection();
        await conn.ping();
        conn.release();
        return { ok: true };
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
/**
 * Gracefully close the pool (for cleanup/testing).
 */
async function closePool() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
