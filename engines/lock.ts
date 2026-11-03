import crypto from 'node:crypto';
import fs from 'node:fs';
import { get, run, now, uid, audit, all } from '../server/db.ts';
import { GateError } from '../server/gates.ts';
import { register } from '../server/queue.ts';
import { analyzeJson, generateImage } from '../server/provider.ts';
import { LOCK_ANALYSIS, ISOLATE } from './prompts.ts';
import { createAsset, assetImage, getAsset } from './assets.ts';
import { refreshVariantStatus } from './intake.ts';
import type { GarmentDNA, Asset } from '../shared/types.ts';

register('lock.analyze', async (p) => {
  const lock = get<any>(`SELECT * FROM locks WHERE id=?`, [p.lockId]);
  if (!lock) throw new GateError('LOCK_NOT_FOUND', `Lock no encontrado: ${p.lockId}`);
  const expectedVariantId = lock.variant_id ?? null;

  const assetIds: string[] = Array.isArray(p.sourceAssetIds) && p.sourceAssetIds.length
    ? p.sourceAssetIds
    : [p.sourceAssetId];
  if (assetIds.length > 6) {
    throw new GateError('REFERENCE_LIMIT_EXCEEDED', 'El número de referencias supera el máximo permitido de 6 originales por Garment Lock.');
  }

  const imgs = [];
  const sourceHashes: string[] = [];
  for (const id of assetIds) {

    const asset = getAsset(id);
    if (!asset || asset.type !== 'garment_raw' || asset.product_id !== lock.product_id ||
        (asset.variant_id ?? null) !== expectedVariantId) {
      throw new GateError(
        'LOCK_REFERENCE_SCOPE_INVALID',
        expectedVariantId
          ? `La referencia original ${id} no está asignada explícitamente a la variante ${expectedVariantId}.`
          : `La referencia original ${id} no pertenece al ámbito de la prenda base.`,
      );
    }
    if (fs.existsSync(asset.file_path)) {
      const buf = fs.readFileSync(asset.file_path);
      sourceHashes.push(crypto.createHash('sha256').update(buf).digest('hex'));
    }
    imgs.push(await assetImage(id));
  }

  const { data, model } = await analyzeJson<GarmentDNA>({
    prompt: LOCK_ANALYSIS,
    images: imgs,
  });

  const shortHash = (sourceHashes[0] || p.lockId).slice(0, 4).toUpperCase();
  const enrichedDna: GarmentDNA = {
    ...data,
    lockCode: `VL-${shortHash}`,
    sourceHashes,
    variantId: expectedVariantId,
  };

  run(`UPDATE locks SET garment_dna_json=?, status='review' WHERE id=?`, [
    JSON.stringify(enrichedDna),
    p.lockId,
  ]);
  refreshVariantStatus(expectedVariantId);
  audit('lock', p.lockId, 'analyzed', {
    lockCode: enrichedDna.lockCode,
    variantId: expectedVariantId,
    references: imgs.length,
  });
  return { lockId: p.lockId, dna: enrichedDna, model, costUsd: 0.001 };
});

register('lock.isolate', async (p) => {
  const lock = get<any>(`SELECT * FROM locks WHERE id=?`, [p.lockId]);
  if (!lock) throw new GateError('LOCK_NOT_FOUND', 'Lock no encontrado: ' + p.lockId);
  const expectedVariantId = lock.variant_id ?? null;

  let lockSourceIds: string[] = [];
  try {
    lockSourceIds = JSON.parse(lock.source_asset_ids_json || '[]');
  } catch {
    lockSourceIds = [];
  }
  const assetIds = Array.isArray(p.sourceAssetIds) && p.sourceAssetIds.length
    ? p.sourceAssetIds
    : lockSourceIds.length
      ? lockSourceIds
      : [p.sourceAssetId];
  if (assetIds.length > 6) {
    throw new GateError('REFERENCE_LIMIT_EXCEEDED', 'El número de referencias supera el máximo permitido de 6 originales por Garment Lock.');
  }

  const imgs = [];
  for (const id of assetIds) {

    const asset = getAsset(id);
    if (!asset || asset.type !== 'garment_raw' || asset.product_id !== lock.product_id ||
        (asset.variant_id ?? null) !== expectedVariantId) {
      throw new GateError(
        'LOCK_REFERENCE_SCOPE_INVALID',
        expectedVariantId
          ? `La referencia original ${id} no está asignada explícitamente a la variante ${expectedVariantId}.`
          : `La referencia original ${id} no pertenece al ámbito de la prenda base.`,
      );
    }
    imgs.push(await assetImage(id));
  }

  const dna: GarmentDNA = JSON.parse(lock.garment_dna_json || '{}');
  const g = await generateImage({
    prompt: `${ISOLATE}\n\nVisual Lock ID: ${dna.lockCode || p.lockId}\nLocked attributes to preserve 1:1: ${JSON.stringify(dna.verifiedAttributes || {})}`,
    images: imgs,
    aspectRatio: '3:4',
    label: `LOCK ${dna.lockCode || '1:1'} · aislada`,
  });
  const a = await createAsset({
    projectId: p.projectId,
    productId: lock.product_id,
    variantId: expectedVariantId || undefined,
    type: 'garment_cut',
    stage: 'locked',
    parentAssetId: assetIds[0],
    lockId: p.lockId,
    buffer: g.buffer,
  });
  run(`UPDATE locks SET status='awaiting_approval' WHERE id=?`, [p.lockId]);
  refreshVariantStatus(expectedVariantId);
  return { lockId: p.lockId, assetId: a.id, model: g.model, costUsd: g.costUsd };
});

