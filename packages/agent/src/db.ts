import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render / Supabase 等云服务需要 SSL，本地开发可不用
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
})

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      api_key       TEXT NOT NULL DEFAULT '',
      api_provider  TEXT NOT NULL DEFAULT 'claude',
      created_at    BIGINT NOT NULL
    )
  `)
}

export default pool
