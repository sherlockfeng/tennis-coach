import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '..', 'tennis-coach.db')

const db = new Database(DB_PATH)

// Enable WAL for better concurrent read performance
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    api_key       TEXT    NOT NULL DEFAULT '',
    api_provider  TEXT    NOT NULL DEFAULT 'claude',
    created_at    INTEGER NOT NULL
  )
`)

export default db
