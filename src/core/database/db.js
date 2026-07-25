"use strict";
/**
 * Dual-Backend Data Layer
 *
 * Reads existing data from Supabase, writes all NEW data to TiDB.
 * This module provides typed functions for every table, handling
 * the routing logic transparently.
 *
 * Architecture:
 *   - Supabase: Auth + File Storage + Legacy reads
 *   - TiDB: All new inserts/updates/deletes (going forward)
 *
 * Usage:
 *   import { db } from '@/core/database/db'
 *   const events = await db.events.findMany({ status: 'approved' })
 *   await db.events.create({ name: 'New Event', ... })
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const tidb_1 = require("./tidb");
const crypto_1 = require("crypto");
// ─── UUID Generator ────────────────────────────────────────────────────────
function uuid() {
    return (0, crypto_1.randomUUID)();
}
// ─── Helper: Convert MySQL row dates to ISO strings ────────────────────────
function normalizeRow(row) {
    const result = {};
    for (const [key, value] of Object.entries(row)) {
        if (value instanceof Date) {
            result[key] = value.toISOString();
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
function normalizeRows(rows) {
    return rows.map(r => normalizeRow(r));
}
function buildWhere(where) {
    const conditions = [];
    const params = [];
    for (const [key, value] of Object.entries(where)) {
        if (value === null) {
            conditions.push(`\`${key}\` IS NULL`);
        }
        else if (value === undefined) {
            continue;
        }
        else {
            conditions.push(`\`${key}\` = ?`);
            params.push(value);
        }
    }
    return {
        clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
        params,
    };
}
function createTableRepo(tableName) {
    return {
        async findMany(options = {}) {
            const { where = {}, orderBy, limit, offset, select = '*' } = options;
            const { clause, params } = buildWhere(where);
            let sql = `SELECT ${select} FROM \`${tableName}\` ${clause}`;
            if (orderBy) {
                sql += ` ORDER BY \`${orderBy.column}\` ${orderBy.ascending ? 'ASC' : 'DESC'}`;
            }
            if (limit) {
                sql += ` LIMIT ?`;
                params.push(limit);
            }
            if (offset) {
                sql += ` OFFSET ?`;
                params.push(offset);
            }
            const rows = await (0, tidb_1.query)(sql, params);
            return normalizeRows(rows);
        },
        async findById(id) {
            const row = await (0, tidb_1.queryOne)(`SELECT * FROM \`${tableName}\` WHERE id = ?`, [id]);
            return row ? normalizeRow(row) : null;
        },
        async findOne(where) {
            const { clause, params } = buildWhere(where);
            const row = await (0, tidb_1.queryOne)(`SELECT * FROM \`${tableName}\` ${clause} LIMIT 1`, params);
            return row ? normalizeRow(row) : null;
        },
        async count(where = {}) {
            const { clause, params } = buildWhere(where);
            const row = await (0, tidb_1.queryOne)(`SELECT COUNT(*) AS cnt FROM \`${tableName}\` ${clause}`, params);
            return row ? Number(row.cnt) : 0;
        },
        async create(data) {
            const id = data.id || uuid();
            const record = { ...data, id };
            const keys = Object.keys(record).filter(k => record[k] !== undefined);
            const values = keys.map(k => {
                const v = record[k];
                // Serialize JSON objects/arrays for JSON columns
                if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
                    return JSON.stringify(v);
                }
                return v;
            });
            const placeholders = keys.map(() => '?').join(', ');
            const columns = keys.map(k => `\`${k}\``).join(', ');
            await (0, tidb_1.execute)(`INSERT INTO \`${tableName}\` (${columns}) VALUES (${placeholders})`, values);
            // Return the created record
            return this.findById(id);
        },
        async update(id, data) {
            const entries = Object.entries(data).filter(([, v]) => v !== undefined);
            if (entries.length === 0)
                return;
            const sets = entries.map(([k]) => `\`${k}\` = ?`).join(', ');
            const values = entries.map(([, v]) => {
                if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
                    return JSON.stringify(v);
                }
                return v;
            });
            values.push(id);
            await (0, tidb_1.execute)(`UPDATE \`${tableName}\` SET ${sets} WHERE id = ?`, values);
        },
        async delete(id) {
            await (0, tidb_1.execute)(`DELETE FROM \`${tableName}\` WHERE id = ?`, [id]);
        },
        async upsert(data, conflictKeys = ['id']) {
            const keys = Object.keys(data).filter(k => data[k] !== undefined);
            const values = keys.map(k => {
                const v = data[k];
                if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
                    return JSON.stringify(v);
                }
                return v;
            });
            const placeholders = keys.map(() => '?').join(', ');
            const columns = keys.map(k => `\`${k}\``).join(', ');
            // ON DUPLICATE KEY UPDATE for MySQL/TiDB
            const updateParts = keys
                .filter(k => !conflictKeys.includes(k))
                .map(k => `\`${k}\` = VALUES(\`${k}\`)`)
                .join(', ');
            await (0, tidb_1.execute)(`INSERT INTO \`${tableName}\` (${columns}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateParts}`, values);
        },
        async raw(sql, params) {
            return (0, tidb_1.query)(sql, params);
        },
    };
}
exports.db = {
    /** Check if TiDB backend is available */
    isAvailable: tidb_1.isTiDBConfigured,
    // Table repositories — all writes go to TiDB
    societies: createTableRepo('societies'),
    users: createTableRepo('users'),
    events: createTableRepo('events'),
    activityPoints: createTableRepo('activity_points'),
    tasks: createTableRepo('tasks'),
    taskQuestions: createTableRepo('task_questions'),
    taskSubmissions: createTableRepo('task_submissions'),
    submissionAnswers: createTableRepo('submission_answers'),
    eventBookings: createTableRepo('event_bookings'),
    eventTeam: createTableRepo('event_team'),
    posts: createTableRepo('posts'),
    postInteractions: createTableRepo('post_interactions'),
    notifications: createTableRepo('notifications'),
    resumes: createTableRepo('resumes'),
    // Circuit Challenge Sandbox (ephemeral)
    circuitSessions: createTableRepo('circuit_sessions'),
    circuitSandbox: createTableRepo('circuit_sandbox'),
    // Raw query access
    query: tidb_1.query,
    execute: tidb_1.execute,
    queryOne: tidb_1.queryOne,
};
exports.default = exports.db;
