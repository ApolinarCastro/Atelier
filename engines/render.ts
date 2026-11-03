import { get, audit } from '../server/db.ts';
import { register } from '../server/queue.ts';
import { generateImage } from '../server/provider.ts';
import { tryOnPrompt, viewPrompt, ghostPrompt, buildCorrectiveRetryPrompt, poseStudioPrompt } from './prompts.ts';
import { createAsset, assetImage, getAsset } from './assets.ts';
import { GateError, requireApprovedLock, requireApprovedModel } from '../server/gates.ts';
import { fingerprint } from '../server/qa-evidence.ts';
import type { GarmentDNA, AssetType, Asset, ReferenceManifestEntry } from '../shared/types.ts';

const MAX_PROVIDER_REFERENCES = 8;
const MAX_LOCK_ORIGINALS = 6;

function loadVariant(variantId?: string, productId?: string, projectId?: string) {
  if (!variantId) return undefined;
  const v = get<any>(`SELECT * FROM variants WHERE id=?`, [variantId]);
  if (!v) throw new GateError('VARIANT_NOT_FOUND', `La variante ${variantId} no existe`);
  if (productId && v.product_id !== productId) {
    throw new GateError('VARIANT_PRODUCT_MISMATCH', 'La variante seleccionada no pertenece a la prenda');
  }
  if (projectId) {
    const prod = get<any>(`SELECT project_id FROM products WHERE id=?`, [v.product_id]);
    if (!prod || prod.project_id !== projectId) {
      throw new GateError('PROJECT_PRODUCT_MISMATCH', 'La variante o prenda no pertenece al proyecto activo');
    }
  }
  return {
    id: v.id as string,
    product_id: v.product_id as string,
    color_name: v.color_name as string,
    color_hex: v.color_hex as string | undefined,
  };
}

function loadLock(lockId: string, expectedVariantId?: string | null, expectedProductId?: string, expectedProjectId?: string) {
  const lock = requireApprovedLock(lockId, expectedVariantId);
  if (expectedProductId && lock.product_id !== expectedProductId) {
    throw new GateError('LOCK_PRODUCT_MISMATCH', 'El Garment Lock no pertenece al producto solicitado');
  }
  const prod = get<any>(`SELECT * FROM products WHERE id=?`, [lock.product_id]);
  if (!prod) throw new GateError('PRODUCT_NOT_FOUND', 'El producto del Garment Lock no existe');
  if (expectedProjectId && prod.project_id !== expectedProjectId) {
    throw new GateError('LOCK_PROJECT_MISMATCH', 'El Garment Lock pertenece a otro proyecto');
  }
  const dna: GarmentDNA = JSON.parse(lock.garment_dna_json || '{}');
  let rawIds: string[] = [];
  try {
    rawIds = JSON.parse(lock.source_asset_ids_json || '[]');
  } catch {
    rawIds = [];
  }
  if (rawIds.length > MAX_LOCK_ORIGINALS) {
    throw new GateError(
      'REFERENCE_LIMIT_EXCEEDED',
      `El Garment Lock contiene ${rawIds.length} originales, superando el máximo de ${MAX_LOCK_ORIGINALS} referencias permitidas por el proveedor.`,
    );
  }
  const originals: Asset[] = rawIds.map((id) => {
    const a = getAsset(id);
    if (!a || a.type !== 'garment_raw') {
      throw new GateError('LOCK_REFERENCES_MISSING', `Fotografía original ${id} no disponible`);
    }
    return a;
  });
  const cut = get<Asset>(
    `SELECT * FROM assets WHERE lock_id=? AND type='garment_cut' ORDER BY created_at DESC LIMIT 1`,
    [lockId],
  );
  return { lock, dna, originals, cut, product: prod };
}

