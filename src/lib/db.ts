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
 *   import { db } from '@/lib/db'
 *   const events = await db.events.findMany({ status: 'approved' })
 *   await db.events.create({ name: 'New Event', ... })
 */

import { query, execute, queryOne, isTiDBConfigured } from './tidb'
import { RowDataPacket } from 'mysql2/promise'
import { randomUUID } from 'crypto'

// ─── Types ─────────────────────────────────────────────────────────────────

export type BackendSource = 'tidb' | 'supabase'

interface BaseRow {
  id: string
  created_at: string
}

// ─── UUID Generator ────────────────────────────────────────────────────────

function uuid(): string {
  return randomUUID()
}

// ─── Helper: Convert MySQL row dates to ISO strings ────────────────────────

function normalizeRow<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      result[key] = value.toISOString()
    } else {
      result[key] = value
    }
  }
  return result as T
}

function normalizeRows<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map(r => normalizeRow<T>(r))
}

// ─── Generic Query Builder ─────────────────────────────────────────────────

interface WhereClause {
  [key: string]: unknown
}

interface FindOptions {
  where?: WhereClause
  orderBy?: { column: string; ascending?: boolean }
  limit?: number
  offset?: number
  select?: string
  count?: boolean
}

function buildWhere(where: WhereClause): { clause: string; params: unknown[] } {
  const conditions: string[] = []
  const params: unknown[] = []

  for (const [key, value] of Object.entries(where)) {
    if (value === null) {
      conditions.push(`\`${key}\` IS NULL`)
    } else if (value === undefined) {
      continue
    } else {
      conditions.push(`\`${key}\` = ?`)
      params.push(value)
    }
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  }
}

// ─── Table Repository Factory ──────────────────────────────────────────────

interface TableRepo<T extends BaseRow> {
  /** Find multiple rows */
  findMany(options?: FindOptions): Promise<T[]>
  /** Find a single row by ID */
  findById(id: string): Promise<T | null>
  /** Find a single row matching conditions */
  findOne(where: WhereClause): Promise<T | null>
  /** Count rows matching conditions */
  count(where?: WhereClause): Promise<number>
  /** Insert a new row (always goes to TiDB) */
  create(data: Partial<T> & { id?: string }): Promise<T>
  /** Update a row by ID (always goes to TiDB) */
  update(id: string, data: Partial<T>): Promise<void>
  /** Delete a row by ID (always goes to TiDB) */
  delete(id: string): Promise<void>
  /** Upsert a row (insert or update on conflict) */
  upsert(data: Partial<T> & { id: string }, conflictKeys?: string[]): Promise<void>
  /** Raw query on this table's TiDB backend */
  raw<R extends RowDataPacket[]>(sql: string, params?: unknown[]): Promise<R>
}

