import sharp from 'sharp';
import fs from 'node:fs';
import { run, uid } from '../server/db.ts';
import { register } from '../server/queue.ts';
import { analyzeJson } from '../server/provider.ts';
import { QA_PROMPT } from './prompts.ts';
import { getAsset } from './assets.ts';
import { qaEvidence, validateQA, passesQA, digest } from '../server/qa-evidence.ts';
import { GateError } from '../server/gates.ts';
import type { OpticalMetrics } from '../shared/types.ts';

const VALID = ['MATCH', 'POSSIBLE_MISMATCH', 'MISMATCH', 'NOT_VISIBLE'];

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.00000;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

async function centerMeanRgb(filePath: Buffer): Promise<[number, number, number]> {
  const meta = await sharp(filePath).metadata();
  const w = meta.width || 100;
  const h = meta.height || 100;
  const st = await sharp(filePath)
    .extract({
      left: Math.floor(w * 0.25),
      top: Math.floor(h * 0.25),
      width: Math.max(1, Math.floor(w * 0.5)),
      height: Math.max(1, Math.floor(h * 0.5)),
    })
    .stats();
  return [
    st.channels[0]?.mean ?? 128,
    st.channels[1]?.mean ?? 128,
    st.channels[2]?.mean ?? 128,
  ];
}

async function computeOpticalMetrics(srcPath: Buffer, candPath: Buffer): Promise<OpticalMetrics> {
  const [srcRgb, candRgb, candMeta, candStats] = await Promise.all([
    centerMeanRgb(srcPath),
    centerMeanRgb(candPath),
    sharp(candPath).metadata(),
    sharp(candPath).stats(),
  ]);
  const [L1, a1, b1] = rgbToLab(...srcRgb);
  const [L2, a2, b2] = rgbToLab(...candRgb);
  const deltaE = Number(Math.hypot(L1 - L2, a1 - a2, b1 - b2).toFixed(2));
  const w = candMeta.width || 0;
  const h = candMeta.height || 0;
  return {
    deltaE,
    sharpness: Number((candStats.sharpness || 0).toFixed(2)),
    resolutionOk: w >= 512 && h >= 512,
    dimensions: `${w}x${h}`,
  };
}


register('qa.evaluate', async (p) => {
  const candidate = getAsset(p.candidateAssetId);
  if (!candidate) throw new GateError('ASSET_NOT_FOUND', 'Candidato QA no encontrado');
  run(`UPDATE assets SET approved=0, approval_evidence=NULL, qa_score=NULL, qa_json=?, stage='qa' WHERE id=?`,
    [JSON.stringify({ status: 'INCOMPLETE' }), candidate.id]);
  const evidence = qaEvidence(candidate, p.sourceAssetId);
  const references = [evidence.originals[0], evidence.candidate, ...evidence.originals.slice(1)];
  if (evidence.sheet) references.push(evidence.sheet);
  const snapshots = references.map(ref => {
    const asset = getAsset(ref.id)!;
    const buffer = fs.readFileSync(asset.file_path);
    if (digest(buffer) !== ref.sha256) throw new GateError('QA_STALE', 'Cambió un archivo de la evaluación');
    return { buffer, mimeType: asset.mime };
  });
  const images = snapshots.map(({ buffer, mimeType }) => ({ data: buffer.toString('base64'), mimeType }));
  const opticalMetrics = await computeOpticalMetrics(snapshots[0].buffer, snapshots[1].buffer);
  const { data, model, costUsd } = await analyzeJson<unknown>({
    prompt: QA_PROMPT + '\nImage 1 and supplemental originals are garment evidence. Image 2 is the candidate. ' +
      (evidence.sheet ? 'The last image is the approved identity sheet. ' : 'Identity control does not apply to ghost mannequin. ') +
      'Assess only documented details of the candidate view. Mark unsupported or hidden attributes NOT_VISIBLE.',
    images,
  });
  const mode = model === 'mock-text' ? 'MOCK' : 'REAL';
  if (candidate.qa_mode !== mode) throw new GateError('QA_MODE_MISMATCH', 'Procedencia del candidato y QA incompatibles o desconocidas');
  const report = validateQA(data, Boolean(evidence.sheet));
  if (JSON.stringify(evidence) !== JSON.stringify(qaEvidence(getAsset(candidate.id)!))) {
    throw new GateError('QA_STALE', 'El candidato o las referencias cambiaron durante la evaluación');
  }
  const overallStatus = passesQA(report, Boolean(evidence.sheet)) && opticalMetrics.resolutionOk ? 'PASS' : 'FAIL';
  const result = { ...report, overallStatus, opticalMetrics, evidence, mode, evaluationId: uid('qa_') };
  const values = Object.values(report.attributes);
  const score = values.filter(value => value === 'MATCH').length / values.length;
  run('UPDATE assets SET qa_json=?, qa_score=? WHERE id=?', [JSON.stringify(result), score, candidate.id]);
  return { ...result, qaScore: score, assetId: candidate.id, model, costUsd };
});