async function assembleProviderReferences(items: {
  asset: Asset;
  role: ReferenceManifestEntry['role'];
}[]) {
  if (items.length > MAX_PROVIDER_REFERENCES) {
    throw new GateError(
      'REFERENCE_LIMIT_EXCEEDED',
      `La operación requiere ${items.length} imágenes de referencia, superando el límite máximo de ${MAX_PROVIDER_REFERENCES} entradas del proveedor. No se descartan originales silenciosamente.`,
    );
  }
  const images: { data: string; mimeType: string }[] = [];
  const manifest: ReferenceManifestEntry[] = [];
  for (let idx = 0; idx < items.length; idx++) {
    const { asset, role } = items[idx];
    const fp = fingerprint(asset);
    const img = await assetImage(asset.id);
    images.push(img);
    manifest.push({
      order: idx,
      imageIndex: idx + 1,
      assetId: asset.id,
      role,
      type: asset.type,
      sha256: fp.sha256,
      variantId: asset.variant_id ?? null,
    });
  }
  return { images, manifest };
}

register('render.tryon', async (p) => {
  const { model, sheet: sheetAsset } = requireApprovedModel(p.modelId);
  if (p.projectId && model.project_id !== p.projectId) {
    throw new GateError('MODEL_PROJECT_MISMATCH', 'El modelo aprobado pertenece a otro proyecto');
  }
  const { dna, originals, cut, lock } = loadLock(p.lockId, p.variantId ?? null, p.productId, p.projectId);
  const variant = loadVariant(p.variantId ?? lock.variant_id ?? undefined, lock.product_id, p.projectId);

  const refItems: { asset: Asset; role: ReferenceManifestEntry['role'] }[] = [
    { asset: sheetAsset, role: 'identity_sheet' },
    ...originals.map((orig) => ({ asset: orig, role: 'garment_original' as const })),
    ...(cut ? [{ asset: cut, role: 'garment_cut_support' as const }] : []),
  ];
  const { images, manifest } = await assembleProviderReferences(refItems);

  const params = p.params || {};
  const presetTag = params.stylePresetId ? ` · ${params.stylePresetId}` : '';
  const g = await generateImage({
    prompt: tryOnPrompt(dna, { ...params, colorVariant: variant, referenceManifest: manifest }),
    images,
    aspectRatio: '3:4',
    label: variant ? `TRY-ON · ${variant.color_name}${presetTag}` : `TRY-ON${presetTag}`,
    seed: model?.seed,
    colorHex: variant?.color_hex,
  });

  const a = await createAsset({
    projectId: p.projectId,
    productId: lock.product_id,
    variantId: variant?.id ?? (lock.variant_id || undefined),
    modelId: p.modelId,
    type: 'tryon',
    stage: 'rendered',
    parentAssetId: originals[0].id,
    lockId: p.lockId,
    buffer: g.buffer,
    mocked: g.mocked,
  });
  audit('asset', a.id, 'render_references', { operation: 'render.tryon', references: manifest });
  return { assetId: a.id, model: g.model, costUsd: g.costUsd, references: manifest };
});

const VIEW_TYPES: Record<string, AssetType> = {
  front: 'view_front',
  left: 'view_left',
  right: 'view_right',
  back: 'view_back',
};

register('render.view', async (p) => {
  const { model, sheet: sheetAsset } = requireApprovedModel(p.modelId);
  if (p.projectId && model.project_id !== p.projectId) {
    throw new GateError('MODEL_PROJECT_MISMATCH', 'El modelo aprobado pertenece a otro proyecto');
  }
  const { dna, originals, cut, lock } = loadLock(p.lockId, p.variantId ?? null, p.productId, p.projectId);
  const variant = loadVariant(p.variantId ?? lock.variant_id ?? undefined, lock.product_id, p.projectId);

  const refItems: { asset: Asset; role: ReferenceManifestEntry['role'] }[] = [
    { asset: sheetAsset, role: 'identity_sheet' },
    ...originals.map((orig) => ({ asset: orig, role: 'garment_original' as const })),
    ...(cut ? [{ asset: cut, role: 'garment_cut_support' as const }] : []),
  ];
  const { images, manifest } = await assembleProviderReferences(refItems);

  const g = await generateImage({
    prompt: viewPrompt(p.view, dna, p.lockId, variant, { ...(p.params || {}), referenceManifest: manifest }),
    images,
    aspectRatio: '3:4',
    label: `VISTA ${String(p.view).toUpperCase()}${variant ? ` · ${variant.color_name}` : ''}`,
    seed: model?.seed,
    colorHex: variant?.color_hex,
  });
  const a = await createAsset({
    projectId: p.projectId,
    productId: lock.product_id,
    variantId: variant?.id ?? (lock.variant_id || undefined),
    modelId: p.modelId,
    type: VIEW_TYPES[p.view] || 'view_front',
    stage: 'rendered',
    parentAssetId: originals[0].id,
    lockId: p.lockId,
    buffer: g.buffer,
    mocked: g.mocked,
  });
  audit('asset', a.id, 'render_references', { operation: 'render.view', view: p.view, references: manifest });
  return { assetId: a.id, view: p.view, model: g.model, costUsd: g.costUsd, references: manifest };
});

