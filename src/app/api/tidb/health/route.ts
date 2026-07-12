/**
 * TiDB Health Check Endpoint
 * 
 * GET /api/tidb/health — returns connection status and basic stats.
 */

import { NextResponse } from 'next/server'
import { testConnection, isTiDBConfigured } from '@/lib/tidb'
import { query } from '@/lib/tidb'
import { RowDataPacket } from 'mysql2/promise'

export async function GET() {
  if (!isTiDBConfigured()) {
    return NextResponse.json({
      status: 'not_configured',
      message: 'TiDB environment variables are not set. Add TIDB_HOST, TIDB_USER, TIDB_PASSWORD, TIDB_DATABASE to .env.local',
    }, { status: 503 })
  }

  const result = await testConnection()

  if (!result.ok) {
    return NextResponse.json({
      status: 'error',
      message: result.error,
    }, { status: 500 })
  }

  // Get table counts
  try {
    const tables = ['societies', 'users', 'events', 'activity_points', 'tasks',
      'task_submissions', 'event_bookings', 'posts', 'notifications', 'resumes']

    const counts: Record<string, number> = {}
    for (const table of tables) {
      try {
        const [row] = await query<(RowDataPacket & { cnt: number })[]>(
          `SELECT COUNT(*) AS cnt FROM \`${table}\``
        )
        counts[table] = row?.cnt ?? 0
      } catch {
        counts[table] = -1 // Table doesn't exist yet
      }
    }

    return NextResponse.json({
      status: 'connected',
      database: process.env.TIDB_DATABASE,
      host: process.env.TIDB_HOST,
      tables: counts,
    })
  } catch {
    return NextResponse.json({
      status: 'connected',
      message: 'Connection OK but could not query tables. Run the schema migration first.',
    })
  }
}
