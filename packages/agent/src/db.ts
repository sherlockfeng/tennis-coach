import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
      coach_style   TEXT NOT NULL DEFAULT '',
      created_at    BIGINT NOT NULL
    )
  `)

  // Migrate: add coach_style if it doesn't exist yet
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_style TEXT NOT NULL DEFAULT ''
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type       TEXT NOT NULL DEFAULT 'chat',
      title      TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id         SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role       TEXT NOT NULL,
      content    TEXT NOT NULL,
      frame_urls TEXT[] NOT NULL DEFAULT '{}',
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS technique_profile (
      user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      strengths  TEXT[] NOT NULL DEFAULT '{}',
      weaknesses TEXT[] NOT NULL DEFAULT '{}',
      style_tags TEXT[] NOT NULL DEFAULT '{}',
      updated_at BIGINT NOT NULL
    )
  `)
}

export default pool