register('render.ghost', async (p) => {
  const { dna, originals, cut, lock } = loadLock(p.lockId, p.variantId ?? null, p.productId, p.projectId);
  const variant = loadVariant(p.variantId ?? lock.variant_id ?? undefined, lock.product_id, p.projectId);

  const refItems: { asset: Asset; role: ReferenceManifestEntry['role'] }[] = [
    ...originals.map((orig) => ({ asset: orig, role: 'garment_original' as const })),
    ...(cut ? [{ asset: cut, role: 'garment_cut_support' as const }] : []),
  ];
  const { images, manifest } = await assembleProviderReferences(refItems);

  const g = await generateImage({
    prompt: ghostPrompt(dna, variant, p.params?.additionalPrompt, manifest),
    images,
    aspectRatio: '3:4',
    label: variant ? `GHOST · ${variant.color_name}` : `GHOST · ${dna.lockCode || '3D'}`,
    colorHex: variant?.color_hex,
  });
  const a = await createAsset({
    projectId: p.projectId,
    productId: lock.product_id,
    variantId: variant?.id ?? (lock.variant_id || undefined),
    type: 'ghost',
    stage: 'rendered',
    parentAssetId: originals[0].id,
    lockId: p.lockId,
    buffer: g.buffer,
    mocked: g.mocked,
  });
  audit('asset', a.id, 'render_references', { operation: 'render.ghost', references: manifest });
  return { assetId: a.id, model: g.model, costUsd: g.costUsd, references: manifest };
});

/**
 * Integración Clone Studio V5: Reintento Asistido / Corrección Iterativa
 */
