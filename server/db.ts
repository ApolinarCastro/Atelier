import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.ts';

fs.mkdirSync(CONFIG.dataDir, { recursive: true });
const dbPath = path.join(CONFIG.dataDir, 'atelier.db');
export const db = new DatabaseSync(dbPath);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS clients(
  id TEXT PRIMARY KEY, name TEXT, contact TEXT, notes TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS projects(
  id TEXT PRIMARY KEY, client_id TEXT, name TEXT, season TEXT, status TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS models(
  id TEXT PRIMARY KEY, project_id TEXT, name TEXT, archetype TEXT, dna_json TEXT,
  seed TEXT, sheet_asset_id TEXT, status TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS products(
  id TEXT PRIMARY KEY, project_id TEXT, title TEXT, brand TEXT, price REAL, currency TEXT,
  description TEXT, composition TEXT, sizes_json TEXT, category TEXT, variant_of TEXT,
  source_url TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS variants(
  id TEXT PRIMARY KEY, product_id TEXT, color_name TEXT, color_hex TEXT, sku TEXT, status TEXT);
CREATE TABLE IF NOT EXISTS locks(
  id TEXT PRIMARY KEY, product_id TEXT, garment_dna_json TEXT, source_asset_ids_json TEXT,
  qa_score REAL, approved INTEGER DEFAULT 0, approved_at TEXT, status TEXT,
  version INTEGER DEFAULT 1, created_at TEXT);
CREATE TABLE IF NOT EXISTS assets(
  id TEXT PRIMARY KEY, project_id TEXT, product_id TEXT, variant_id TEXT, model_id TEXT,
  type TEXT, stage TEXT, parent_asset_id TEXT, lock_id TEXT, file_path TEXT, mime TEXT,
  width INTEGER, height INTEGER, qa_json TEXT, qa_score REAL, approved INTEGER DEFAULT 0,
  created_at TEXT);
CREATE TABLE IF NOT EXISTS jobs(
  id TEXT PRIMARY KEY, project_id TEXT, type TEXT, status TEXT, input_json TEXT,
  output_json TEXT, error TEXT, model_used TEXT, cost_usd REAL,
  started_at TEXT, ended_at TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS exports(
  id TEXT PRIMARY KEY, project_id TEXT, manifest_json TEXT, zip_path TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS audit_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT, entity_id TEXT, action TEXT,
  actor TEXT, payload_json TEXT, created_at TEXT);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_product ON assets(product_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
`);

try {
  db.exec(`ALTER TABLE products ADD COLUMN script_json TEXT;`);
} catch {
  // La columna ya existe
}

export const now = () => new Date().toISOString();
export const uid = (p = '') =>
  p + crypto.randomBytes(6).toString('hex') + Date.now().toString(36).slice(-4);

type Params = Record<string, any> | any[];
const norm = (params?: Params): any[] => {
  if (!params) return [];
  return Array.isArray(params) ? params : Object.values(params);
};

export const run = (sql: string, params?: Params) => db.prepare(sql).run(...norm(params));
export const get = <T = any>(sql: string, params?: Params): T | undefined =>
  db.prepare(sql).get(...norm(params)) as T | undefined;
export const all = <T = any>(sql: string, params?: Params): T[] =>
  db.prepare(sql).all(...norm(params)) as T[];

export function tx<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const res = fn();
    db.exec('COMMIT');
    return res;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const audit = (entity: string, entityId: string, action: string, payload?: any, actor = 'operator') => {
  run(
    `INSERT INTO audit_log(entity, entity_id, action, actor, payload_json, created_at)
     VALUES(?,?,?,?,?,?)`,
    [entity, entityId, action, actor, JSON.stringify(payload ?? null), now()],
  );
};

for (const column of ['qa_mode', 'approval_evidence']) {
  if (!all<any>('PRAGMA table_info(assets)').some(field => field.name === column)) {
    db.exec(`ALTER TABLE assets ADD COLUMN ${column} TEXT`);
  }
}

if (!all<any>('PRAGMA table_info(locks)').some(field => field.name === 'variant_id')) {
  db.exec(`ALTER TABLE locks ADD COLUMN variant_id TEXT`);
}
db.exec(`CREATE INDEX IF NOT EXISTS idx_locks_product_variant ON locks(product_id, variant_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_assets_product_variant ON assets(product_id, variant_id)`);

