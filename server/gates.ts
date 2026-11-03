import type { Asset } from '../shared/types.ts';
import { requiresQA, readEvidence, qaEvidence, validateQA, passesQA, fingerprint, digest } from './qa-evidence.ts';
import { get } from './db.ts';

export class GateError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const RENDER_TYPES = new Set(['tryon', 'ghost', 'view_front', 'view_left', 'view_right', 'view_back']);

/** GATE 1: debe existir un modelo aprobado (model_sheet) antes de renderizar. */
export function requireApprovedModel(modelId: string) {
  const model = get(`SELECT * FROM models WHERE id = ?`, [modelId]);
  if (!model) throw new GateError('MODEL_NOT_FOUND', 'El modelo no existe');
  if (!model.sheet_asset_id)
    throw new GateError('MODEL_SHEET_MISSING', 'El modelo no tiene hoja de identidad aprobada');
  const sheet = get(`SELECT * FROM assets WHERE id = ?`, [model.sheet_asset_id]);
  if (!sheet) throw new GateError('MODEL_SHEET_MISSING', 'model_sheet no encontrado');
  if (!sheet.approved)
    throw new GateError('MODEL_NOT_APPROVED', 'La hoja de identidad del modelo no está aprobada');
  return { model, sheet };
}

/** GATE 2: la prenda o variante debe tener un lock aprobado y coherente antes de renderizar o componer. */
export function requireApprovedLock(lockId: string, expectedVariantId?: string | null) {
  const lock = get<any>(`SELECT * FROM locks WHERE id = ?`, [lockId]);
  if (!lock) throw new GateError('LOCK_NOT_FOUND', 'El lock no existe');
  const lockVariantId = lock.variant_id ?? null;
  if (expectedVariantId !== undefined && lockVariantId !== (expectedVariantId ?? null)) {
    throw new GateError(
      'LOCK_VARIANT_MISMATCH',
      expectedVariantId
        ? `La variante ${expectedVariantId} requiere su propio Garment Lock con referencias originales asignadas; no puede usar el lock genérico o de otra variante (${lock.id}).`
        : `El render de la prenda base no puede usar un Garment Lock vinculado a la variante ${lockVariantId}.`,
    );
  }
  const rawIds = readEvidence(lock.source_asset_ids_json);
  if (!Array.isArray(rawIds) || !rawIds.length) {
    throw new GateError(
      'LOCK_REFERENCES_MISSING',
      lockVariantId
        ? `La variante ${lockVariantId} está pendiente: no tiene fotografías originales (garment_raw) asignadas a su Garment Lock.`
        : 'El Garment Lock no tiene fotografías originales (garment_raw) asignadas.',
    );
  }
  const lockedHashes = readEvidence(lock.garment_dna_json)?.sourceHashes;
  for (let i = 0; i < rawIds.length; i++) {
    const rawId = rawIds[i];
    const src = get<Asset>(`SELECT * FROM assets WHERE id = ?`, [rawId]);
    if (!src || src.type !== 'garment_raw' || src.product_id !== lock.product_id || (src.variant_id ?? null) !== lockVariantId) {
      throw new GateError(
        'LOCK_REFERENCE_SCOPE_INVALID',
        lockVariantId
          ? `La fotografía original ${rawId} no está asignada explícitamente a la variante ${lockVariantId}.`
          : `La fotografía original ${rawId} no pertenece al ámbito de la prenda base del Garment Lock.`,
      );
    }
    const fp = fingerprint(src);
    if (Array.isArray(lockedHashes) && lockedHashes[i] && lockedHashes[i] !== fp.sha256) {
      throw new GateError(
        'LOCK_STALE_REFERENCES',
        `Cambió el contenido de la fotografía original ${rawId}; actualiza y aprueba nuevamente el Garment Lock antes de generar.`,
      );
    }
  }
  if (!lock.approved || lock.status === 'stale_reference') {
    throw new GateError('LOCK_NOT_APPROVED', 'El ADN de la prenda no está aprobado o requiere actualizarse tras un cambio de referencias');
  }
  return lock;

}


export function requireAssetApprovable(assetId: string, _strictRenderQA = true) {
  const asset = get<Asset>('SELECT * FROM assets WHERE id=?', [assetId]);
  if (!asset) throw new GateError('ASSET_NOT_FOUND', 'El asset no existe');
  if (requiresQA(asset)) {
    const qa = readEvidence(asset.qa_json);
    if (!qa?.evaluationId || !asset.qa_mode || qa.mode !== asset.qa_mode)
      throw new GateError('ASSET_QA_REQUIRED', 'El render requiere una evaluación vigente con procedencia conocida');
    const evidence = qaEvidence(asset);
    if (JSON.stringify(qa.evidence) !== JSON.stringify(evidence))
      throw new GateError('QA_STALE', 'El candidato o las referencias cambiaron');
    if (!passesQA(validateQA(qa, Boolean(evidence.sheet)), Boolean(evidence.sheet)) || qa.opticalMetrics?.resolutionOk !== true)
      throw new GateError('ASSET_QA_FAILED', 'El render requiere un PASS completo');
  }
  if (asset.type === 'composed') {
    const composition = readEvidence(asset.qa_json);
    if (composition?.compositionVersion !== 1 || !Array.isArray(composition.components) || !composition.components.length)
      throw new GateError('COMPOSITION_UNVERIFIED', 'La composición requiere regeneración con procedencia verificable');
    for (const component of composition.components) {
      const current = get<Asset>('SELECT * FROM assets WHERE id=?', [component.id]);
      if (!current || current.type === 'composed' || current.project_id !== asset.project_id ||
          fingerprint(current).sha256 !== component.sha256)
        throw new GateError('COMPOSITION_STALE', 'Cambió un componente de la composición');
      requireApprovedAsset(current.id);
    }
  }
  return asset;
}

export function approvalEvidence(asset: Asset) {
  const qa = readEvidence(asset.qa_json);
  return JSON.stringify({
    ...fingerprint(asset), evaluationId: qa?.evaluationId ?? null,
    mode: asset.qa_mode ?? null, report: digest(asset.qa_json ?? ''),
  });
}

export function requireApprovedAsset(assetId: string) {
  const asset = requireAssetApprovable(assetId);
  if (!asset.approved || ((requiresQA(asset) || asset.type === 'composed') &&
      asset.approval_evidence !== approvalEvidence(asset)))
    throw new GateError('ASSET_NOT_APPROVED', 'Falta aprobación manual vigente');
  return asset;
}

export function requireProject(projectId: string) {
  const project = get('SELECT * FROM projects WHERE id=?', [projectId]);
  if (!project) throw new GateError('PROJECT_NOT_FOUND', 'El proyecto no existe');
  return project;
}