register('render.retry', async (p) => {
  const prevAsset = getAsset(p.assetId);
  if (!prevAsset) throw new GateError('ASSET_NOT_FOUND', 'Asset a corregir no encontrado');
  if (p.projectId && prevAsset.project_id !== p.projectId) {
    throw new GateError('ASSET_PROJECT_MISMATCH', 'El asset a corregir pertenece a otro proyecto');
  }

  const correction = String(p.correctionPrompt || 'Corregir fidelidad 1:1 de costuras, cuello y color.');

  if (!prevAsset.lock_id) {
    const { images, manifest } = await assembleProviderReferences([
      { asset: prevAsset, role: 'previous_render_support' },
    ]);
    const g = await generateImage({
      prompt: poseStudioPrompt({ ...(p.params || {}), correctionPrompt: correction, referenceManifest: manifest }),
      images,
      aspectRatio: '3:4',
      label: 'CORRECCIÓN STUDIO',
    });
    const a = await createAsset({
      projectId: prevAsset.project_id,
      productId: prevAsset.product_id || undefined,
      variantId: prevAsset.variant_id || undefined,
      modelId: prevAsset.model_id || undefined,
      type: 'retouched',
      stage: 'rendered',
      parentAssetId: prevAsset.id,
      buffer: g.buffer,
      mocked: g.mocked,
    });
    audit('asset', a.id, 'render_references', { operation: 'render.retry', references: manifest });
    return { assetId: a.id, parentAssetId: prevAsset.id, model: g.model, costUsd: g.costUsd, references: manifest };
  }

  const { dna, originals, cut, lock } = loadLock(prevAsset.lock_id, prevAsset.variant_id ?? null, prevAsset.product_id, prevAsset.project_id);
  const variant = loadVariant(prevAsset.variant_id || undefined, lock.product_id, prevAsset.project_id);

  const refItems: { asset: Asset; role: ReferenceManifestEntry['role'] }[] = [];
  let seed: string | undefined;
  if (prevAsset.model_id) {
    const { model, sheet: sheetAsset } = requireApprovedModel(prevAsset.model_id);
    if (model.project_id !== prevAsset.project_id) {
      throw new GateError('MODEL_PROJECT_MISMATCH', 'El modelo del render previo pertenece a otro proyecto');
    }
    refItems.push({ asset: sheetAsset, role: 'identity_sheet' });
    seed = model.seed;
  }
  for (const orig of originals) {
    refItems.push({ asset: orig, role: 'garment_original' });
  }
  if (cut) {
    refItems.push({ asset: cut, role: 'garment_cut_support' });
  }
  refItems.push({ asset: prevAsset, role: 'previous_render_support' });

  const { images, manifest } = await assembleProviderReferences(refItems);

  const g = await generateImage({
    prompt: buildCorrectiveRetryPrompt(dna, correction, { ...(p.params || {}), colorVariant: variant, referenceManifest: manifest }),
    images,
    aspectRatio: '3:4',
    label: `CORRECCIÓN V5 · ${dna.lockCode || 'RETRY'}`,
    seed,
    colorHex: variant?.color_hex,
  });

  const a = await createAsset({
    projectId: prevAsset.project_id,
    productId: lock.product_id,
    variantId: variant?.id ?? (lock.variant_id || undefined),
    modelId: prevAsset.model_id || undefined,
    type: prevAsset.type,
    stage: 'rendered',
    parentAssetId: prevAsset.id,
    lockId: prevAsset.lock_id,
    buffer: g.buffer,
    mocked: g.mocked,
  });
  audit('asset', a.id, 'render_references', { operation: 'render.retry', references: manifest });
  return { assetId: a.id, parentAssetId: prevAsset.id, model: g.model, costUsd: g.costUsd, references: manifest };
});


/**
 * Estudio Independiente de Dirección de Pose y Refinamiento Fotográfico
 * Conserva la variante y procedencia del asset de origen. Cuando deriva de un render
 * de catálogo con modelo y/o Garment Lock, incorpora la hoja de identidad aprobada
 * y las referencias originales y auxiliares de la prenda correspondiente.
 */
register('studio.pose', async (p) => {
  const srcAsset = getAsset(p.sourceAssetId);
  if (!srcAsset) throw new GateError('ASSET_NOT_FOUND', 'Imagen base no encontrada');
  if (p.projectId && srcAsset.project_id !== p.projectId) {
    throw new GateError('ASSET_PROJECT_MISMATCH', 'La imagen base pertenece a otro proyecto');
  }

  const refItems: { asset: Asset; role: ReferenceManifestEntry['role'] }[] = [];
  let seed: string | undefined;
  let variantColorHex: string | undefined;

  if (srcAsset.model_id) {
    const { model, sheet: sheetAsset } = requireApprovedModel(srcAsset.model_id);
    if (model.project_id !== srcAsset.project_id) {
      throw new GateError('MODEL_PROJECT_MISMATCH', 'El modelo asociado pertenece a otro proyecto');
    }
    refItems.push({ asset: sheetAsset, role: 'identity_sheet' });
    seed = model.seed;
  }

  if (srcAsset.lock_id) {
    const { originals, cut, lock } = loadLock(srcAsset.lock_id, srcAsset.variant_id ?? null, srcAsset.product_id, srcAsset.project_id);
    const variant = loadVariant(srcAsset.variant_id || undefined, lock.product_id, srcAsset.project_id);
    variantColorHex = variant?.color_hex;
    for (const orig of originals) {
      refItems.push({ asset: orig, role: 'garment_original' });
    }
    if (cut) {
      refItems.push({ asset: cut, role: 'garment_cut_support' });
    }
  }

  refItems.push({ asset: srcAsset, role: 'pose_source_support' });
  const { images, manifest } = await assembleProviderReferences(refItems);

  const params = p.params || {};
  const g = await generateImage({
    prompt: poseStudioPrompt({ ...params, referenceManifest: manifest }),
    images,
    aspectRatio: '3:4',
    label: `POSE · ${params.frameType || params.category || 'ESTUDIO'}`,
    seed,
    colorHex: variantColorHex,
  });
  const a = await createAsset({
    projectId: srcAsset.project_id,
    productId: srcAsset.product_id || undefined,
    variantId: srcAsset.variant_id || undefined,
    modelId: srcAsset.model_id || undefined,
    type: 'retouched',
    stage: 'rendered',
    parentAssetId: srcAsset.id,
    lockId: srcAsset.lock_id || undefined,
    buffer: g.buffer,
    mocked: g.mocked,
  });
  audit('asset', a.id, 'render_references', { operation: 'studio.pose', references: manifest });
  return { assetId: a.id, model: g.model, costUsd: g.costUsd, references: manifest };
});


