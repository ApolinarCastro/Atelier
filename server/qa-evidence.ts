import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { get } from './db.ts';


import { resolveAssetFile } from './storage.ts';
import { GateError, requireApprovedLock, requireApprovedModel } from './gates.ts';
import type { Asset, QAResult } from '../shared/types.ts';

export const requiresQA = (asset: Asset) =>
  ['tryon', 'ghost', 'view_front', 'view_left', 'view_right', 'view_back', 'retouched'].includes(asset.type);

export function readEvidence(json?: string) {
  try { return JSON.parse(json || 'null'); } catch { return null; }
}

export function digest(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex');
}

export function fingerprint(asset: Asset) {
  try {
    const file = resolveAssetFile(asset.file_path);
    if (!file) throw new Error('Archivo fuera del almacenamiento');
    return { id: asset.id, sha256: digest(fs.readFileSync(file)) };
  } catch {
    throw new GateError('ASSET_FILE_MISSING', `Archivo no disponible para ${asset.id}`);
  }
}

export function qaEvidence(asset: Asset, requestedSource?: string) {
  const fail = (message: string): never => {
    throw new GateError('QA_INCOMPLETE', message);
  };
  if (!requiresQA(asset) || !asset.lock_id || !asset.product_id) {
    return fail('El candidato necesita una prenda y un Garment Lock aprobado');
  }
  const lock = requireApprovedLock(asset.lock_id, asset.variant_id ?? null);
  const ids = readEvidence(lock.source_asset_ids_json);
  if (lock.product_id !== asset.product_id || (lock.variant_id ?? null) !== (asset.variant_id ?? null) || !Array.isArray(ids) || !ids.length) {
    return fail('Faltan originales válidos del Garment Lock para la prenda o variante');
  }
  if (requestedSource !== undefined && !ids.includes(requestedSource)) {
    return fail('La referencia solicitada no pertenece a los originales del Garment Lock');
  }
  const candidate = fingerprint(asset);
  const originals = ids.map((id: string) => {
    const source = get<Asset>('SELECT * FROM assets WHERE id=?', [id]);
    if (!source || source.type !== 'garment_raw' || source.project_id !== asset.project_id ||
        source.product_id !== asset.product_id || (source.variant_id ?? null) !== (asset.variant_id ?? null) ||
        (source.variant_id ?? null) !== (lock.variant_id ?? null)) {
      return fail('Original incompatible con el proyecto, prenda o variante del candidato');
    }
    return fingerprint(source);
  });

  const lockedHashes = readEvidence(lock.garment_dna_json)?.sourceHashes;
  if (Array.isArray(lockedHashes) &&
      lockedHashes.some((hash, index) => originals[index]?.sha256 !== hash)) {
    return fail('Cambió un original aprobado en el Garment Lock');
  }


  if (asset.variant_id && !get('SELECT id FROM variants WHERE id=? AND product_id=?',
    [asset.variant_id, asset.product_id])) {
    return fail('La variante del candidato no pertenece a la prenda');
  }
  const needsIdentity = asset.type !== 'ghost';
  const identity = needsIdentity && asset.model_id ? requireApprovedModel(asset.model_id) : null;
  if (needsIdentity && (!identity || identity.model.project_id !== asset.project_id ||
      identity.sheet.project_id !== asset.project_id || identity.sheet.type !== 'model_sheet')) {
    return fail('Falta una hoja de identidad aprobada del proyecto');
  }
  const sheet = identity ? fingerprint(identity.sheet) : null;
  if ([...originals, ...(sheet ? [sheet] : [])].some(ref =>
    ref.id === candidate.id || ref.sha256 === candidate.sha256)) {
    return fail('El candidato y sus referencias deben tener contenido distinto');
  }
  return {
    candidate, originals, sheet,
    scope: [asset.type, asset.project_id, asset.product_id, asset.variant_id ?? null, asset.model_id ?? null],
    lock: digest(JSON.stringify(lock)),
  };
}

const attributes = ['color', 'pattern', 'silhouette', 'neckline', 'lapels', 'buttons',
  'pockets', 'sleeves', 'hem', 'texture', 'addedElements', 'missingElements'];