export function resolveLockSources(productId: string, variantId?: string | null, explicitSourceAssetIds?: string[]) {
  const cleanVariantId = variantId ? String(variantId).trim() : null;
  if (Array.isArray(explicitSourceAssetIds) && explicitSourceAssetIds.length > 6) {
    throw new GateError(
      'REFERENCE_LIMIT_EXCEEDED',
      `Se enviaron ${explicitSourceAssetIds.length} referencias originales, pero el límite máximo por Garment Lock es de 6. Selecciona explícitamente hasta 6 fotografías originales; ATELIER no descarta originales silenciosamente.`,
    );
  }
  if (cleanVariantId) {
    const variant = get<any>(`SELECT * FROM variants WHERE id=? AND product_id=?`, [cleanVariantId, productId]);
    if (!variant) {
      throw new GateError('VARIANT_PRODUCT_MISMATCH', 'La variante seleccionada no pertenece a este producto');
    }
    const assigned = all<Asset>(
      `SELECT * FROM assets WHERE product_id=? AND variant_id=? AND type='garment_raw' ORDER BY created_at`,
      [productId, cleanVariantId],
    );
    if (Array.isArray(explicitSourceAssetIds) && explicitSourceAssetIds.length) {
      const explicitAssets = explicitSourceAssetIds.map((id) => {
        const a = getAsset(id);
        if (!a || a.type !== 'garment_raw' || a.product_id !== productId || (a.variant_id ?? null) !== cleanVariantId) {
          throw new GateError(
            'VARIANT_REFERENCE_MISMATCH',
            `La fotografía original ${id} no está asignada explícitamente a la variante "${variant.color_name}" (${cleanVariantId}).`,
          );
        }
        return a;
      });
      return explicitAssets.map((a) => a.id);
    }
    if (!assigned.length) {
      const unassignedCount = get<any>(
        `SELECT COUNT(*) AS c FROM assets WHERE product_id=? AND variant_id IS NULL AND type='garment_raw'`,
        [productId],
      )?.c || 0;
      const reason = unassignedCount > 0
        ? `La variante "${variant.color_name}" (${cleanVariantId}) está pendiente: existen ${unassignedCount} fotografía(s) original(es) en el producto sin asociación explícita a esta variante. Asígnalas manualmente o sube una fotografía propia para la variante antes de crear su Garment Lock.`
        : `La variante "${variant.color_name}" (${cleanVariantId}) está pendiente: falta subir o asignar al menos una fotografía original (garment_raw) propia antes de crear su Garment Lock.`;
      throw new GateError('VARIANT_REFERENCES_MISSING', reason);
    }
    if (assigned.length > 6) {
      throw new GateError(
        'REFERENCE_LIMIT_EXCEEDED',
        `La variante "${variant.color_name}" tiene ${assigned.length} fotografías originales asignadas, superando el límite de 6 referencias del proveedor. Indica explícitamente cuáles (hasta 6) usar en sourceAssetIds; no se descartan originales silenciosamente.`,
      );
    }
    return assigned.map((a) => a.id);
  }

  if (Array.isArray(explicitSourceAssetIds) && explicitSourceAssetIds.length) {
    for (const id of explicitSourceAssetIds) {
      const a = getAsset(id);
      if (!a || a.type !== 'garment_raw' || a.product_id !== productId || (a.variant_id ?? null) !== null) {
        throw new GateError(
          'BASE_LOCK_REFERENCE_MISMATCH',
          `La fotografía original ${id} no pertenece al ámbito base del producto (variant_id debe ser null).`,
        );
      }
    }
    return explicitSourceAssetIds;
  }

  const baseSources = all<Asset>(
    `SELECT * FROM assets WHERE product_id=? AND variant_id IS NULL AND type='garment_raw' ORDER BY created_at`,
    [productId],
  );
  if (!baseSources.length) {
    throw new GateError('PRODUCT_REFERENCES_MISSING', 'El producto no tiene fotografías originales (garment_raw) para la prenda base.');
  }
  if (baseSources.length > 6) {
    throw new GateError(
      'REFERENCE_LIMIT_EXCEEDED',
      `El producto tiene ${baseSources.length} fotografías originales en el ámbito base, superando el límite de 6 referencias del proveedor. Selecciona explícitamente hasta 6 en sourceAssetIds; no se descartan originales silenciosamente.`,
    );
  }
  return baseSources.map((s) => s.id);

}

