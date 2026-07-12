/**
 * TiDB Data API — Server-side data proxy for client components
 * 
 * Client components can't directly query TiDB (no mysql in browser).
 * This API route proxies read requests from authenticated users.
 * 
 * GET /api/tidb/[table]?where={"status":"approved"}&orderBy=created_at&order=desc&limit=50
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import db from '@/lib/db'
import { isTiDBConfigured } from '@/lib/tidb'

// Allowed tables (whitelist for security)
const ALLOWED_TABLES = [
  'societies', 'users', 'events', 'activity_points',
  'tasks', 'task_questions', 'task_submissions', 'submission_answers',
  'event_bookings', 'event_team', 'posts', 'post_interactions',
  'notifications', 'resumes', 'view_society_stats', 'view_leader_performance',
  'circuit_sessions', 'circuit_sandbox',
] as const

type AllowedTable = typeof ALLOWED_TABLES[number]

// Map table names to db repos
function getRepo(table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map: Record<string, any> = {
    societies: db.societies,
    users: db.users,
    events: db.events,
    activity_points: db.activityPoints,
    tasks: db.tasks,
    task_questions: db.taskQuestions,
    task_submissions: db.taskSubmissions,
    submission_answers: db.submissionAnswers,
    event_bookings: db.eventBookings,
    event_team: db.eventTeam,
    posts: db.posts,
    post_interactions: db.postInteractions,
    notifications: db.notifications,
    resumes: db.resumes,
    circuit_sessions: db.circuitSessions,
    circuit_sandbox: db.circuitSandbox,
  }
  return map[table] || null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    // 1. Check TiDB is configured
    if (!isTiDBConfigured()) {
      return NextResponse.json(
        { error: 'TiDB backend not configured' },
        { status: 503 }
      )
    }

    // 2. Authenticate via Supabase
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 3. Validate table name
    const { table } = await params
    if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
      return NextResponse.json({ error: `Table '${table}' not allowed` }, { status: 400 })
    }

    // 4. Parse query params
    const url = new URL(request.url)
    const whereStr = url.searchParams.get('where')
    const orderByCol = url.searchParams.get('orderBy')
    const order = url.searchParams.get('order') || 'desc'
    const limitStr = url.searchParams.get('limit')
    const offsetStr = url.searchParams.get('offset')
    const selectStr = url.searchParams.get('select')
    const countOnly = url.searchParams.get('count') === 'true'
    const idParam = url.searchParams.get('id')

    // Handle views (raw query)
    if (table === 'view_society_stats' || table === 'view_leader_performance') {
      let sql = `SELECT * FROM \`${table}\``
      const sqlParams: unknown[] = []

      if (orderByCol) {
        sql += ` ORDER BY \`${orderByCol}\` ${order === 'asc' ? 'ASC' : 'DESC'}`
      }
      if (limitStr) {
        sql += ` LIMIT ?`
        sqlParams.push(parseInt(limitStr))
      }

      const rows = await db.query(sql, sqlParams)
      return NextResponse.json({ data: rows, source: 'tidb' })
    }

    const repo = getRepo(table)
    if (!repo) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    // Single row by ID
    if (idParam) {
      const row = await repo.findById(idParam)
      return NextResponse.json({ data: row, source: 'tidb' })
    }

    // Count only
    if (countOnly) {
      const where = whereStr ? JSON.parse(whereStr) : {}
      const count = await repo.count(where)
      return NextResponse.json({ count, source: 'tidb' })
    }

    // Find many
    const where = whereStr ? JSON.parse(whereStr) : {}
    const options: { where?: Record<string, unknown>; orderBy?: { column: string; ascending: boolean }; limit?: number; offset?: number; select?: string } = { where }

    if (orderByCol) {
      options.orderBy = { column: orderByCol, ascending: order === 'asc' }
    }
    if (limitStr) {
      options.limit = parseInt(limitStr)
    }
    if (offsetStr) {
      options.offset = parseInt(offsetStr)
    }
    if (selectStr) {
      options.select = selectStr
    }

    const data = await repo.findMany(options)
    return NextResponse.json({ data, source: 'tidb' })

  } catch (error) {
    console.error('[TiDB API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