/**
 * Ejecución Directa Multi-Estudio (Clone Studio V5 / Virtual Stylist Pro / Clonador 3D)
 * Permite operar cada estudio de forma autónoma sin obligar al flujo lineal único.
 */
register('studio.direct_clone', async (p) => {
  const { projectId, avatarAssetId, garmentAssetId, mode = 'tryon', params = {} } = p;
  if (!garmentAssetId) throw new Error('Selecciona o sube una imagen de prenda (Garment Source)');
  const garmentAsset = getAsset(garmentAssetId);
  if (!garmentAsset) throw new Error('Asset de prenda no encontrado');
  const garmentImg = await assetImage(garmentAssetId);

  const syntheticLock: GarmentDNA = {
    descriptor: params.garmentFocus || 'Prenda de referencia 1:1 en estudio directo',
    verifiedAttributes: {
      fabricAppearance: params.fabricType || 'Original',
      color: params.colorHex || '1:1 pixel match',
    },
    unknownAttributes: [],
    lockCode: 'VL-DIRECT',
  };

  if (mode === 'ghost') {
    const g = await generateImage({
      prompt: ghostPrompt(syntheticLock, params.colorHex ? { color_name: 'Custom', color_hex: params.colorHex } : undefined, params.additionalPrompt),
      images: [garmentImg],
      aspectRatio: '3:4',
      label: 'GHOST 3D · DIRECT',
      colorHex: params.colorHex,
    });
    const a = await createAsset({
      projectId,
      productId: garmentAsset.product_id || undefined,
      type: 'ghost',
      stage: 'rendered',
      parentAssetId: garmentAsset.id,
      buffer: g.buffer,
    mocked: g.mocked,
    });
    return { assetId: a.id, model: g.model, costUsd: g.costUsd };
  }

  const imgs = [garmentImg];
  if (avatarAssetId) {
    const avatarImg = await assetImage(avatarAssetId);
    imgs.unshift(avatarImg);
  }

  const viewMap: Record<string, AssetType> = {
    Frontal: 'tryon',
    front: 'view_front',
    left: 'view_left',
    right: 'view_right',
    back: 'view_back',
  };
  const viewKey = params.view || 'Frontal';

  const g = await generateImage({
    prompt: tryOnPrompt(syntheticLock, {
      ...params,
      colorVariant: params.colorHex ? { color_name: params.colorName || 'Variante', color_hex: params.colorHex } : undefined,
    }),
    images: imgs,
    aspectRatio: '3:4',
    label: `CLONE V5 · ${String(viewKey).toUpperCase()}`,
    colorHex: params.colorHex,
  });

  const a = await createAsset({
    projectId,
    productId: garmentAsset.product_id || undefined,
    type: viewMap[viewKey] || 'tryon',
    stage: 'rendered',
    parentAssetId: garmentAsset.id,
    buffer: g.buffer,
    mocked: g.mocked,
  });
  return { assetId: a.id, model: g.model, costUsd: g.costUsd };
});