const flags = ['noJewelryAdded', 'noLipstickChange', 'noMakeupChange', 'noSkinMarksImported', 'noAnatomyDeformation'];

export function validateQA(data: any, needsIdentity: boolean): QAResult & { controls: NonNullable<QAResult['controls']> } {
  const c = data?.controls;
  const detail = (control: any) => typeof control?.passed === 'boolean' && typeof control.details === 'string';
  const valid = ['PASS', 'FAIL'].includes(data?.overallStatus) &&
    typeof data.hasCriticalMismatch === 'boolean' && typeof data.notes === 'string' &&
    attributes.every(key => ['MATCH', 'POSSIBLE_MISMATCH', 'MISMATCH', 'NOT_VISIBLE'].includes(data.attributes?.[key])) &&
    (!needsIdentity || (detail(c?.controlA_identity) && Number.isFinite(c.controlA_identity.confidence) &&
      c.controlA_identity.confidence >= 0 && c.controlA_identity.confidence <= 1)) &&
    typeof c?.controlB_prohibitedExclusion?.passed === 'boolean' &&
    flags.every(key => typeof c.controlB_prohibitedExclusion[key] === 'boolean') &&
    Array.isArray(c.controlB_prohibitedExclusion.violations) &&
    c.controlB_prohibitedExclusion.violations.every((value: unknown) => typeof value === 'string') &&
    detail(c.controlC_textileFidelity) && typeof c.controlC_textileFidelity.silhouetteIntact === 'boolean' &&
    detail(c.controlD_compositionPose) && typeof c.controlD_compositionPose.posePreserved === 'boolean' &&
    detail(c.controlE_technicalQuality) &&
    ['APPROVE', 'ASSISTED_RETRY', 'HALT_PRESERVE_PREVIOUS'].includes(c.suggestedAction);
  if (!valid) throw new GateError('QA_INVALID', 'Respuesta QA incompleta o incompatible con el contrato');
  return data;
}

export function passesQA(data: ReturnType<typeof validateQA>, needsIdentity: boolean, candidateType?: string) {
  const c = data.controls;
  if (data.overallStatus !== 'PASS' || data.hasCriticalMismatch) return false;
  if (needsIdentity && !c.controlA_identity.passed) return false;
  if (!c.controlB_prohibitedExclusion.passed || c.controlB_prohibitedExclusion.violations.length > 0) return false;
  for (const key of flags) {
    if (c.controlB_prohibitedExclusion[key as keyof typeof c.controlB_prohibitedExclusion] !== true) return false;
  }
  if (!c.controlC_textileFidelity.passed || !c.controlC_textileFidelity.silhouetteIntact) return false;
  if (!c.controlD_compositionPose.passed || !c.controlD_compositionPose.posePreserved) return false;
  if (!c.controlE_technicalQuality.passed) return false;
  if (c.suggestedAction !== 'APPROVE') return false;

  // Atributos estructurales obligatorios que siempre deben verificarse (MATCH o POSSIBLE_MISMATCH)
  const coreAttrs = ['color', 'pattern', 'silhouette', 'texture'];
  for (const key of coreAttrs) {
    const val = data.attributes[key];
    if (val !== 'MATCH' && val !== 'POSSIBLE_MISMATCH') {
      return false;
    }
  }

  // Atributos dependientes de vista y ángulo (R04)
  const isBackView = candidateType === 'view_back' || candidateType?.toLowerCase().includes('back');
  const viewSensitiveAttrs = ['lapels', 'buttons', 'pockets', 'neckline'];

  for (const key of attributes) {
    const val = data.attributes[key];
    if (val === 'MISMATCH') return false;
    if (val === 'NOT_VISIBLE') {
      if (isBackView && viewSensitiveAttrs.includes(key)) {
        continue;
      }
      if (viewSensitiveAttrs.includes(key) || key === 'sleeves' || key === 'hem') {
        continue;
      }
      return false;
    }
    if (val !== 'MATCH' && val !== 'POSSIBLE_MISMATCH') {
      return false;
    }
  }

  return true;
}

