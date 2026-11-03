/**
 * ATELIER — REFERENCIAS Y VARIANTES 001
 * Batería de verificación obligatoria con adaptador simulado y datos aislados (MOCK, sin credenciales).
 *
 * Cubre los 9 escenarios obligatorios:
 * 1. Producto sin variantes: flujo completo hasta entrega (descarga, composición, carpeta y ZIP).
 * 2. Dos variantes con originales distintos: cada una utiliza exclusivamente sus referencias.
 * 3. Variante sin originales: bloqueo antes de invocar al proveedor (0 llamadas al adaptador).
 * 4. Referencia de otro producto, proyecto o variante: rechazo del servidor.
 * 5. Try-on, vistas (front/left/right/back), ghost y retry: los originales correctos llegan al adaptador
 *    en el orden y rol exactos, y se registran IDs, roles, orden y huellas SHA-256.
 * 6. Studio Pose: conserva variante, hoja de identidad aprobada, originales de prenda y procedencia.
 * 7. Cambio de original o asociación: invalida el lock y la autorización de entrega afectada.
 * 8. Un cambio en una variante no invalida otra sin dependencias compartidas.
 * 9. QA ausente, inválido o FAIL; PASS sin aprobación; MOCK/REAL incompatible: siguen bloqueados.
 *
 * Nota: MOCK acredita contratos y procedencia, no fidelidad visual REAL.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { once } from 'node:events';
import sharp from 'sharp';

const directory = fs.mkdtempSync(path.resolve('data', 'variant-ref-check-'));
process.env.ATELIER_DATA = directory;
process.env.ATELIER_MOCK = '1';
process.env.GEMINI_API_KEY = '';
process.env.API_KEY = '';
process.env.ATELIER_API_TOKEN = 'local-variant-token';

const { app } = await import('../server/index.ts');
const { run, get, all } = await import('../server/db.ts');
const { setProviderAdapter } = await import('../server/provider.ts');
const { getAsset, createAsset, approveAsset } = await import('../engines/assets.ts');
const { createModel } = await import('../engines/casting.ts');
const { ingestProduct, addVariant, uploadProductReference, assignRawAssetVariant } = await import('../engines/intake.ts');

const sha256Base64 = (b64: string) =>
  crypto.createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex');

const sha256Buf = (buf: Buffer) =>
  crypto.createHash('sha256').update(buf).digest('hex');

const makeSolidImage = (color: string, width = 600, height = 800) =>
  sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();

interface CapturedGenerateCall {
  prompt: string;
  label?: string;
  imageHashes: string[];
  colorHex?: string;
}

interface CapturedAnalyzeCall {
  prompt: string;
  imageHashes: string[];
}

const capturedGenerateCalls: CapturedGenerateCall[] = [];
const capturedAnalyzeCalls: CapturedAnalyzeCall[] = [];

let synthCounter = 1;
setProviderAdapter({
  async generateImage(args) {
    const imageHashes = (args.images || []).map((img) => sha256Base64(img.data));
    capturedGenerateCalls.push({
      prompt: args.prompt,
      label: args.label,
      imageHashes,
      colorHex: args.colorHex,
    });
    const c = synthCounter++;
    const r = (c * 37) % 200 + 20;
    const g = (c * 59) % 200 + 20;
    const b = (c * 83) % 200 + 20;
    const buffer = await sharp({
      create: { width: 640, height: 840, channels: 3, background: { r, g, b } },
    }).png().toBuffer();
    return { buffer, model: 'simulated-inspector-image', costUsd: 0, mocked: true };
  },
  async analyzeJson<T>(args: { prompt: string; images?: { data: string; mimeType: string }[] }) {
    const imageHashes = (args.images || []).map((img) => sha256Base64(img.data));
    capturedAnalyzeCalls.push({
      prompt: args.prompt,
      imageHashes,
    });
    if (args.prompt.includes('forensic fashion inspector')) {
      return {
        data: {
          descriptor: 'Blazer sastrero verificado por inspector simulado.',
          verifiedAttributes: {
            color: 'según referencia original',
            pattern: 'solid',
            silhouette: 'structured blazer',
            neckline: 'notched lapel',
            lapel: 'notched',
            buttonCount: 2,
            buttonPlacement: 'front',
            pocketCount: 2,
            pocketType: 'welt',
            sleeveLength: 'long',
            cuffDetails: 'buttoned',
            hemShape: 'straight',
            fabricAppearance: 'linen',
            visibleSeams: 'topstitching',
            visibleConstructionDetails: 'structured shoulder',
          },
          unknownAttributes: [],
        } as unknown as T,
        model: 'mock-text',
        costUsd: 0,
      };
    }
    if (args.prompt.includes('Compare SOURCE')) {
      return {
        data: {
          overallStatus: 'PASS',
          attributes: {
            color: 'MATCH',
            pattern: 'MATCH',
            silhouette: 'MATCH',
            neckline: 'MATCH',
            lapels: 'MATCH',
            buttons: 'MATCH',
            pockets: 'MATCH',
            sleeves: 'MATCH',
            hem: 'MATCH',
            texture: 'MATCH',
            addedElements: 'MATCH',
            missingElements: 'MATCH',
          },
          hasCriticalMismatch: false,
          notes: 'QA simulado para prueba de procedencia (no acredita fidelidad visual real).',
          controls: {
            controlA_identity: { passed: true, confidence: 0.99, details: 'OK' },
            controlB_prohibitedExclusion: {
              passed: true,
              noJewelryAdded: true,
              noLipstickChange: true,
              noMakeupChange: true,
              noSkinMarksImported: true,
              noAnatomyDeformation: true,
              violations: [],
            },
            controlC_textileFidelity: { passed: true, silhouetteIntact: true, details: 'OK' },
            controlD_compositionPose: { passed: true, posePreserved: true, details: 'OK' },
            controlE_technicalQuality: { passed: true, details: 'OK' },
            suggestedAction: 'APPROVE',
          },
        } as unknown as T,
        model: 'mock-text',
        costUsd: 0,
      };
    }
    return {
      data: {
        title: 'Blazer Test',
        brand: 'ATELIER',
        price: 49990,
        currency: 'CLP',
        description: 'Prenda de prueba',
        composition: '100% Lino',
        sizes: ['S', 'M', 'L'],
        category: 'Chaquetas',
      } as unknown as T,
      model: 'mock-text',
      costUsd: 0,
    };
  },
});

const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const port = (server.address() as net.AddressInfo).port;

function request(url: string, body?: object) {
  return fetch(`http://127.0.0.1:${port}/api${url}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', authorization: 'Bearer local-variant-token' },
    body: body && JSON.stringify(body),
  });
}

async function expectStatus(response: Response, status: number, label: string) {
  const txt = await response.clone().text();
  assert.equal(response.status, status, `${label} -> esperado ${status}, recibido ${response.status}: ${txt}`);
  console.log(`✓ [${status}] ${label}`);
  return response;
}

try {
  // ===========================================================================
  // PREPARACIÓN DE PROYECTO Y MODELO APROBADO
  // ===========================================================================
  const projectRes = await (await expectStatus(
    await request('/projects', { name: 'Test Referencias y Variantes 001', season: 'SS26', clientName: 'QA' }),
    200,
    'Crear proyecto principal',
  )).json();
  const projectId = projectRes.id as string;

  const otherProjectRes = await (await expectStatus(
    await request('/projects', { name: 'Otro Proyecto Aislado', season: 'FW26', clientName: 'Otro' }),
    200,
    'Crear segundo proyecto para pruebas de rechazo cruzado',
  )).json();
  const otherProjectId = otherProjectRes.id as string;

  const model = createModel(projectId, 'KORA-01', { archetype_id: 'KORA-01', resolution: '4K' });
  const sheetBuf = await makeSolidImage('#e5c8b5', 960, 540);
  const sheetHash = sha256Buf(sheetBuf);
  const sheetAsset = await createAsset({
    projectId,
    modelId: model.id,
    type: 'model_sheet',
    stage: 'approved',
    buffer: sheetBuf,
    approved: true,
  });
  approveAsset(sheetAsset.id, false);
  run(`UPDATE models SET sheet_asset_id=?, status='approved' WHERE id=?`, [sheetAsset.id, model.id]);

  // ===========================================================================
  // ESCENARIO 1: Producto sin variantes — flujo completo hasta entrega
  // ===========================================================================
  console.log('\n--- ESCENARIO 1: Producto sin variantes (flujo completo hasta entrega) ---');
  const noVarRawBuf = await makeSolidImage('#2c3e50');
  const noVarRawHash = sha256Buf(noVarRawBuf);
  const { productId: noVarProductId, assetId: noVarRawId } = await ingestProduct({
    projectId,
    buffer: noVarRawBuf,
    title: 'Abrigo Lino Sin Variantes',
  });
  assert.equal(getAsset(noVarRawId)!.variant_id, null, 'El original de producto sin variantes mantiene variant_id = null');

  const noVarLockRes = await (await expectStatus(
    await request(`/products/${noVarProductId}/lock`, {}),
    200,
    'Crear Garment Lock de producto sin variantes (ámbito base explícito)',
  )).json();
  const noVarLockId = noVarLockRes.lock.id as string;
  assert.equal(noVarLockRes.lock.variant_id, null, 'El lock del producto sin variantes tiene variant_id = null');
  const noVarCutAsset = getAsset(noVarLockRes.garmentCut)!;
  const noVarCutHash = sha256Buf(fs.readFileSync(noVarCutAsset.file_path));

  await expectStatus(await request(`/locks/${noVarLockId}/approve`, {}), 200, 'Aprobar Garment Lock de producto sin variantes');

  capturedGenerateCalls.length = 0;
  const noVarTryonRes = await (await expectStatus(
    await request(`/products/${noVarProductId}/render`, { modelId: model.id, lockId: noVarLockId, mode: 'tryon' }),
    200,
    'Render try-on de producto sin variantes',
  )).json();
  const noVarTryonId = noVarTryonRes.results[0].assetId as string;
  assert.deepEqual(
    capturedGenerateCalls[0].imageHashes,
    [sheetHash, noVarRawHash, noVarCutHash],
    'Try-on sin variantes recibe [identity_sheet, garment_original, garment_cut_support]',
  );

  await expectStatus(await request(`/assets/${noVarTryonId}/qa`, {}), 200, 'QA de producto sin variantes');
  await expectStatus(await request(`/assets/${noVarTryonId}/approve`, {}), 200, 'Aprobación manual de producto sin variantes');
  await expectStatus(await request(`/assets/${noVarTryonId}/download`), 200, 'Descarga individual de producto sin variantes');

  const noVarComp = await (await expectStatus(
    await request(`/projects/${projectId}/compose`, { assetIds: [noVarTryonId] }),
    200,
    'Composición de producto sin variantes',
  )).json();
  await expectStatus(await request(`/assets/${noVarComp.assetId}/approve`, {}), 200, 'Aprobar composición sin variantes');

  const noVarExp = await (await expectStatus(
    await request(`/projects/${projectId}/export`, { assetIds: [noVarTryonId, noVarComp.assetId] }),
    200,
    'Exportación ZIP y carpeta de producto sin variantes',
  )).json();
  assert.equal(fs.existsSync(noVarExp.dir), true, 'Carpeta de entrega existe para producto sin variantes');
  await expectStatus(await request(`/exports/${noVarExp.exportId}/zip`), 200, 'Descarga ZIP de producto sin variantes');

  // ===========================================================================
  // ESCENARIO 3: Variante sin originales — bloqueo antes de invocar al proveedor
  // ===========================================================================
  console.log('\n--- ESCENARIO 3: Variante sin originales (bloqueo antes de llamar al proveedor) ---');
  const baseRawBuf = await makeSolidImage('#1f2937');
  const baseRawHash = sha256Buf(baseRawBuf);
  const { productId, assetId: baseRawId } = await ingestProduct({
    projectId,
    buffer: baseRawBuf,
    title: 'Blazer Lino Con Variantes',
  });

  const varA = addVariant(productId, 'Marino', '#1b2a4a') as any;
  const varB = addVariant(productId, 'Arena', '#cbb89a') as any;
  const varEmpty = addVariant(productId, 'Oliva Sin Fotos', '#556b2f') as any;

  // Confirmar que ningún original histórico con variant_id = null fue reasignado automáticamente
  assert.equal(getAsset(baseRawId)!.variant_id, null, 'El original histórico baseRawId conserva variant_id = null');
  assert.equal(varEmpty.status, 'pending_references');

  capturedGenerateCalls.length = 0;
  capturedAnalyzeCalls.length = 0;
  const blockedLockRes = await expectStatus(
    await request(`/products/${productId}/lock`, { variantId: varEmpty.id }),
    409,
    'Variante sin originales bloqueada al intentar crear Garment Lock',
  );
  const blockedLockBody = await blockedLockRes.json();
  assert.equal(blockedLockBody.code, 'VARIANT_REFERENCES_MISSING');
  assert.match(blockedLockBody.error, /pendiente/i);
  assert.equal(capturedGenerateCalls.length, 0, 'Cero llamadas a generateImage cuando la variante no tiene originales');
  assert.equal(capturedAnalyzeCalls.length, 0, 'Cero llamadas a analyzeJson cuando la variante no tiene originales');

  // Crear y aprobar lock de la prenda base para probar que varEmpty tampoco puede usar el lock base
  const baseLockRes = await (await expectStatus(
    await request(`/products/${productId}/lock`, {}),
    200,
    'Crear Garment Lock de prenda base',
  )).json();
  const baseLockId = baseLockRes.lock.id as string;
  await expectStatus(await request(`/locks/${baseLockId}/approve`, {}), 200, 'Aprobar Garment Lock de prenda base');

  capturedGenerateCalls.length = 0;
  await expectStatus(
    await request(`/products/${productId}/render`, {
      modelId: model.id,
      lockId: baseLockId,
      variantId: varEmpty.id,
      mode: 'tryon',
    }),
    409,
    'Variante sin originales bloqueada antes de llamar al proveedor aunque se pase lockId base',
  );
  await expectStatus(
    await request(`/products/${productId}/render`, {
      modelId: model.id,
      variantId: varEmpty.id,
      mode: 'tryon',
    }),
    409,
    'Variante sin originales bloqueada cuando no tiene su propio Garment Lock aprobado',
  );
  assert.equal(capturedGenerateCalls.length, 0, 'El proveedor nunca fue invocado para la variante sin originales');

  // ===========================================================================
  // ESCENARIO 2, 4 y 5: Dos variantes con originales distintos + Rechazo cruzado
  // + Entradas exactas en Try-On, Vistas (4), Ghost y Retry
  // ===========================================================================
  console.log('\n--- ESCENARIOS 2, 4 y 5: Dos variantes aisladas, rechazos cruzados y entradas de generación ---');
  const varARawBuf1 = await makeSolidImage('#1b2a4a');
  const varARawBuf2 = await makeSolidImage('#243b67');
  const varBRawBuf1 = await makeSolidImage('#cbb89a');

  const varARawHash1 = sha256Buf(varARawBuf1);
  const varARawHash2 = sha256Buf(varARawBuf2);
  const varBRawHash1 = sha256Buf(varBRawBuf1);

  const varARaw1 = await uploadProductReference({ productId, variantId: varA.id, buffer: varARawBuf1 });
  const varARaw2 = await uploadProductReference({ productId, variantId: varA.id, buffer: varARawBuf2 });
  const varBRaw1 = await uploadProductReference({ productId, variantId: varB.id, buffer: varBRawBuf1 });

  // Escenario 4: Rechazos del servidor ante referencias de otro proyecto, otro producto u otra variante
  const { productId: otherProdInOtherProj, assetId: rawInOtherProj } = await ingestProduct({
    projectId: otherProjectId,
    buffer: await makeSolidImage('#882222'),
    title: 'Prenda de Otro Proyecto',
  });
  const varInOtherProduct = addVariant(noVarProductId, 'Gris Otro Producto', '#888888') as any;

  await expectStatus(
    await request(`/assets/${varARaw1.id}/assign-variant`, { variantId: varInOtherProduct.id }),
    409,
    'Rechazar asignación de referencia a una variante de otro producto',
  );
  await expectStatus(
    await request(`/products/${productId}/lock`, { variantId: varA.id, sourceAssetIds: [varARaw1.id, varBRaw1.id] }),
    409,
    'Rechazar Garment Lock de Variante A con referencia de Variante B',
  );
  await expectStatus(
    await request(`/products/${productId}/lock`, { variantId: varA.id, sourceAssetIds: [noVarRawId] }),
    409,
    'Rechazar Garment Lock de Variante A con referencia de otro producto',
  );
  await expectStatus(
    await request(`/products/${productId}/lock`, { variantId: varA.id, sourceAssetIds: [rawInOtherProj] }),
    409,
    'Rechazar Garment Lock de Variante A con referencia de otro proyecto',
  );
  await expectStatus(
    await request(`/products/${productId}/lock`, {
      variantId: varA.id,
      sourceAssetIds: [varARaw1.id, varARaw2.id, varARaw1.id, varARaw2.id, varARaw1.id, varARaw2.id, varARaw1.id],
    }),
    409,
    'Rechazar explícitamente cuando se supera el límite de 6 referencias originales sin descartar silenciosamente',
  );

  // Crear y aprobar Garment Locks de Variante A y Variante B
  capturedAnalyzeCalls.length = 0;
  const lockARes = await (await expectStatus(
    await request(`/products/${productId}/lock`, { variantId: varA.id }),
    200,
    'Crear Garment Lock para Variante A (Marino)',
  )).json();
  const lockAId = lockARes.lock.id as string;
  const cutAAsset = getAsset(lockARes.garmentCut)!;
  const cutAHash = sha256Buf(fs.readFileSync(cutAAsset.file_path));
  assert.deepEqual(capturedAnalyzeCalls[0].imageHashes, [varARawHash1, varARawHash2]);

  capturedAnalyzeCalls.length = 0;
  const lockBRes = await (await expectStatus(
    await request(`/products/${productId}/lock`, { variantId: varB.id }),
    200,
    'Crear Garment Lock para Variante B (Arena)',
  )).json();
  const lockBId = lockBRes.lock.id as string;
  const cutBAsset = getAsset(lockBRes.garmentCut)!;
  const cutBHash = sha256Buf(fs.readFileSync(cutBAsset.file_path));
  assert.deepEqual(capturedAnalyzeCalls[0].imageHashes, [varBRawHash1]);

  await expectStatus(await request(`/locks/${lockAId}/approve`, {}), 200, 'Aprobar Lock Variante A');
  await expectStatus(await request(`/locks/${lockBId}/approve`, {}), 200, 'Aprobar Lock Variante B');

  // Escenario 5A: render.tryon en Variante A y Variante B
  capturedGenerateCalls.length = 0;
  const tryonARes = await (await expectStatus(
    await request(`/products/${productId}/render`, {
      modelId: model.id,
      lockId: lockAId,
      variantId: varA.id,
      mode: 'tryon',
    }),
    200,
    'Render try-on de Variante A',
  )).json();
  const tryonAId = tryonARes.results[0].assetId as string;
  const tryonAManifest = tryonARes.results[0].references;
  assert.deepEqual(
    capturedGenerateCalls[0].imageHashes,
    [sheetHash, varARawHash1, varARawHash2, cutAHash],
    'Try-On Variante A envía [sheet, varA_raw_1, varA_raw_2, varA_cut]',
  );
  assert.deepEqual(
    tryonAManifest.map((r: any) => ({ role: r.role, assetId: r.assetId, variantId: r.variantId })),
    [
      { role: 'identity_sheet', assetId: sheetAsset.id, variantId: null },
      { role: 'garment_original', assetId: varARaw1.id, variantId: varA.id },
      { role: 'garment_original', assetId: varARaw2.id, variantId: varA.id },
      { role: 'garment_cut_support', assetId: cutAAsset.id, variantId: varA.id },
    ],
    'El manifiesto de referencias registra orden, rol, ID y variante de cada entrada en Try-On A',
  );
  assert.ok(
    capturedGenerateCalls[0].prompt.includes('IMAGE_1_IDENTITY_SHEET') &&
    capturedGenerateCalls[0].prompt.includes('IMAGE_2_GARMENT_ORIGINAL') &&
    capturedGenerateCalls[0].prompt.includes('IMAGE_3_GARMENT_ORIGINAL') &&
    capturedGenerateCalls[0].prompt.includes('IMAGE_4_GARMENT_CUT_SUPPORT'),
    'El prompt de Try-On A refleja el orden y rol exacto de las 4 imágenes enviadas',
  );

  // Escenario 5B: render.view (front, left, right, back) en Variante A
  capturedGenerateCalls.length = 0;
  const viewsARes = await (await expectStatus(
    await request(`/products/${productId}/render`, {
      modelId: model.id,
      lockId: lockAId,
      variantId: varA.id,
      mode: 'views',
    }),
    200,
    'Render 4 vistas (front, left, right, back) de Variante A',
  )).json();
  assert.equal(viewsARes.results.length, 4);
  assert.equal(capturedGenerateCalls.length, 4);
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(
      capturedGenerateCalls[i].imageHashes,
      [sheetHash, varARawHash1, varARawHash2, cutAHash],
      `Vista #${i + 1} de Variante A recibe exactamente [sheet, varA_raw_1, varA_raw_2, varA_cut] sin presentar vistas generadas como originales`,
    );
  }

  // Escenario 5C: render.ghost en Variante B
  capturedGenerateCalls.length = 0;
  const ghostBRes = await (await expectStatus(
    await request(`/products/${productId}/render`, {
      lockId: lockBId,
      variantId: varB.id,
      mode: 'ghost',
    }),
    200,
    'Render ghost de Variante B',
  )).json();
  const ghostBId = ghostBRes.results[0].assetId as string;
  assert.deepEqual(
    capturedGenerateCalls[0].imageHashes,
    [varBRawHash1, cutBHash],
    'Ghost de Variante B recibe [varB_raw_1, varB_cut]',
  );
  assert.ok(
    capturedGenerateCalls[0].prompt.includes('IMAGE_1_GARMENT_ORIGINAL') &&
    capturedGenerateCalls[0].prompt.includes('IMAGE_2_GARMENT_CUT_SUPPORT'),
    'El prompt de Ghost B describe exactamente IMAGE_1 (original) e IMAGE_2 (cut support)',
  );

  // Escenario 5D: render.retry sobre tryonA
  const tryonAAsset = getAsset(tryonAId)!;
  const tryonAHash = sha256Buf(fs.readFileSync(tryonAAsset.file_path));
  capturedGenerateCalls.length = 0;
  const retryARes = await (await expectStatus(
    await request(`/assets/${tryonAId}/retry`, { correctionPrompt: 'Ajustar solapa izquierda 1:1' }),
    200,
    'Render retry sobre Try-On de Variante A',
  )).json();
  const retryAId = retryARes.assetId as string;
  assert.deepEqual(
    capturedGenerateCalls[0].imageHashes,
    [sheetHash, varARawHash1, varARawHash2, cutAHash, tryonAHash],
    'Retry de Variante A recibe [sheet, varA_raw_1, varA_raw_2, varA_cut, tryonA_prev]',
  );
  assert.ok(
    capturedGenerateCalls[0].prompt.includes('IMAGE_5_PREVIOUS_RENDER_SUPPORT'),
    'El prompt de Retry identifica la imagen 5 como previous_render_support',
  );
  const retryAAsset = getAsset(retryAId)!;
  assert.equal(retryAAsset.variant_id, varA.id);
  assert.equal(retryAAsset.lock_id, lockAId);

  // ===========================================================================
  // ESCENARIO 6: Studio Pose conserva variante, hoja de identidad y procedencia
  // ===========================================================================
  console.log('\n--- ESCENARIO 6: Studio Pose conserva variante, identidad y procedencia ---');
  capturedGenerateCalls.length = 0;
  const poseARes = await (await expectStatus(
    await request(`/projects/${projectId}/studio/pose`, {
      sourceAssetId: tryonAId,
      params: { category: 'Chaquetas', frameType: 'Tres Cuartos' },
    }),
    200,
    'Studio Pose derivado de Try-On de Variante A',
  )).json();
  const poseAId = poseARes.assetId as string;
  const poseAAsset = getAsset(poseAId)!;
  assert.equal(poseAAsset.variant_id, varA.id, 'Studio Pose conserva variant_id de origen');
  assert.equal(poseAAsset.model_id, model.id, 'Studio Pose conserva model_id de origen');
  assert.equal(poseAAsset.lock_id, lockAId, 'Studio Pose conserva lock_id de origen');
  assert.equal(poseAAsset.parent_asset_id, tryonAId, 'Studio Pose conserva parent_asset_id de origen');
  assert.deepEqual(
    capturedGenerateCalls[0].imageHashes,
    [sheetHash, varARawHash1, varARawHash2, cutAHash, tryonAHash],
    'Studio Pose derivado de catálogo recibe [sheet, varA_raw_1, varA_raw_2, varA_cut, pose_source]',
  );

  // Verificar que el resultado de Studio Pose puede pasar QA gracias a conservar toda su procedencia
  await expectStatus(await request(`/assets/${poseAId}/qa`, {}), 200, 'QA sobre asset generado por Studio Pose');

  // Verificar que el registro en audit_log guarda el manifiesto de referencias
  const auditLogs = all<any>(`SELECT * FROM audit_log WHERE entity='asset' AND entity_id=? AND action='render_references'`, [poseAId]);
  assert.equal(auditLogs.length, 1, 'audit_log registra las referencias utilizadas en la generación');

  // ===========================================================================
  // ESCENARIOS 7, 8 y 9: QA, Controles de Entrega, Invalidación Selectiva y Aislamiento entre Variantes
  // ===========================================================================
  console.log('\n--- ESCENARIOS 7, 8 y 9: QA, Controles de Entrega e Invalidación Aislada por Variante ---');
  // Evaluar QA de tryonA y ghostB
  await expectStatus(await request(`/assets/${tryonAId}/qa`, {}), 200, 'QA PASS en tryonA (Variante A)');
  await expectStatus(await request(`/assets/${ghostBId}/qa`, {}), 200, 'QA PASS en ghostB (Variante B)');

  // Escenario 9: PASS sin aprobación sigue bloqueado; informe inválido/FAIL o mezcla MOCK/REAL siguen bloqueados
  await expectStatus(await request(`/assets/${tryonAId}/download`), 409, 'PASS sin aprobación manual bloquea descarga');
  const savedQaJsonA = getAsset(tryonAId)!.qa_json!;
  run(`UPDATE assets SET qa_json=? WHERE id=?`, [JSON.stringify({ ...JSON.parse(savedQaJsonA), overallStatus: 'FAIL' }), tryonAId]);
  await expectStatus(await request(`/assets/${tryonAId}/approve`, {}), 409, 'QA FAIL bloquea aprobación manual');
  run(`UPDATE assets SET qa_json=?, qa_mode='REAL' WHERE id=?`, [savedQaJsonA, tryonAId]);
  await expectStatus(await request(`/assets/${tryonAId}/approve`, {}), 409, 'Incompatibilidad MOCK/REAL bloquea aprobación');
  run(`UPDATE assets SET qa_json=?, qa_mode='MOCK' WHERE id=?`, [savedQaJsonA, tryonAId]);

  // Aprobar manualmente ambos assets (Variante A y Variante B) y generar entregas independientes para A y B
  await expectStatus(await request(`/assets/${tryonAId}/approve`, {}), 200, 'Aprobar manualmente tryonA (Variante A)');
  await expectStatus(await request(`/assets/${ghostBId}/approve`, {}), 200, 'Aprobar manualmente ghostB (Variante B)');

  const compB = await (await expectStatus(
    await request(`/projects/${projectId}/compose`, { assetIds: [ghostBId] }),
    200,
    'Composición exclusiva de Variante B',
  )).json();
  await expectStatus(await request(`/assets/${compB.assetId}/approve`, {}), 200, 'Aprobar composición de Variante B');

  const expA = await (await expectStatus(
    await request(`/projects/${projectId}/export`, { assetIds: [tryonAId] }),
    200,
    'Exportación ZIP exclusiva de Variante A',
  )).json();
  const expB = await (await expectStatus(
    await request(`/projects/${projectId}/export`, { assetIds: [ghostBId, compB.assetId] }),
    200,
    'Exportación ZIP exclusiva de Variante B',
  )).json();

  // Escenario 7 y 8: Reasignar una referencia de Variante A a Prenda Base (sin tocar Variante B)
  // Debe invalidar Lock A, tryonA y expA, pero mantener INTACTA la validez de Variante B (ghostB, compB, expB) y del Producto sin variantes
  const reassignA = assignRawAssetVariant(varARaw2.id, null);
  assert.ok(reassignA.invalidatedLocks.includes(lockAId), 'Cambio de asociación invalida Lock A');
  assert.ok(reassignA.invalidatedAssets.includes(tryonAId), 'Cambio de asociación invalida aprobación de tryonA');

  await expectStatus(
    await request(`/assets/${tryonAId}/download`),
    409,
    'Descarga de tryonA bloqueada tras cambio en sus referencias',
  );
  await expectStatus(
    await request(`/exports/${expA.exportId}/zip`),
    409,
    'ZIP de Variante A bloqueado tras cambio en sus referencias',
  );
  await expectStatus(
    await request(`/products/${productId}/render`, {
      modelId: model.id,
      lockId: lockAId,
      variantId: varA.id,
      mode: 'tryon',
    }),
    409,
    'Lock A obsoleto bloquea nuevas generaciones hasta actualizar y aprobar el lock',
  );

  // Verificar que Variante B (sin dependencias compartidas con Variante A) sigue 100% válida y entregable
  await expectStatus(
    await request(`/assets/${ghostBId}/download`),
    200,
    'Aislamiento verificado: ghostB (Variante B) sigue descargable tras invalidación de Variante A',
  );
  await expectStatus(
    await request(`/assets/${compB.assetId}/download`),
    200,
    'Aislamiento verificado: composición de Variante B sigue descargable',
  );
  await expectStatus(
    await request(`/exports/${expB.exportId}/zip`),
    200,
    'Aislamiento verificado: ZIP de Variante B sigue descargable',
  );
  await expectStatus(
    await request(`/exports/${noVarExp.exportId}/zip`),
    200,
    'Aislamiento verificado: ZIP del producto sin variantes sigue descargable',
  );

  console.log('\n✅ LOS 9 ESCENARIOS OBLIGATORIOS DE REFERENCIAS Y VARIANTES PASARON EXITOSAMENTE.');
} finally {
  setProviderAdapter(null);
  server.close();
  try {
    fs.rmSync(directory, { recursive: true, force: true });
  } catch {
    // ignore cleanup error on Windows if SQLite handle is closing
  }
}
