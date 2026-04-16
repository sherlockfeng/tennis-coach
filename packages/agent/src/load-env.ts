import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const here = path.dirname(fileURLToPath(import.meta.url))
const monorepoRoot = path.resolve(here, '../../..')

dotenv.config({ path: path.join(monorepoRoot, '.env') })
dotenv.config({ path: path.join(here, '..', '.env'), override: true })
