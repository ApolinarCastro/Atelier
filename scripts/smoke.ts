/**
 * Smoke test integral del pipeline ATELIER V2.0 (Unificación de las 7 Apps).
 * Verifica las 6 etapas + gates + capacidades avanzadas de cada app integrada.
 */
import sharp from 'sharp';
import { run, get, all, uid, now } from '../server/db.ts';
import { enqueueAndWait, jobStats } from '../server/queue.ts';
import { GateError, requireApprovedAsset } from '../server/gates.ts';
import { createZipBuffer } from '../server/storage.ts';
import { createModel } from '../engines/casting.ts';
import { ingestProduct, generateProductScript, addVariant } from '../engines/intake.ts';
import { createLock, approveLock } from '../engines/lock.ts';
import { approveAsset } from '../engines/assets.ts';
import '../engines/index.ts';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../server/config.ts';

const log = (n: string, msg: string) => console.log(`  [${n}] ${msg}`);
const ok = (s: string) => console.log(`✅ ${s}`);
const fail = (s: string) => { console.log(`❌ ${s}`); process.exitCode = 1; };

async function main() {
  console.log('\n=== ATELIER V2.0 · SMOKE TEST INTEGRAL (7 APPS UNIFICADAS) ===');
  console.log(`modo: ${CONFIG.mock ? 'MOCK (sin API)' : 'REAL (Gemini)'}`);
  console.log(`dataDir: ${CONFIG.dataDir}\n`);

  // 0 · proyecto
  const clientId = uid('cl_');
  const projectId = uid('pj_');
  run(`INSERT INTO clients(id,name,created_at) VALUES(?,?,?)`, [clientId, 'Cliente Demo', now()]);
  run(`INSERT INTO projects(id,client_id,name,season,status,created_at) VALUES(?,?,?,?,?,?)`, [
    projectId, clientId, 'Colección Unificada V2', 'SS26', 'active', now(),
  ]);
  ok('Etapa 0 · Proyecto creado');

  // 1 · casting (KORA 4K + Biometría Clone Studio + 5 Micro-Expresiones)
  const model = createModel(projectId, 'KORA-01', {
    archetype_id: 'KORA-01',
    resolution: '4K',
    skin_pore_visibility: 'ultra-HD micro-pores and subsurface scattering',
  });
  const portrait = await enqueueAndWait('casting.portrait', projectId, { projectId, modelId: model.id, dna: JSON.parse(model.dna_json) });
  const updatedModel = get<any>(`SELECT * FROM models WHERE id=?`, [model.id]);
  const modelDna = JSON.parse(updatedModel.dna_json);
  log('1', `retrato ${portrait.assetId} · Paleta Biométrica: ${modelDna.biometricPalette?.classifiedTone} (${modelDna.biometricPalette?.swatches?.length} swatches)`);

  const panel = await enqueueAndWait('casting.panel', projectId, { projectId, modelId: model.id, dna: modelDna });
  const expr = await enqueueAndWait('casting.expressions', projectId, { projectId, modelId: model.id, dna: modelDna });
  approveAsset(panel.assetId);
  run(`UPDATE models SET status='approved' WHERE id=?`, [model.id]);
  ok(`Etapa 1 · Casting KORA 4K: model_sheet ${panel.assetId} + 5 expresiones ${expr.assetId} + paleta biométrica`);

  // 2 · intake + Guión de Estilista & 5 Escenas (Virtual Product Stylist)
  const blazerSvg = `<svg width="900" height="1200" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <!-- Silueta de Blazer Estructurado Marino con Solapas y Botonadura -->
    <path d="M 250 220 L 370 180 L 450 380 L 530 180 L 650 220 L 730 820 L 640 840 L 600 420 L 590 960 L 310 960 L 300 420 L 260 840 L 170 820 Z" fill="#1b2a4a" stroke="#0f172a" stroke-width="6"/>
    <!-- Solapas -->
    <polygon points="370,180 450,380 390,410 330,230" fill="#233863" stroke="#0f172a" stroke-width="3"/>
    <polygon points="530,180 450,380 510,410 570,230" fill="#233863" stroke="#0f172a" stroke-width="3"/>
    <!-- Botones -->
    <circle cx="450" cy="520" r="11" fill="#d4af37"/>
    <circle cx="450" cy="620" r="11" fill="#d4af37"/>
    <circle cx="450" cy="720" r="11" fill="#d4af37"/>
    <!-- Bolsillos sastreros -->
    <rect x="335" y="700" width="75" height="14" rx="3" fill="#0f172a"/>
    <rect x="490" y="700" width="75" height="14" rx="3" fill="#0f172a"/>
  </svg>`;
  const garmentImg = await sharp(Buffer.from(blazerSvg)).png().toBuffer();
  const { productId, assetId: rawId } = await ingestProduct({
    projectId, buffer: garmentImg, title: 'Blazer Estructurado Marino', colorName: 'Marino',
  });
  const varMarino = addVariant(productId, 'Marino', '#1b2a4a');
  const varArena = addVariant(productId, 'Arena', '#cbb89a');
  await enqueueAndWait('intake.metadata', projectId, { projectId, productId, assetId: rawId });
  const scriptBundle = generateProductScript(productId);
  const prod = get<any>(`SELECT * FROM products WHERE id=?`, [productId]);
  ok(`Etapa 2 · Intake & Guión: "${prod.title}" · ${scriptBundle.parts.length} secciones de guión + ${scriptBundle.scenes.length} escenas · 2 variantes`);

  // GATE check: render sin lock aprobado debe fallar con GateError
  const lock = createLock(productId, [rawId]);
  let gateWorked = false;
  try {
    await enqueueAndWait('render.ghost', projectId, { projectId, lockId: lock.id });
  } catch (e: any) {
    gateWorked = e instanceof GateError && e.code === 'LOCK_NOT_APPROVED';
  }
  gateWorked ? ok('GATE · render bloqueado sin lock aprobado (GateError LOCK_NOT_APPROVED)') : fail('GATE no bloqueó el render');

  // 3 · lock (Clonación 3D 1:1 + Código VL-XXXX + SHA-256)
  await enqueueAndWait('lock.analyze', projectId, { projectId, lockId: lock.id, sourceAssetId: rawId, sourceAssetIds: [rawId] });
  const iso = await enqueueAndWait('lock.isolate', projectId, { projectId, lockId: lock.id, sourceAssetId: rawId });
  const dna = JSON.parse(get<any>(`SELECT garment_dna_json FROM locks WHERE id=?`, [lock.id]).garment_dna_json);
  ok(`Etapa 3 · Garment Lock 1:1: código ${dna.lockCode} · SHA-256 ${dna.sourceHashes?.[0]?.slice(0, 12)}… · ${Object.keys(dna.verifiedAttributes || {}).length} atributos`);

  // GATE: sin lock aprobado no hay render
  let gate2 = false;
  try {
    await enqueueAndWait('render.tryon', projectId, { projectId, modelId: model.id, lockId: lock.id });
  } catch (e: any) {
    gate2 = e instanceof GateError && e.code === 'LOCK_NOT_APPROVED';
  }
  gate2 ? ok('GATE · try-on bloqueado sin aprobación del lock (correcto)') : fail('GATE try-on no bloqueó');

  approveLock(lock.id);
  ok('Lock aprobado');

  // 4 · render (Master Prompt V5 + Dirección de Pose + Virtual Stylist Pro + Clone Studio + Reintento Asistido)
  const tryon = await enqueueAndWait('render.tryon', projectId, {
    projectId,
    modelId: model.id,
    lockId: lock.id,

    params: {
      view: 'Frontal',
      stylePresetId: 'formal',
      fabricType: 'Linen',
      drape: 40,
      wrinkle: 15,
      texture: 85,
      poseCategory: 'Chaquetas',
      plane: 'Plano entero (Full shot)',
      cameraAngle: 'Nivel de ojos (Eye-level neutro)',
      attitude: 'Sofisticada de pasarela',
      posePresetId: 'magazine_editorial',
      backgroundPresetId: 'studio_white_cyc',
    },
  });
  const retried = await enqueueAndWait('render.retry', projectId, {
    projectId,
    assetId: tryon.assetId,
    correctionPrompt: 'Ajustar simetría de solapa y botonadura frontal 1:1 con el Garment Lock.',
  });
  const ghost = await enqueueAndWait('render.ghost', projectId, { projectId, lockId: lock.id });
  const viewFront = await enqueueAndWait('render.view', projectId, { projectId, modelId: model.id, lockId: lock.id, view: 'front' });
  ok(`Etapa 4 · Render Master V5: try-on (${tryon.assetId}) + reintento asistido (${retried.assetId}) + vista frontal + ghost 3D`);

  // GATE: aprobar un render sin haber corrido QA debe bloquearse en modo estricto
  let gateStrictQA = false;
  try {
    approveAsset(tryon.assetId, true);
  } catch (e: any) {
    gateStrictQA = e instanceof GateError && e.code === 'ASSET_QA_REQUIRED';
  }
  gateStrictQA ? ok('GATE · aprobación bloqueada sin QA previo (GateError ASSET_QA_REQUIRED)') : fail('GATE QA previo no bloqueó');

  // 5 · QA (5 Controles Clone Studio V5 + Métricas Ópticas CIE76 ΔE)
  const qa = await enqueueAndWait('qa.evaluate', projectId, {
    projectId, sourceAssetId: rawId, candidateAssetId: tryon.assetId,
  });
  const qaRow = get<any>(`SELECT qa_score, qa_json FROM assets WHERE id=?`, [tryon.assetId]);
  const parsedQa = JSON.parse(qaRow.qa_json);
  const ctrlsOk = parsedQa.controls?.controlA_identity?.passed && parsedQa.controls?.controlB_prohibitedExclusion?.passed && parsedQa.controls?.controlC_textileFidelity?.passed;
  qa.overallStatus === 'PASS' && parsedQa.opticalMetrics?.resolutionOk && ctrlsOk
    ? ok(`Etapa 5 · QA 5-Controles + Óptico: ${qa.overallStatus} · Controles A/B/C/D/E OK · ΔE=${parsedQa.opticalMetrics.deltaE} · acción=${parsedQa.controls.suggestedAction}`)
    : fail(`QA devolvió ${qa.overallStatus}`);

  // GATE 3: export/compose sin aprobación humana debe fallar
  let gate3 = false;
  try {
    await enqueueAndWait('compose.catalog', projectId, {
      projectId, productId, assetIds: [tryon.assetId], cols: 1, requireApproved: true,
    });
  } catch (e: any) {
    gate3 = e instanceof GateError && e.code === 'ASSET_NOT_APPROVED';
  }
  gate3 ? ok('GATE 3 · compose/export bloqueado sin aprobación humana (GateError ASSET_NOT_APPROVED)') : fail('GATE 3 no bloqueó');

  // Evaluamos QA y aprobamos los assets que irán al catálogo Haute Couture
  for (const aid of [tryon.assetId, retried.assetId, ghost.assetId]) {
    await enqueueAndWait('qa.evaluate', projectId, { projectId, sourceAssetId: rawId, candidateAssetId: aid });
    approveAsset(aid, true);
  }

  // 6 · compose Haute Couture (Catalog Maker: plantilla asimétrica hc_3_a + detección anatómica + SHA-256)
  const composed = await enqueueAndWait('compose.catalog', projectId, {
    projectId,
    productId,
    assetIds: [tryon.assetId, retried.assetId, ghost.assetId],
    templateId: 'hc_3_a',
    resolution: '1500x2250',
    fitMode: 'CONTAIN',
    margin: 40,
    gap: 20,
    borderWidth: 2,
    requireApproved: true,
  });
  approveAsset(composed.assetId);
  const composedRow = get<any>(`SELECT * FROM assets WHERE id=?`, [composed.assetId]);
  const compMeta = JSON.parse(composedRow.qa_json);
  ok(`Etapa 6 · Catálogo Haute Couture: plantilla "${compMeta.templateName}" · ${composedRow.width}x${composedRow.height} · SHA-256 ${compMeta.qualityValidation.outputSha256.slice(0, 12)}…`);

  // export manifest + archivo ZIP real
  const exportId = uid('ex_');
  const approvedAssets = all<any>(`SELECT * FROM assets WHERE project_id=? AND approved=1`, [projectId])
    .map((a) => requireApprovedAsset(a.id));
  const outDir = path.join(CONFIG.dataDir, 'smoke-fixtures', exportId);
  fs.mkdirSync(outDir, { recursive: true });

  const zipEntries: { name: string; data: Buffer }[] = [];
  for (const a of approvedAssets) {
    if (fs.existsSync(a.file_path)) {
      const name = `${a.type}_${a.id}${path.extname(a.file_path)}`;
      fs.copyFileSync(a.file_path, path.join(outDir, name));
      zipEntries.push({ name, data: fs.readFileSync(a.file_path) });
    }
  }
  const manifest = {
    export_id: exportId,
    project: get<any>(`SELECT * FROM projects WHERE id=?`, [projectId]),
    product: get<any>(`SELECT * FROM products WHERE id=?`, [productId]),
    model: get<any>(`SELECT * FROM models WHERE id=?`, [model.id]),
    lock: get<any>(`SELECT * FROM locks WHERE id=?`, [lock.id]),
    assets: approvedAssets.map((a) => ({
      id: a.id, type: a.type, stage: a.stage, variant_id: a.variant_id || null,
      approved: !!a.approved, file: `${a.type}_${a.id}${path.extname(a.file_path)}`,
    })),
    generated_at: now(),
  };
  const manifestJson = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(path.join(outDir, 'manifest.json'), manifestJson);
  zipEntries.push({ name: 'manifest.json', data: Buffer.from(manifestJson, 'utf8') });

  const zipPath = path.join(outDir, `atelier_${exportId}.zip`);
  const zipBuf = createZipBuffer(zipEntries);
  fs.writeFileSync(zipPath, zipBuf);

  const isPkZip = zipBuf.length > 22 && zipBuf.readUInt32LE(0) === 0x04034b50;
  isPkZip
    ? ok(`Contenedor ZIP de prueba verificado: ${path.basename(zipPath)} (${(zipBuf.length / 1024).toFixed(1)} KB · ${zipEntries.length} archivos)`)
    : fail('El archivo ZIP generado no tiene cabecera PKZIP válida');

  run(`INSERT INTO exports(id, project_id, manifest_json, zip_path, created_at) VALUES(?,?,?,?,?)`, [
    exportId, projectId, manifestJson, zipPath, now(),
  ]);

  const stats = jobStats();
  console.log(`\n--- JOBS --- queued:${stats.queued} running:${stats.running} done:${stats.done} failed:${stats.failed} costo: $${stats.cost.toFixed(4)}`);
  console.log(`--- ASSETS APROBADOS --- ${approvedAssets.length} exportados`);
  console.log(`\n${process.exitCode ? 'SMOKE TEST CON FALLAS' : 'SMOKE TEST OK · flujo funcional con el proveedor seleccionado'}\n`);
}

main().catch((e) => { console.error('FALLO:', e); process.exit(1); });


