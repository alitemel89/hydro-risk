import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL gerekli');
const pool = new Pool({connectionString:process.env.DATABASE_URL});
try { await pool.query(await readFile(new URL('./migrations/001_areas.sql',import.meta.url),'utf8')); console.log('Migration tamamlandı'); }
finally { await pool.end(); }