function createTableRepo<T extends BaseRow>(tableName: string): TableRepo<T> {
  return {
    async findMany(options: FindOptions = {}): Promise<T[]> {
      const { where = {}, orderBy, limit, offset, select = '*' } = options

      const { clause, params } = buildWhere(where)
      let sql = `SELECT ${select} FROM \`${tableName}\` ${clause}`

      if (orderBy) {
        sql += ` ORDER BY \`${orderBy.column}\` ${orderBy.ascending ? 'ASC' : 'DESC'}`
      }

      if (limit) {
        sql += ` LIMIT ?`
        params.push(limit)
      }

      if (offset) {
        sql += ` OFFSET ?`
        params.push(offset)
      }

      const rows = await query<(T & RowDataPacket)[]>(sql, params)
      return normalizeRows<T>(rows)
    },

    async findById(id: string): Promise<T | null> {
      const row = await queryOne<T & RowDataPacket>(
        `SELECT * FROM \`${tableName}\` WHERE id = ?`,
        [id]
      )
      return row ? normalizeRow<T>(row) : null
    },

    async findOne(where: WhereClause): Promise<T | null> {
      const { clause, params } = buildWhere(where)
      const row = await queryOne<T & RowDataPacket>(
        `SELECT * FROM \`${tableName}\` ${clause} LIMIT 1`,
        params
      )
      return row ? normalizeRow<T>(row) : null
    },

    async count(where: WhereClause = {}): Promise<number> {
      const { clause, params } = buildWhere(where)
      const row = await queryOne<RowDataPacket>(
        `SELECT COUNT(*) AS cnt FROM \`${tableName}\` ${clause}`,
        params
      )
      return row ? Number(row.cnt) : 0
    },

    async create(data: Partial<T> & { id?: string }): Promise<T> {
      const id = data.id || uuid()
      const record = { ...data, id }

      const keys = Object.keys(record).filter(k => record[k as keyof typeof record] !== undefined)
      const values = keys.map(k => {
        const v = record[k as keyof typeof record]
        // Serialize JSON objects/arrays for JSON columns
        if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
          return JSON.stringify(v)
        }
        return v
      })
      const placeholders = keys.map(() => '?').join(', ')
      const columns = keys.map(k => `\`${k}\``).join(', ')

      await execute(
        `INSERT INTO \`${tableName}\` (${columns}) VALUES (${placeholders})`,
        values
      )

      // Return the created record
      return this.findById(id) as Promise<T>
    },

    async update(id: string, data: Partial<T>): Promise<void> {
      const entries = Object.entries(data).filter(([, v]) => v !== undefined)
      if (entries.length === 0) return

      const sets = entries.map(([k]) => `\`${k}\` = ?`).join(', ')
      const values = entries.map(([, v]) => {
        if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
          return JSON.stringify(v)
        }
        return v
      })
      values.push(id)

      await execute(`UPDATE \`${tableName}\` SET ${sets} WHERE id = ?`, values)
    },

    async delete(id: string): Promise<void> {
      await execute(`DELETE FROM \`${tableName}\` WHERE id = ?`, [id])
    },

    async upsert(data: Partial<T> & { id: string }, conflictKeys: string[] = ['id']): Promise<void> {
      const keys = Object.keys(data).filter(k => data[k as keyof typeof data] !== undefined)
      const values = keys.map(k => {
        const v = data[k as keyof typeof data]
        if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
          return JSON.stringify(v)
        }
        return v
      })
      const placeholders = keys.map(() => '?').join(', ')
      const columns = keys.map(k => `\`${k}\``).join(', ')

      // ON DUPLICATE KEY UPDATE for MySQL/TiDB
      const updateParts = keys
        .filter(k => !conflictKeys.includes(k))
        .map(k => `\`${k}\` = VALUES(\`${k}\`)`)
        .join(', ')

      await execute(
        `INSERT INTO \`${tableName}\` (${columns}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateParts}`,
        values
      )
    },

    async raw<R extends RowDataPacket[]>(sql: string, params?: unknown[]): Promise<R> {
      return query<R>(sql, params)
    },
  }
}

// ─── Database Interface ────────────────────────────────────────────────────

// Re-export types from the main types file for convenience
import type {
  UserProfile,
  Society,
  Event,
  ActivityPoint,
  Task,
  TaskQuestion,
  TaskSubmission,
  SubmissionAnswer,
  Post,
  PostInteraction,
  Notification,
  Resume,
  CircuitSession,
  CircuitSandboxEntry,
} from './types'

// Event booking type (not in main types file)
export interface EventBooking extends BaseRow {
  event_id: string
  user_id: string
  booked_at: string
}

// Event team type
export interface EventTeam extends BaseRow {
  event_id: string
  member_id: string
  role: string
}

export const db = {
  /** Check if TiDB backend is available */
  isAvailable: isTiDBConfigured,

  // Table repositories — all writes go to TiDB
  societies: createTableRepo<Society & BaseRow>('societies'),
  users: createTableRepo<UserProfile & BaseRow>('users'),
  events: createTableRepo<Event & BaseRow>('events'),
  activityPoints: createTableRepo<ActivityPoint & BaseRow>('activity_points'),
  tasks: createTableRepo<Task & BaseRow>('tasks'),
  taskQuestions: createTableRepo<TaskQuestion & BaseRow>('task_questions'),
  taskSubmissions: createTableRepo<TaskSubmission & BaseRow>('task_submissions'),
  submissionAnswers: createTableRepo<SubmissionAnswer & BaseRow>('submission_answers'),
  eventBookings: createTableRepo<EventBooking>('event_bookings'),
  eventTeam: createTableRepo<EventTeam>('event_team'),
  posts: createTableRepo<Post & BaseRow>('posts'),
  postInteractions: createTableRepo<PostInteraction & BaseRow>('post_interactions'),
  notifications: createTableRepo<Notification & BaseRow>('notifications'),
  resumes: createTableRepo<Resume & BaseRow>('resumes'),

  // Circuit Challenge Sandbox (ephemeral)
  circuitSessions: createTableRepo<CircuitSession & BaseRow>('circuit_sessions'),
  circuitSandbox: createTableRepo<CircuitSandboxEntry & BaseRow>('circuit_sandbox'),

  // Raw query access
  query,
  execute,
  queryOne,
}

export default db
