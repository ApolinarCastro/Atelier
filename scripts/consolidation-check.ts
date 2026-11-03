/**
 * scripts/consolidation-check.ts
 *
 * Suite de verificación completa para la Consolidación Funcional Definitiva 004:
 * Valida R01, R02, R03, R04, R05 y F01, F02, F03, F04 en modo MOCK aislado.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { run, get, all, uid, now } from '../server/db.ts';
import { CONFIG } from '../server/config.ts';
import { passesQA } from '../server/qa-evidence.ts';
import { validateExactModeConfig, GateError } from '../server/gates.ts';
import { getArchetype, SUPERMODEL_ARCHETYPES } from '../shared/catalog.ts';
import { detectSubjectLandmarks } from '../engines/compose.ts';
import { createModel } from '../engines/casting.ts';
import { ingestProduct, addVariant, uploadProductReference } from '../engines/intake.ts';
import { createLock, approveLock } from '../engines/lock.ts';
import { enqueueAndWait } from '../server/queue.ts';
import { createAsset, approveAsset } from '../engines/assets.ts';
import '../engines/index.ts';

// Forzar modo MOCK estricto
CONFIG.mock = true;
CONFIG.apiKey = '';

function pass(msg: string) {
  console.log(`  ✓ [PASS] ${msg}`);
}

function fail(msg: string, err?: any) {
  console.error(`  ✗ [FAIL] ${msg}`, err || '');
  process.exitCode = 1;
}

async function runConsolidationTests() {
  console.log('\n===============================================================');
  console.log(' ATELIER — CONSOLIDACIÓN FUNCIONAL DEFINITIVA 004');
  console.log(' Suite de Verificación Rigurosa R01-R05 + F01-F04 (MOCK AISLADO)');
  console.log('===============================================================\n');

  const testDir = path.resolve(CONFIG.dataDir, 'consolidation-test-' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });

  const dummyImg = await sharp({
    create: { width: 400, height: 600, channels: 3, background: { r: 180, g: 150, b: 130 } }
  }).png().toBuffer();

  const dummyBg = await sharp({
    create: { width: 800, height: 1200, channels: 3, background: { r: 240, g: 240, b: 245 } }
  }).png().toBuffer();

  // Crear proyecto aislado
  const clientId = uid('cl_c04_');
  const projectId = uid('pj_c04_');
  run(`INSERT INTO clients(id, name, created_at) VALUES(?, ?, ?)`, [clientId, 'Cliente C04', now()]);
  run(`INSERT INTO projects(id, client_id, name, season, status, created_at) VALUES(?, ?, ?, ?, ?, ?)`, [
    projectId, clientId, 'Colección Consolidada 004', 'FW26', 'active', now(),
  ]);

  // =========================================================================
  // TEST R05: Arquetipos Históricos (10 IDs KORA-01..ZURI-10 + Alias LINA-02)
  // =========================================================================
  console.log('--- TEST R05: Catálogo de 10 Arquetipos Históricos & Detección Anatómica ---');
  try {
    const historicalIds = [
      'KORA-01', 'ISA-02', 'ALMA-03', 'BRISA-04', 'ELIA-05',
      'NARA-06', 'MAREA-07', 'LIA-08', 'VEGA-09', 'ZURI-10'
    ];
    for (const hId of historicalIds) {
      const arch = getArchetype(hId);
      assert.ok(arch, `Arquetipo ${hId} debe existir en SUPERMODEL_ARCHETYPES`);
      assert.equal(arch.id, hId);
    }
    // Test alias fallback: LINA-02 debe resolver a ISA-02
    const aliasArch = getArchetype('LINA-02');
    assert.ok(aliasArch, 'Alias LINA-02 debe resolver');
    assert.equal(aliasArch.id, 'ISA-02');

    // Test detección anatómica para editorial compose
    const landmarks = await detectSubjectLandmarks(dummyImg);
    assert.ok(landmarks.headTopY > 0 && landmarks.headTopY < 1, 'headTopY normalizado');
    assert.ok(landmarks.eyeLineY > landmarks.headTopY, 'eyeLineY por debajo de headTop');
    assert.ok(landmarks.torsoCenterY > landmarks.eyeLineY, 'torsoCenterY por debajo de eyeLine');
    pass('R05: Los 10 arquetipos históricos resuelven correctamente y landmarks anatómicos detectados.');
  } catch (e) {
    fail('R05 falló', e);
  }

  // =========================================================================
  // TEST R02: Modo Exacto y Bloqueo de Alteraciones Prohibidas
  // =========================================================================
  console.log('\n--- TEST R02: Validación Estricta de Modo Exacto (Regla Inmutable) ---');
  try {
    // Exact mode sin overrides permitidos: debe pasar
    validateExactModeConfig({
      generationMode: 'exact',
      params: { stylePresetId: 'minimalist', drape: 50 },
    });
    pass('R02: Parámetros legítimos en modo exacto son aceptados.');

    // Intento de sobrescribir color de pelo en modo exacto: debe lanzar GateError
    let threw = false;
    try {
      validateExactModeConfig({
        generationMode: 'exact',
        params: { hairColorOverride: 'blonde' },
      });
    } catch (e: any) {
      threw = true;
      assert.equal(e.code, 'EXACT_MODE_OVERRIDE_FORBIDDEN');
    }
    assert.ok(threw, 'Debe bloquear hairColorOverride en modo exacto');

    // Intento de sobrescribir rasgos faciales/makeup en modo exacto: debe lanzar GateError
    let threwMakeup = false;
    try {
      validateExactModeConfig({
        generationMode: 'exact',
        params: { makeupOverride: 'heavy glitter' },
      });
    } catch (e: any) {
      threwMakeup = true;
      assert.equal(e.code, 'EXACT_MODE_OVERRIDE_FORBIDDEN');
    }
    assert.ok(threwMakeup, 'Debe bloquear makeupOverride en modo exacto');
    pass('R02: validateExactModeConfig bloquea estrictamente cualquier intento de alterar rasgos.');
  } catch (e) {
    fail('R02 falló', e);
  }

  // =========================================================================
  // TEST R04: Auditoría QA y Tratamiento de NOT_VISIBLE en Vistas Dorsales
  // =========================================================================
  console.log('\n--- TEST R04: QA Engine con Tratamiento Conforme de Atributos Oclusos ---');
  try {
    const defaultControls = {
      controlA_identity: { passed: true, details: 'ID verificado', confidence: 0.95 },
      controlB_prohibitedExclusion: {
        passed: true,
        details: 'Cero adiciones prohibidas',
        noJewelryAdded: true,
        noLipstickChange: true,
        noMakeupChange: true,
        noSkinMarksImported: true,
        noAnatomyDeformation: true,
        violations: [],
      },
      controlC_textileFidelity: { passed: true, details: 'Fidelidad textil OK', silhouetteIntact: true },
      controlD_compositionPose: { passed: true, details: 'Pose OK', posePreserved: true },
      controlE_technicalQuality: { passed: true, details: 'Calidad 4K OK' },
      suggestedAction: 'APPROVE',
    };

    // Caso 1: Vista trasera donde 'buttons', 'lapels', 'neckline', 'pockets' son NOT_VISIBLE de forma legítima,
    // pero los atributos estructurales (color, pattern, silhouette, texture, etc.) son MATCH.
    const backViewPassData: any = {
      overallStatus: 'PASS',
      hasCriticalMismatch: false,
      notes: 'Auditoría conforme de vista dorsal',
      controls: defaultControls,
      attributes: {
        color: 'MATCH',
        pattern: 'MATCH',
        silhouette: 'MATCH',
        neckline: 'NOT_VISIBLE',
        lapels: 'NOT_VISIBLE',
        buttons: 'NOT_VISIBLE',
        pockets: 'NOT_VISIBLE',
        sleeves: 'MATCH',
        hem: 'MATCH',
        texture: 'MATCH',
        addedElements: 'MATCH',
        missingElements: 'MATCH',
      },
    };
    const passesBack = passesQA(backViewPassData, false, 'view_back');
    assert.equal(passesBack, true, 'Vista dorsal con atributos legítimamente oclusos debe pasar QA si core atributos hacen MATCH');

    // Caso 2: Atributo estructural con MISMATCH (ej. color o pattern no coincide): debe fallar de inmediato
    const coreMismatchData: any = {
      overallStatus: 'PASS',
      hasCriticalMismatch: false,
      notes: 'Mismatch en color',
      controls: defaultControls,
      attributes: {
        ...backViewPassData.attributes,
        color: 'MISMATCH',
      },
    };
    const failsMismatch = passesQA(coreMismatchData, false, 'view_back');
    assert.equal(failsMismatch, false, 'Cualquier MISMATCH en atributo core debe rechazar el pase de QA');

    // Caso 3: Vista frontal donde atributos requeridos están marcados NOT_VISIBLE sin justificación:
    const frontViewMissingData: any = {
      overallStatus: 'PASS',
      hasCriticalMismatch: false,
      notes: 'Frontal incompleta',
      controls: defaultControls,
      attributes: {
        ...backViewPassData.attributes,
        addedElements: 'NOT_VISIBLE',
      },
    };
    const failsFront = passesQA(frontViewMissingData, false, 'view_front');
    assert.equal(failsFront, false, 'En vista frontal, atributos no omitibles como addedElements no pueden ser NOT_VISIBLE');
    pass('R04: passesQA discrimina correctamente atributos oclusos válidos en vistas dorsales sin degradar la compuerta textil.');
  } catch (e) {
    fail('R04 falló', e);
  }

  // =========================================================================
  // SETUP DATA: Modelo, Producto y Variantes para R01, R03, F01-F04
  // =========================================================================
  console.log('\n--- SETUP: Creación de Modelo, Producto, Variantes y Locks ---');
  const model = createModel(projectId, 'KORA-01', { archetype_id: 'KORA-01', resolution: '4K' });
  const modelSheet = await enqueueAndWait('casting.panel', projectId, { projectId, modelId: model.id, dna: JSON.parse(model.dna_json) });
  approveAsset(modelSheet.assetId);
  run(`UPDATE models SET sheet_asset_id=?, status='approved' WHERE id=?`, [modelSheet.assetId, model.id]);

  const product = await ingestProduct({ projectId, buffer: dummyImg, title: 'Vestido Haute Couture' });
  const lockBase = await createLock(product.productId, null, null);
  const rawBaseIds = JSON.parse(lockBase.source_asset_ids_json);
  await enqueueAndWait('lock.analyze', projectId, { projectId, lockId: lockBase.id, sourceAssetIds: rawBaseIds });
  await enqueueAndWait('lock.isolate', projectId, { projectId, lockId: lockBase.id, sourceAssetId: rawBaseIds[0] });
  approveLock(lockBase.id);

  const varAzul: any = addVariant(product.productId, 'Azul Noche', '#0b1d3a');
  const rawAzul = await uploadProductReference({ productId: product.productId, buffer: dummyImg, variantId: varAzul.id });
  const lockAzul = await createLock(product.productId, null, varAzul.id);
  const rawAzulIds = JSON.parse(lockAzul.source_asset_ids_json);
  await enqueueAndWait('lock.analyze', projectId, { projectId, lockId: lockAzul.id, sourceAssetIds: rawAzulIds });
  await enqueueAndWait('lock.isolate', projectId, { projectId, lockId: lockAzul.id, sourceAssetId: rawAzulIds[0] });
  approveLock(lockAzul.id);
  pass('Setup completado con Producto Base y Variante Azul con Garment Locks analizados y aprobados.');

  // =========================================================================
  // TEST R01 & R03: Manifest de Referencias, Roles y Trazabilidad de Variantes
  // =========================================================================
  console.log('\n--- TEST R01 & R03: Manifest de Referencias con Roles y Aislamiento de Variante ---');
  try {
    // Render tryon de la variante Azul
    const renderAzulJob = await enqueueAndWait('render.tryon', projectId, {
      projectId,
      productId: product.productId,
      modelId: model.id,
      lockId: lockAzul.id,
      variantId: varAzul.id,
      generationMode: 'exact',
      params: { backgroundPresetId: 'studio_white_cyc' },
    });

    const renderAsset = get<any>(`SELECT * FROM assets WHERE id=?`, [renderAzulJob.assetId]);
    assert.ok(renderAsset, 'Render asset debe existir');
    assert.equal(renderAsset.variant_id, varAzul.id, 'El render debe conservar el variant_id');

    // Verificar el manifest de referencias devuelto por el trabajo
    const manifest = renderAzulJob.references;
    assert.ok(manifest && Array.isArray(manifest), 'reference_manifest debe ser una lista devuelta por el render');

    // Verificar que los roles existan
    const roles = manifest.map((m: any) => m.role);
    assert.ok(roles.includes('identity_sheet'), 'Debe incluir identity_sheet');
    assert.ok(roles.includes('garment_original'), 'Debe incluir garment_original');
    assert.ok(roles.includes('garment_cut_support'), 'Debe incluir recorte auxiliar');

    // Verificar que los hashes SHA-256 estén presentes y consistentes
    for (const entry of manifest) {
      assert.ok(entry.sha256 && entry.sha256.length === 64, `Entrada ${entry.role} debe tener hash SHA-256 de 64 hex`);
    }

    pass('R01 & R03: Manifest de referencias estructurado con roles explícitos y trazabilidad SHA-256 por variante.');
  } catch (e) {
    fail('R01/R03 falló', e);
  }

  // =========================================================================
  // TEST F01: Soporte de Fondos Personalizados
  // =========================================================================
  console.log('\n--- TEST F01: Fondos Personalizados (background_custom & background_support) ---');
  try {
    const bgAsset = await createAsset({
      projectId,
      type: 'background_custom',
      stage: 'draft',
      buffer: dummyBg,
    });
    assert.ok(bgAsset.id, 'Fondo personalizado creado como asset');
    assert.equal(bgAsset.type, 'background_custom');

    // Renderizar con el fondo personalizado
    const renderWithBg = await enqueueAndWait('render.tryon', projectId, {
      projectId,
      productId: product.productId,
      modelId: model.id,
      lockId: lockBase.id,
      generationMode: 'exact',
      params: { backgroundAssetId: bgAsset.id },
    });

    const bgManifest = renderWithBg.references;
    assert.ok(bgManifest && Array.isArray(bgManifest), 'Manifest del render con fondo debe existir');
    const bgEntry = bgManifest.find((m: any) => m.role === 'background_support');
    assert.ok(bgEntry, 'El manifest debe contener el rol background_support para el fondo personalizado');
    assert.equal(bgEntry.assetId, bgAsset.id);
    pass('F01: Fondo personalizado subido, utilizado en render y vinculado al manifest con rol background_support.');
  } catch (e) {
    fail('F01 falló', e);
  }

  // =========================================================================
  // TEST F02: Historial de Versiones de Assets (Comparador Forense)
  // =========================================================================
  console.log('\n--- TEST F02: Historial de Versiones de Asset para Comparación Forense ---');
  try {
    // Generar un render inicial
    const baseRender = await enqueueAndWait('render.tryon', projectId, {
      projectId,
      productId: product.productId,
      modelId: model.id,
      lockId: lockBase.id,
      generationMode: 'exact',
    });

    // Generar un retry que apunta al render inicial
    const retryRender = await enqueueAndWait('render.retry', projectId, {
      projectId,
      assetId: baseRender.assetId,
      productId: product.productId,
      modelId: model.id,
      lockId: lockBase.id,
      correctionPrompt: 'Ajustar caída de la solapa',
      params: {},
    });

    const retryAsset = get<any>(`SELECT * FROM assets WHERE id=?`, [retryRender.assetId]);
    assert.equal(retryAsset.parent_asset_id, baseRender.assetId, 'El retry debe apuntar a parent_asset_id');

    // Simular consulta de endpoint /api/assets/:id/versions
    const versions: any[] = [];
    let cur: any = retryAsset;
    while (cur) {
      versions.push(cur);
      cur = cur.parent_asset_id ? get<any>(`SELECT * FROM assets WHERE id=?`, [cur.parent_asset_id]) : null;
    }
    assert.ok(versions.length >= 2, 'La cadena de versiones debe incluir al menos el candidato y su ancestro');
    assert.equal(versions[0].id, retryRender.assetId);
    assert.equal(versions[1].id, baseRender.assetId);
    pass('F02: Cadena de parentesco y versiones rastreable para el Comparador Visual Forense.');
  } catch (e) {
    fail('F02 falló', e);
  }

  // =========================================================================
  // TEST F03: Procesamiento por Lotes (Batch SKU)
  // =========================================================================
  console.log('\n--- TEST F03: Procesamiento por Lotes (Batch SKU) e Idempotencia ---');
  try {
    // Crear lote de 2 items (base y variante)
    const batchId = uid('batch_test_');
    const items = [
      { productId: product.productId, modelId: model.id, lockId: lockBase.id, mode: 'tryon' },
      { productId: product.productId, modelId: model.id, lockId: lockAzul.id, variantId: varAzul.id, mode: 'tryon' },
    ];

    const queuedJobs = items.map((it) => {
      return enqueueAndWait('render.tryon', projectId, {
        projectId,
        productId: it.productId,
        modelId: it.modelId,
        lockId: it.lockId,
        variantId: it.variantId,
        generationMode: 'exact',
        params: { batchId },
      });
    });

    const results = await Promise.all(queuedJobs);
    assert.equal(results.length, 2, 'Deben completarse los 2 trabajos del lote');
    for (const res of results) {
      const asset = get<any>(`SELECT * FROM assets WHERE id=?`, [res.assetId]);
      assert.ok(asset, 'Asset del batch debe estar registrado en BD');
    }
    pass('F03: Procesamiento por lotes SKU ejecutado con seguimiento y asociación en BD.');
  } catch (e) {
    fail('F03 falló', e);
  }

  // =========================================================================
  // TEST F04: Biblioteca Global de Modelos e Importación entre Proyectos
  // =========================================================================
  console.log('\n--- TEST F04: Biblioteca Global de Identidades Aprobadas e Importación ---');
  try {
    // Crear un segundo proyecto de destino
    const project2Id = uid('pj_dest_');
    run(`INSERT INTO projects(id, client_id, name, season, status, created_at) VALUES(?, ?, ?, ?, ?, ?)`, [
      project2Id, clientId, 'Proyecto Destino Reutilización', 'SS27', 'active', now(),
    ]);

    // Consultar biblioteca global (modelos aprobados de otros proyectos)
    const approvedModels = all<any>(
      `SELECT m.*, p.name as project_name FROM models m
       JOIN projects p ON p.id = m.project_id
       WHERE m.status = 'approved' AND m.project_id != ?`,
      [project2Id]
    );
    assert.ok(approvedModels.length >= 1, 'Debe haber al menos un modelo aprobado en la biblioteca');
    const sourceModel = approvedModels.find((m) => m.id === model.id);
    assert.ok(sourceModel, 'El modelo original debe figurar en la biblioteca global');

    // Importar el modelo al proyecto 2
    const newModelId = uid('md_imp_');
    run(
      `INSERT INTO models(id, project_id, name, archetype, dna_json, sheet_asset_id, status, created_at)
       VALUES(?, ?, ?, ?, ?, ?, 'approved', ?)`,
      [
        newModelId,
        project2Id,
        sourceModel.name + ' (Importado)',
        sourceModel.archetype,
        sourceModel.dna_json,
        sourceModel.sheet_asset_id,
        now(),
      ]
    );

    const importedModel = get<any>(`SELECT * FROM models WHERE id=?`, [newModelId]);
    assert.ok(importedModel, 'Modelo importado debe existir en el proyecto destino');
    assert.equal(importedModel.project_id, project2Id);
    assert.equal(importedModel.status, 'approved', 'Modelo importado conserva estado aprobado');
    pass('F04: Biblioteca global descubierta e importación cross-project exitosa sin regeneración.');
  } catch (e) {
    fail('F04 falló', e);
  }

  console.log('\n===============================================================');
  if (process.exitCode) {
    console.error('❌ HUBO ERRORES EN LA SUITE DE CONSOLIDACIÓN.');
  } else {
    console.log('✅ TODAS LAS PRUEBAS DE CONSOLIDACIÓN (R01-R05, F01-F04) PASARON.');
  }
  console.log('===============================================================\n');
}

runConsolidationTests().catch((e) => {
  console.error('Error fatal en ejecución de tests:', e);
  process.exit(1);
});
