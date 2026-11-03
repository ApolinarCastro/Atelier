import { get, now, run, uid, audit } from './db.ts';
import { GateError } from './gates.ts';

type Handler = (payload: any, job: any) => Promise<any>;

const handlers = new Map<string, Handler>();
let draining = false;

// Recuperación al arranque: re-encola jobs que quedaron 'running' tras un reinicio abrupto
run(`UPDATE jobs SET status='queued' WHERE status='running'`);

export function register(type: string, handler: Handler) {
  handlers.set(type, handler);
}

export function enqueue(type: string, projectId: string | null, payload: any) {
  const id = uid('job_');
  run(
    `INSERT INTO jobs(id, project_id, type, status, input_json, created_at)
     VALUES(?,?,?,?,?,?)`,
    [id, projectId, type, 'queued', JSON.stringify(payload), now()],
  );
  audit('job', id, 'enqueued', { type });
  void drain();
  return get(`SELECT * FROM jobs WHERE id = ?`, [id]);
}

export function enqueueAndWait(type: string, projectId: string | null, payload: any) {
  const job = enqueue(type, projectId, payload);
  return waitForJob(job.id);
}

export async function waitForJob(jobId: string, timeoutMs = 180_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const job = get(`SELECT * FROM jobs WHERE id = ?`, [jobId]);
    if (job && (job.status === 'done' || job.status === 'failed')) {
      if (job.status === 'failed') {
        const rawErr = String(job.error || 'Job falló');
        const gateMatch = rawErr.match(/^\[GATE:([A-Z0-9_]+)\]\s*(.*)$/);
        if (gateMatch) {
          throw new GateError(gateMatch[1], gateMatch[2]);
        }
        throw new Error(rawErr);
      }
      return JSON.parse(job.output_json || 'null');
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error('Timeout esperando el job ' + jobId);
}

async function executeWithRetry(handler: Handler, payload: any, job: any, maxRetries = 2) {
  let attempt = 0;
  for (;;) {
    try {
      return await handler(payload, job);
    } catch (e: any) {
      if (e instanceof GateError) throw e;
      attempt++;
      if (attempt > maxRetries) throw e;
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }
}

export async function drain() {
  if (draining) return;
  draining = true;
  try {
    for (;;) {
      const next = get(`SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1`);
      if (!next) break;
      const handler = handlers.get(next.type);
      run(`UPDATE jobs SET status='running', started_at=? WHERE id=?`, [now(), next.id]);
      if (!handler) {
        run(`UPDATE jobs SET status='failed', error=?, ended_at=? WHERE id=?`, [
          'No hay handler para ' + next.type,
          now(),
          next.id,
        ]);
        continue;
      }
      try {
        const payload = JSON.parse(next.input_json || '{}');
        const result = await executeWithRetry(handler, payload, next);
        run(
          `UPDATE jobs SET status='done', output_json=?, model_used=?, cost_usd=?, ended_at=? WHERE id=?`,
          [
            JSON.stringify(result ?? null),
            result?.model || null,
            Number(result?.costUsd || 0),
            now(),
            next.id,
          ],
        );
      } catch (e: any) {
        const formattedErr =
          e instanceof GateError ? `[GATE:${e.code}] ${e.message}` : String(e?.message || e);
        run(`UPDATE jobs SET status='failed', error=?, ended_at=? WHERE id=?`, [
          formattedErr,
          now(),
          next.id,
        ]);
      }
    }
  } finally {
    draining = false;
  }
}

export const jobStats = () => ({
  queued: get<{ n: number }>(`SELECT COUNT(*) n FROM jobs WHERE status='queued'`)?.n || 0,
  running: get<{ n: number }>(`SELECT COUNT(*) n FROM jobs WHERE status='running'`)?.n || 0,
  done: get<{ n: number }>(`SELECT COUNT(*) n FROM jobs WHERE status='done'`)?.n || 0,
  failed: get<{ n: number }>(`SELECT COUNT(*) n FROM jobs WHERE status='failed'`)?.n || 0,
  cost: get<{ n: number }>(`SELECT COALESCE(SUM(cost_usd),0) n FROM jobs`)?.n || 0,
});

