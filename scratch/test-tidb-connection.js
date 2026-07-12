/**
 * TiDB Connection Test Script
 * 
 * Run: node scratch/test-tidb-connection.js
 * 
 * Tests basic connectivity to your TiDB Cloud instance.
 * Uses the same env vars as the Next.js app.
 */

require('dotenv').config({ path: '.env.local' })
const mysql = require('mysql2/promise')

async function main() {
  console.log('🔌 Testing TiDB Cloud connection...\n')

  const config = {
    host: process.env.TIDB_HOST,
    port: parseInt(process.env.TIDB_PORT || '4000'),
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE,
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
  }

  console.log('📋 Config:')
  console.log(`   Host:     ${config.host}`)
  console.log(`   Port:     ${config.port}`)
  console.log(`   User:     ${config.user}`)
  console.log(`   Database: ${config.database}`)
  console.log(`   SSL:      Enabled (TLS 1.2+)\n`)

  if (!config.host || !config.user || !config.password || !config.database) {
    console.error('❌ Missing environment variables! Check your .env.local file.')
    console.error('   Required: TIDB_HOST, TIDB_USER, TIDB_PASSWORD, TIDB_DATABASE')
    process.exit(1)
  }

  try {
    const connection = await mysql.createConnection(config)
    console.log('✅ Connected successfully!\n')

    // Test basic query
    const [rows] = await connection.query('SELECT VERSION() AS version, NOW() AS server_time')
    console.log('📊 Server Info:')
    console.log(`   Version:     ${rows[0].version}`)
    console.log(`   Server Time: ${rows[0].server_time}\n`)

    // Check if our tables exist
    const [tables] = await connection.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?`,
      [config.database]
    )

    if (tables.length === 0) {
      console.log('⚠️  No tables found. Run the schema migration:')
      console.log('   Copy tidb/schema.sql into TiDB Cloud SQL Editor and run it.\n')
    } else {
      console.log(`📦 Found ${tables.length} table(s):`)
      tables.forEach(t => console.log(`   • ${t.TABLE_NAME}`))
      console.log()
    }

    await connection.end()
    console.log('🎉 All checks passed! TiDB is ready.\n')
  } catch (err) {
    console.error('❌ Connection failed:', err.message)
    console.error('\n💡 Troubleshooting:')
    console.error('   1. Check if your IP is whitelisted in TiDB Cloud')
    console.error('   2. Verify credentials in .env.local')
    console.error('   3. Ensure the database exists (create it in TiDB Cloud console)')
    process.exit(1)
  }
}

main()
