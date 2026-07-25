/**
 * TiDB Cloud Connection Pool (Singleton)
 * 
 * Uses mysql2/promise with SSL for secure TiDB Cloud connections.
 * Singleton pattern prevents connection exhaustion in serverless (Vercel).
 * 
 * Environment variables required:
 *   TIDB_HOST, TIDB_PORT, TIDB_USER, TIDB_PASSWORD, TIDB_DATABASE
 */

import * as mysql from 'mysql2/promise'
import type { Pool, PoolOptions, RowDataPacket, ResultSetHeader } from 'mysql2/promise'

let pool: Pool | null = null

function getTiDBConfig(): PoolOptions {
  const host = process.env.TIDB_HOST
  const port = parseInt(process.env.TIDB_PORT || '4000', 10)
  const user = process.env.TIDB_USER
  const password = process.env.TIDB_PASSWORD
  const database = process.env.TIDB_DATABASE

  if (!host || !user || !password || !database) {
    throw new Error(
      'Missing TiDB environment variables. Required: TIDB_HOST, TIDB_USER, TIDB_PASSWORD, TIDB_DATABASE'
    )
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
  }
}

/**
 * Get the TiDB connection pool (creates one if it doesn't exist).
 */
export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool(getTiDBConfig())
  }
  return pool
}

/**
 * Check if TiDB is configured (env vars present).
 */
export function isTiDBConfigured(): boolean {
  return !!(
    process.env.TIDB_HOST &&
    process.env.TIDB_USER &&
    process.env.TIDB_PASSWORD &&
    process.env.TIDB_DATABASE
  )
}

/**
 * Execute a SELECT query and return typed rows.
 */
export async function query<T extends RowDataPacket[]>(
  sql: string,
  params?: unknown[]
): Promise<T> {
  const db = getPool()
  const [rows] = await db.query<T>(sql, params)
  return rows
}

/**
 * Execute an INSERT/UPDATE/DELETE and return the result header.
 */
export async function execute(
  sql: string,
  params?: unknown[]
): Promise<ResultSetHeader> {
  const db = getPool()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result] = await db.execute<ResultSetHeader>(sql, params as any)
  return result
}

/**
 * Execute a single-row SELECT query.
 */
export async function queryOne<T extends RowDataPacket>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T[]>(sql, params)
  return rows[0] ?? null
}

/**
 * Test the TiDB connection. Returns true if successful.
 */
export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const db = getPool()
    const conn = await db.getConnection()
    await conn.ping()
    conn.release()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Gracefully close the pool (for cleanup/testing).
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
