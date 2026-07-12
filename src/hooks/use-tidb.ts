/**
 * Client-side TiDB data hook
 * 
 * Provides a Supabase-like API for client components to query TiDB
 * through the /api/tidb/[table] proxy route.
 * 
 * Usage:
 *   import { useTiDB } from '@/hooks/use-tidb'
 *   
 *   const tidb = useTiDB()
 *   const { data, error, loading } = await tidb.from('events').select().eq('status', 'approved')
 */

'use client'

import { useCallback } from 'react'

interface QueryResult<T> {
  data: T[] | null
  count?: number
  error: string | null
  source: 'tidb'
}

interface SingleResult<T> {
  data: T | null
  error: string | null
  source: 'tidb'
}

class TiDBQueryBuilder<T = Record<string, unknown>> {
  private table: string
  private whereParams: Record<string, unknown> = {}
  private orderByCol: string | null = null
  private orderDir: 'asc' | 'desc' = 'desc'
  private limitVal: number | null = null
  private offsetVal: number | null = null
  private selectFields: string = '*'
  private countOnly: boolean = false
  private headOnly: boolean = false

  constructor(table: string) {
    this.table = table
  }

  select(fields: string = '*', options?: { count?: 'exact'; head?: boolean }): this {
    this.selectFields = fields
    if (options?.count === 'exact') this.countOnly = true
    if (options?.head) this.headOnly = true
    return this
  }

  eq(column: string, value: unknown): this {
    this.whereParams[column] = value
    return this
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderByCol = column
    this.orderDir = options?.ascending ? 'asc' : 'desc'
    return this
  }

  limit(n: number): this {
    this.limitVal = n
    return this
  }

  range(from: number, to: number): this {
    this.offsetVal = from
    this.limitVal = to - from + 1
    return this
  }

  async single(): Promise<SingleResult<T>> {
    const url = this.buildUrl()
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.json()
        return { data: null, error: body.error || 'Request failed', source: 'tidb' }
      }
      const body = await res.json()
      const data = Array.isArray(body.data) ? body.data[0] || null : body.data
      return { data, error: null, source: 'tidb' }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Unknown error', source: 'tidb' }
    }
  }

  async then(resolve: (result: QueryResult<T>) => void): Promise<void> {
    const result = await this.execute()
    resolve(result)
  }

  async execute(): Promise<QueryResult<T>> {
    const url = this.buildUrl()
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.json()
        return { data: null, error: body.error || 'Request failed', source: 'tidb' }
      }
      const body = await res.json()

      if (this.countOnly && this.headOnly) {
        return { data: null, count: body.count, error: null, source: 'tidb' }
      }

      return { data: body.data, count: body.count, error: null, source: 'tidb' }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Unknown error', source: 'tidb' }
    }
  }

  private buildUrl(): string {
    const params = new URLSearchParams()

    if (Object.keys(this.whereParams).length > 0) {
      params.set('where', JSON.stringify(this.whereParams))
    }
    if (this.orderByCol) {
      params.set('orderBy', this.orderByCol)
      params.set('order', this.orderDir)
    }
    if (this.limitVal !== null) {
      params.set('limit', String(this.limitVal))
    }
    if (this.offsetVal !== null) {
      params.set('offset', String(this.offsetVal))
    }
    if (this.selectFields !== '*') {
      params.set('select', this.selectFields)
    }
    if (this.countOnly && this.headOnly) {
      params.set('count', 'true')
    }

    const qs = params.toString()
    return `/api/tidb/${this.table}${qs ? '?' + qs : ''}`
  }
}

/**
 * Hook that provides a Supabase-like API for querying TiDB.
 * 
 * Usage mirrors Supabase client:
 *   const tidb = useTiDB()
 *   const { data } = await tidb.from('events').select('*').eq('status', 'approved').execute()
 */
export function useTiDB() {
  const from = useCallback(<T = Record<string, unknown>>(table: string) => {
    return new TiDBQueryBuilder<T>(table)
  }, [])

  return { from }
}

/**
 * Standalone function (non-hook) for use in server components or utilities.
 */
export function tidbClient() {
  return {
    from: <T = Record<string, unknown>>(table: string) => new TiDBQueryBuilder<T>(table),
  }
}