export function createLock(productId: string, sourceAssetIds?: string[], variantId?: string | null) {
  const cleanVariantId = variantId ? String(variantId).trim() : null;
  const resolvedIds = resolveLockSources(productId, cleanVariantId, sourceAssetIds);
  const prevVersion = get<any>(
    `SELECT MAX(version) AS v FROM locks WHERE product_id=? AND COALESCE(variant_id, '') = COALESCE(?, '')`,
    [productId, cleanVariantId],
  )?.v || 0;
  const id = uid('lk_');
  run(
    `INSERT INTO locks(id, product_id, variant_id, source_asset_ids_json, status, version, created_at)
     VALUES(?,?,?,?,?,?,?)`,
    [id, productId, cleanVariantId, JSON.stringify(resolvedIds), 'pending', prevVersion + 1, now()],
  );
  refreshVariantStatus(cleanVariantId);
  return get(`SELECT * FROM locks WHERE id=?`, [id]);
}

export function approveLock(lockId: string) {
  const lock = get<any>(`SELECT * FROM locks WHERE id=?`, [lockId]);
  if (!lock) throw new GateError('LOCK_NOT_FOUND', 'El lock no existe');
  if (lock.status === 'stale_reference') {
    throw new GateError(
      'LOCK_STALE_REFERENCES',
      'Las referencias originales o su asociación cambiaron; debes crear y analizar un nuevo Garment Lock actualizado antes de aprobar.',
    );
  }
  const expectedVariantId = lock.variant_id ?? null;
  let rawIds: string[] = [];
  try {
    rawIds = JSON.parse(lock.source_asset_ids_json || '[]');
  } catch {
    rawIds = [];
  }
  if (!Array.isArray(rawIds) || !rawIds.length) {
    throw new GateError('LOCK_REFERENCES_MISSING', 'El Garment Lock no tiene referencias originales válidas');
  }
  const dna: GarmentDNA = JSON.parse(lock.garment_dna_json || '{}');
  const lockedHashes = Array.isArray(dna.sourceHashes) ? dna.sourceHashes : [];
  for (let i = 0; i < rawIds.length; i++) {
    const id = rawIds[i];
    const src = getAsset(id);
    if (!src || src.type !== 'garment_raw' || src.product_id !== lock.product_id || (src.variant_id ?? null) !== expectedVariantId) {
      throw new GateError('LOCK_REFERENCE_SCOPE_INVALID', `La referencia original ${id} ya no pertenece al ámbito del Garment Lock.`);
    }
    if (!fs.existsSync(src.file_path)) {
      throw new GateError('ASSET_FILE_MISSING', `Archivo no disponible para ${id}`);
    }
    const currentHash = crypto.createHash('sha256').update(fs.readFileSync(src.file_path)).digest('hex');
    if (lockedHashes[i] && lockedHashes[i] !== currentHash) {
      throw new GateError(
        'LOCK_STALE_REFERENCES',
        `El contenido de la referencia original ${id} cambió desde el análisis; actualiza el Garment Lock antes de aprobar.`,
      );
    }
  }
  run(`UPDATE locks SET approved=1, status='approved', approved_at=? WHERE id=?`, [now(), lockId]);
  refreshVariantStatus(expectedVariantId);
  audit('lock', lockId, 'approved', { variantId: expectedVariantId });
  return get(`SELECT * FROM locks WHERE id=?`, [lockId]);
}


