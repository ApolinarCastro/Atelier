import express from 'express';
import cors from 'cors';
import { digest, fingerprint, readEvidence } from './qa-evidence.ts';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { CONFIG, isMock, updateRuntimeConfig } from './config.ts';
import { all, get, run, tx, uid, now, audit } from './db.ts';
import { enqueueAndWait, jobStats } from './queue.ts';
import { GateError, requireApprovedAsset, requireProject } from './gates.ts';
import { createZipBuffer, resolveAssetFile } from './storage.ts';
import { chatFashionAdvisor } from './provider.ts';
import {
  createModel, extractBiometricSkinPalette, ingestProduct, ingestProductFromUrl, generateProductScript,
  addVariant, assignRawAssetVariant, uploadProductReference, createLock, approveLock, approveAsset, getAsset, createAsset,
} from '../engines/index.ts';


const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/avif']);

export const app = express();

// Cabeceras de seguridad
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(cors({ origin: CONFIG.corsOrigin }));
app.use(express.json({ limit: '10mb' }));

// Rate limiter en memoria por IP (protección contra agotamiento de cuota API)
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
app.use('/api', (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || 'local';
  const t = Date.now();
  const limit = req.method === 'GET' ? 240 : 80;
  const b = rateBuckets.get(ip);
  if (!b || t > b.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: t + 60_000 });
    return next();
  }
  b.count++;
  if (b.count > limit) {
    return res.status(429).json({ error: 'Demasiadas peticiones. Intenta de nuevo en un minuto.', code: 'RATE_LIMITED' });
  }
  next();
});

// Autenticación opcional por token (si ATELIER_API_TOKEN está definido)
app.use('/api', (req, res, next) => {
  if (!CONFIG.apiToken || req.path === '/health') return next();
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : String(req.headers['x-api-key'] || '');
  if (token !== CONFIG.apiToken) {
    return res.status(401).json({ error: 'No autorizado: token inválido o ausente', code: 'UNAUTHORIZED' });
  }
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
    fields: 15,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error('Formato de archivo no soportado. Usa PNG, JPG o WEBP.'));
    }
    cb(null, true);
  },
});

const cleanText = (v: unknown, fallback = '', max = 160) =>
  String(v ?? fallback).replace(/[\r\n<>]/g, ' ').trim().slice(0, max) || fallback;

const wrap = (fn: (req: any, res: any) => Promise<any>) => (req: any, res: any) =>
  Promise.resolve(fn(req, res)).catch((e: any) => {
    const code = e instanceof GateError ? 409 : 500;
    res.status(code).json({ error: e?.message || 'Error', code: e?.code || 'ERROR' });
  });

app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    mode: isMock() ? 'mock' : 'real',
    hasApiKey: Boolean(CONFIG.apiKey),
    maskedKey: CONFIG.apiKey ? `••••${CONFIG.apiKey.slice(-4)}` : '',
    imageModel: CONFIG.models.image,
    textModel: CONFIG.models.text,
    version: '2.0.0-unified',
    jobs: jobStats(),
  }),
);

app.get('/api/config', (_req, res) =>
  res.json({
    mode: isMock() ? 'mock' : 'real',
    hasApiKey: Boolean(CONFIG.apiKey),
    maskedKey: CONFIG.apiKey ? `••••${CONFIG.apiKey.slice(-4)}` : '',
    imageModel: CONFIG.models.image,
    textModel: CONFIG.models.text,
  }),
);

app.post('/api/config', wrap(async (req, res) => {
  const { apiKey, mock, imageModel, textModel } = req.body || {};
  updateRuntimeConfig({
    apiKey: typeof apiKey === 'string' ? apiKey : undefined,
    mock: typeof mock === 'boolean' ? mock : undefined,
    imageModel: typeof imageModel === 'string' ? imageModel : undefined,
    textModel: typeof textModel === 'string' ? textModel : undefined,
  });
  res.json({
    ok: true,
    mode: isMock() ? 'mock' : 'real',
    hasApiKey: Boolean(CONFIG.apiKey),
    maskedKey: CONFIG.apiKey ? `••••${CONFIG.apiKey.slice(-4)}` : '',
    imageModel: CONFIG.models.image,
    textModel: CONFIG.models.text,
  });
}));

app.get('/api/projects', (_req, res) => {
  res.json(all(`SELECT * FROM projects ORDER BY created_at DESC`));
});

app.post('/api/projects', wrap(async (req, res) => {
  const { name, season, clientName } = req.body || {};
  const project = tx(() => {
    const clientId = uid('cl_');
    run(`INSERT INTO clients(id,name,created_at) VALUES(?,?,?)`, [
      clientId,
      cleanText(clientName, 'Cliente', 80),
      now(),
    ]);
    const id = uid('pj_');
    run(`INSERT INTO projects(id,client_id,name,season,status,created_at) VALUES(?,?,?,?,?,?)`, [
      id,
      clientId,
      cleanText(name, 'Proyecto', 80),
      cleanText(season, 'SS26', 30),
      'active',
      now(),
    ]);
    audit('project', id, 'created', { name });
    return get(`SELECT * FROM projects WHERE id=?`, [id]);
  });
  res.json(project);
}));

app.get('/api/projects/:id/state', wrap(async (req, res) => {
  const id = req.params.id;
  requireProject(id);
  res.json({
    project: get(`SELECT * FROM projects WHERE id=?`, [id]),
    models: all(`SELECT * FROM models WHERE project_id=? ORDER BY created_at DESC`, [id]),
    products: all(`SELECT * FROM products WHERE project_id=? ORDER BY created_at DESC`, [id]),
    variants: all(`SELECT * FROM variants WHERE product_id IN (SELECT id FROM products WHERE project_id=?)`, [id]),
    locks: all(`SELECT * FROM locks WHERE product_id IN (SELECT id FROM products WHERE project_id=?)`, [id]),
    assets: all(`SELECT * FROM assets WHERE project_id=? ORDER BY created_at`, [id]),
    exports: all(`SELECT id, project_id, created_at FROM exports WHERE project_id=? ORDER BY created_at DESC`, [id]),
    jobs: all(`SELECT * FROM jobs WHERE project_id=? ORDER BY created_at DESC LIMIT 30`, [id]),
    jobs_stats: jobStats(),
    mode: isMock() ? 'mock' : 'real',
  });
}));

// ---- Etapa 1: casting (KORA 4K + Paleta Biométrica + Hoja de 5 Expresiones)
app.post('/api/projects/:id/models', wrap(async (req, res) => {
  const projectId = req.params.id;
  requireProject(projectId);
  const { name, dna, includeExpressions } = req.body || {};
  const safeName = cleanText(name, 'Modelo', 60);
  const safeDna = typeof dna === 'object' && dna !== null ? dna : {};
  const model = createModel(projectId, safeName, safeDna);
  const fullDna = model?.dna_json ? JSON.parse(model.dna_json) : safeDna;
  const portrait = await enqueueAndWait('casting.portrait', projectId, { projectId, modelId: model.id, dna: fullDna });
  const panel = await enqueueAndWait('casting.panel', projectId, { projectId, modelId: model.id, dna: fullDna });
  let expressions = null;
  if (includeExpressions) {
    expressions = await enqueueAndWait('casting.expressions', projectId, { projectId, modelId: model.id, dna: fullDna });
  }
  res.json({ model: get(`SELECT * FROM models WHERE id=?`, [model.id]), portrait, panel, expressions });
}));

// Subir fotografía real de Modelo/Avatar (como en Clone Studio y KORA Reference Image)
app.post('/api/projects/:id/models/upload', upload.single('file'), wrap(async (req, res) => {
  const projectId = req.params.id;
  requireProject(projectId);
  if (!req.file) return res.status(400).json({ error: 'Falta la fotografía del modelo' });
  const safeName = cleanText(req.body?.name, req.file.originalname.replace(/\.[^.]+$/, '') || 'Avatar Real', 60);
  const biometricPalette = await extractBiometricSkinPalette(req.file.buffer);
  const dna = {
    archetype_id: 'real_photo_avatar',
    name: safeName,
    resolution: '4K' as const,
    biometricPalette,
  };
  const model = createModel(projectId, safeName, dna);
  const portraitAsset = await createAsset({
    projectId,
    modelId: model.id,
    type: 'model_portrait',
    stage: 'draft',
    buffer: req.file.buffer,
  });
  const sheetAsset = await createAsset({
    projectId,
    modelId: model.id,
    type: 'model_sheet',
    stage: 'approved',
    buffer: req.file.buffer,
    approved: true,
  });
  run(`UPDATE models SET sheet_asset_id=?, status='approved' WHERE id=?`, [sheetAsset.id, model.id]);
  res.json({
    model: get(`SELECT * FROM models WHERE id=?`, [model.id]),
    portrait: { assetId: portraitAsset.id },
    panel: { assetId: sheetAsset.id },
  });
}));

app.post('/api/models/:id/expressions', wrap(async (req, res) => {
  const m = get<any>(`SELECT * FROM models WHERE id=?`, [req.params.id]);
  if (!m) return res.status(404).json({ error: 'Modelo no existe' });
  const dna = m.dna_json ? JSON.parse(m.dna_json) : {};
  const out = await enqueueAndWait('casting.expressions', m.project_id, {
    projectId: m.project_id,
    modelId: m.id,
    dna,
  });
  res.json(out);
}));

app.post('/api/models/:id/approve', wrap(async (req, res) => {
  const m = get<any>(`SELECT * FROM models WHERE id=?`, [req.params.id]);
  if (!m) return res.status(404).json({ error: 'Modelo no existe' });
  if (!m.sheet_asset_id) return res.status(409).json({ error: 'El modelo no tiene hoja de identidad' });
  approveAsset(m.sheet_asset_id, false);
  run(`UPDATE models SET status='approved' WHERE id=?`, [m.id]);
  res.json({ ok: true, model: get(`SELECT * FROM models WHERE id=?`, [m.id]) });
}));

// ---- Etapa 2: intake (Archivo + Extractor URL E-Commerce + Guión Estilista)
app.post('/api/projects/:id/products', upload.single('file'), wrap(async (req, res) => {
  const projectId = req.params.id;
  requireProject(projectId);
  if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });
  const { productId, assetId } = await ingestProduct({
    projectId,
    buffer: req.file.buffer,
    filename: cleanText(req.file.originalname, 'prenda.png', 100),
    title: cleanText(req.body?.title, '', 100) || undefined,
    sourceUrl: cleanText(req.body?.sourceUrl, '', 240) || undefined,
  });
  await enqueueAndWait('intake.metadata', projectId, { projectId, productId, assetId });
  res.json({ productId, assetId, product: get(`SELECT * FROM products WHERE id=?`, [productId]) });
}));

app.post('/api/projects/:id/products/url', wrap(async (req, res) => {
  const projectId = req.params.id;
  requireProject(projectId);
  const url = String(req.body?.url || '').trim();
  const title = cleanText(req.body?.title, '', 100) || undefined;
  if (!url) return res.status(400).json({ error: 'Ingresa una URL de producto válida' });
  const { productId, assetId, discoveredColors } = await ingestProductFromUrl({
    projectId,
    url,
    fallbackTitle: title,
  });
  await enqueueAndWait('intake.metadata', projectId, { projectId, productId, assetId });
  res.json({
    productId,
    assetId,
    discoveredColors,
    product: get(`SELECT * FROM products WHERE id=?`, [productId]),
  });
}));

app.post('/api/products/:id/script', wrap(async (req, res) => {
  const bundle = generateProductScript(req.params.id);
  res.json(bundle);
}));

app.post('/api/products/:id/variants', wrap(async (req, res) => {
  const product = get<any>(`SELECT * FROM products WHERE id=?`, [req.params.id]);
  if (!product) return res.status(404).json({ error: 'Producto no existe' });
  const colorName = cleanText(req.body?.colorName, 'Color', 50);
  const rawHex = String(req.body?.colorHex || '').trim();
  const colorHex = /^#[0-9a-fA-F]{6}$/.test(rawHex) ? rawHex : undefined;
  const v = addVariant(product.id, colorName, colorHex);
  res.json(v);
}));

app.post('/api/products/:id/references', upload.single('file'), wrap(async (req, res) => {
  const product = get<any>(`SELECT * FROM products WHERE id=?`, [req.params.id]);
  if (!product) return res.status(404).json({ error: 'Producto no existe' });
  if (!req.file) return res.status(400).json({ error: 'Falta la fotografía original de referencia' });
  const variantId = req.body?.variantId ? String(req.body.variantId).trim() : null;
  const asset = await uploadProductReference({
    productId: product.id,
    variantId,
    buffer: req.file.buffer,
  });
  res.json({ asset });
}));

app.post('/api/assets/:id/assign-variant', wrap(async (req, res) => {
  const variantId = req.body?.variantId === undefined || req.body?.variantId === null || req.body?.variantId === ''
    ? null
    : String(req.body.variantId).trim();
  const out = assignRawAssetVariant(req.params.id, variantId);
  res.json(out);
}));

// ---- Etapa 3: lock (Visual Lock 1:1 Multi-Referencia + SHA-256 por Prenda o Variante)
app.post('/api/products/:id/lock', wrap(async (req, res) => {
  const productId = req.params.id;
  const product = get<any>(`SELECT * FROM products WHERE id=?`, [productId]);
  if (!product) return res.status(404).json({ error: 'Producto no existe' });
  const variantId = req.body?.variantId ? String(req.body.variantId).trim() : null;
  const explicitIds = Array.isArray(req.body?.sourceAssetIds) && req.body.sourceAssetIds.length
    ? req.body.sourceAssetIds.map((id: unknown) => String(id))
    : undefined;
  const lock = createLock(productId, explicitIds, variantId);
  const sourceIds: string[] = JSON.parse(lock.source_asset_ids_json || '[]');
  await enqueueAndWait('lock.analyze', product.project_id, {
    projectId: product.project_id,
    lockId: lock.id,
    sourceAssetId: sourceIds[0],
    sourceAssetIds: sourceIds,
  });
  const iso = await enqueueAndWait('lock.isolate', product.project_id, {
    projectId: product.project_id,
    lockId: lock.id,
    sourceAssetId: sourceIds[0],
    sourceAssetIds: sourceIds,
  });
  res.json({ lock: get(`SELECT * FROM locks WHERE id=?`, [lock.id]), garmentCut: iso.assetId });
}));


app.post('/api/locks/:id/approve', wrap(async (req, res) => {
  const lock = get<any>(`SELECT * FROM locks WHERE id=?`, [req.params.id]);
  if (!lock) return res.status(404).json({ error: 'Lock no existe' });
  res.json({ lock: approveLock(req.params.id) });
}));

// ---- Etapa 4: render (Master Prompt V5 + Dirección de Pose + Virtual Stylist Pro + Clone Studio)
app.post('/api/products/:id/render', wrap(async (req, res) => {
  const productId = req.params.id;
  const { modelId, lockId: requestedLockId, variantId: rawVariantId, mode = 'tryon', params = {} } = req.body || {};
  const product = get<any>(`SELECT * FROM products WHERE id=?`, [productId]);
  if (!product) return res.status(404).json({ error: 'Producto no existe' });
  const projectId = product.project_id;
  const variantId = rawVariantId ? String(rawVariantId).trim() : null;

  let lockId = requestedLockId ? String(requestedLockId).trim() : '';
  if (!lockId) {
    const scopeLock = get<any>(
      `SELECT * FROM locks WHERE product_id=? AND COALESCE(variant_id, '') = COALESCE(?, '') AND approved=1 ORDER BY created_at DESC LIMIT 1`,
      [productId, variantId],
    );
    if (!scopeLock) {
      throw new GateError(
        'LOCK_NOT_APPROVED',
        variantId
          ? `La variante ${variantId} está pendiente: requiere un Garment Lock aprobado con sus fotografías originales asignadas antes de renderizar.`
          : 'El producto requiere un Garment Lock aprobado antes de renderizar.',
      );
    }
    lockId = scopeLock.id;
  }

  const out: any[] = [];
  if (mode === 'tryon') {
    out.push(await enqueueAndWait('render.tryon', projectId, { projectId, productId, modelId, lockId, variantId, params }));
  } else if (mode === 'ghost') {
    out.push(await enqueueAndWait('render.ghost', projectId, { projectId, productId, lockId, variantId, params }));
  } else if (mode === 'views') {
    for (const v of ['front', 'left', 'right', 'back']) {
      out.push(await enqueueAndWait('render.view', projectId, { projectId, productId, modelId, lockId, variantId, view: v, params }));
    }
  } else {
    return res.status(400).json({ error: 'Modo de render inválido' });
  }
  res.json({ results: out });
}));


// Ejecución independiente de Estudios Especializados (sin bloqueo lineal)
app.post('/api/projects/:id/assets/upload', upload.single('file'), wrap(async (req, res) => {
  const projectId = req.params.id;
  requireProject(projectId);
  if (!req.file) return res.status(400).json({ error: 'Falta el archivo de imagen' });
  const type = req.body?.type || 'garment_raw';
  if (type !== 'garment_raw' && type !== 'model_sheet') {
    throw new GateError('UPLOAD_REFERENCE_ONLY', 'La carga directa admite solo imágenes de referencia');
  }
  const asset = await createAsset({
    projectId,
    type,
    stage: 'draft',
    buffer: req.file.buffer,
  });
  res.json({ asset });
}));

app.post('/api/projects/:id/studio/pose', wrap(async (req, res) => {
  const projectId = req.params.id;
  requireProject(projectId);
  const { sourceAssetId, params = {} } = req.body || {};
  if (!sourceAssetId) return res.status(400).json({ error: 'Selecciona o sube una imagen base' });
  const out = await enqueueAndWait('studio.pose', projectId, { projectId, sourceAssetId, params });
  res.json(out);
}));

app.post('/api/projects/:id/studio/clone', wrap(async (req, res) => {
  const projectId = req.params.id;
  requireProject(projectId);
  const { avatarAssetId, garmentAssetId, mode = 'tryon', params = {} } = req.body || {};
  if (!garmentAssetId) return res.status(400).json({ error: 'Selecciona o sube una imagen de prenda' });
  const out = await enqueueAndWait('studio.direct_clone', projectId, {
    projectId,
    avatarAssetId,
    garmentAssetId,
    mode,
    params,
  });
  res.json(out);
}));

// Reintento Asistido / Corrección Iterativa (Clone Studio V5)
app.post('/api/assets/:id/retry', wrap(async (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset no existe' });
  const correctionPrompt = cleanText(
    req.body?.correctionPrompt,
    'Corregir fidelidad 1:1 de cuello, costuras y color según el Garment Lock.',
    300,
  );
  const out = await enqueueAndWait('render.retry', asset.project_id, {
    projectId: asset.project_id,
    assetId: asset.id,
    correctionPrompt,
    params: req.body?.params || {},
  });
  res.json(out);
}));

// ---- Etapa 5: QA (5 Controles Clone Studio V5 + Métricas Ópticas CIE76 ΔE)
app.post('/api/assets/:id/qa', wrap(async (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset no existe' });
  const src = req.body?.sourceAssetId;
  const qa = await enqueueAndWait('qa.evaluate', asset.project_id, {
    projectId: asset.project_id, sourceAssetId: src, candidateAssetId: asset.id,
  });
  res.json(qa);
}));

app.post('/api/assets/:id/approve', wrap(async (req, res) => {
  res.json({ asset: approveAsset(req.params.id, false) });
}));

// ---- Etapa 6: compose (Plantillas Haute Couture + Detección Anatómica + Auditoría SHA-256) + export
app.post('/api/projects/:id/compose', wrap(async (req, res) => {
  const projectId = req.params.id;
  requireProject(projectId);
  const {
    assetIds,
    templateId = 'AUTO',
    resolution = '1000x1500',
    fitMode = 'CONTAIN',
    cols = 2,
    margin = 40,
    gap = 20,
    background = '#ffffff',
    borderWidth = 0,
    borderColor = '#e4e4e7',
    productId,
  } = req.body || {};
  if (!Array.isArray(assetIds) || !assetIds.length) {
    return res.status(400).json({ error: 'Selecciona al menos una imagen para componer' });
  }

  const out = await enqueueAndWait('compose.catalog', projectId, {
    projectId,
    assetIds,
    templateId,
    resolution,
    fitMode,
    cols,
    margin,
    gap,
    background,
    borderWidth,
    borderColor,
    productId,
  });
  res.json(out);
}));

app.post('/api/projects/:id/export', wrap(async (req, res) => {
  const projectId = req.params.id;
  requireProject(projectId);
  const rawAssets = all<any>(`SELECT * FROM assets WHERE project_id=? AND approved=1`, [projectId]);
  if (req.body?.assetIds === undefined && !rawAssets.length) return res.status(409).json({ error: 'No hay assets aprobados para exportar', code: 'NO_APPROVED_ASSETS' });

  const selected = req.body?.assetIds;
  if (selected !== undefined && (!Array.isArray(selected) || !selected.length ||
      selected.some(id => typeof id !== 'string'))) {
    throw new GateError('EXPORT_SELECTION_INVALID', 'Selecciona los assets de la entrega');
  }
  const verifiedAssets = (selected ?? rawAssets.map(a => a.id)).map((id: string) => {
    const asset = requireApprovedAsset(id);
    if (asset.project_id !== projectId) throw new GateError('ASSET_PROJECT_MISMATCH', 'Asset de otro proyecto');
    return asset;
  }) as ReturnType<typeof requireApprovedAsset>[];
  const files = verifiedAssets.map(a => ({ asset: a, hash: fingerprint(a).sha256,
    name: `${a.type}_${a.id}${path.extname(a.file_path)}`, data: fs.readFileSync(a.file_path) }));
  const modes = new Set(verifiedAssets.flatMap(a => a.type === 'composed'
    ? readEvidence(a.qa_json).components.map((c: { id: string }) => requireApprovedAsset(c.id).qa_mode)
    : [a.qa_mode]).filter(Boolean));
  if (modes.size > 1) throw new GateError('EXPORT_MODE_MIXED', 'Separa las imágenes MOCK de las REAL');
  const mode = modes.has('MOCK') ? 'MOCK' : modes.has('REAL') ? 'REAL' : 'AUXILIARY';
  const exportId = uid('ex_');
  const outDir = path.resolve(CONFIG.dataDir, 'exports', mode.toLowerCase(), exportId);


  const zipEntries: { name: string; data: Buffer }[] = [];
  for (const file of files) {

    zipEntries.push({ name: file.name, data: file.data });
  }
  const products = all<any>(`SELECT * FROM products WHERE project_id=?`, [projectId]);
  for (const prod of products) {
    if (prod.script_json) {
      const scriptFile = `guion_estilista_${prod.id}.json`;

      zipEntries.push({ name: scriptFile, data: Buffer.from(prod.script_json, 'utf8') });
    }
  }

  const manifest = {
    export_id: exportId,
    version: 1,
    mode,
    project: get(`SELECT * FROM projects WHERE id=?`, [projectId]),
    generated_at: now(),
    assets: files.map(({ asset: a, hash, name }) => ({
      id: a.id,
      type: a.type,
      stage: a.stage,
      variant_id: a.variant_id || null,
      approved: !!a.approved,
      qa_score: a.qa_score,
      sha256: hash,
      mode: a.qa_mode ?? null,
      approval: readEvidence(a.approval_evidence),
      file: name,
    })),
  };

  const manifestStr = JSON.stringify(manifest, null, 2);

  zipEntries.push({ name: 'manifest.json', data: Buffer.from(manifestStr, 'utf8') });

  const zipPath = path.join(outDir, `atelier_${exportId}.zip`);
  const zip = createZipBuffer(zipEntries);
  const parent = path.dirname(outDir);
  fs.mkdirSync(parent, { recursive: true });
  const staging = fs.mkdtempSync(path.join(parent, '.pending-'));
  try {
    for (const file of zipEntries) fs.writeFileSync(path.join(staging, file.name), file.data);
    fs.writeFileSync(path.join(staging, path.basename(zipPath)), zip);
    fs.renameSync(staging, outDir);
  } catch (error) {
    for (const name of fs.readdirSync(staging)) fs.unlinkSync(path.join(staging, name));
    fs.rmdirSync(staging);
    throw error;
  }

  run(`INSERT INTO exports(id,project_id,manifest_json,zip_path,created_at) VALUES(?,?,?,?,?)`, [
    exportId, projectId, JSON.stringify({ ...manifest, zipSha256: digest(zip) }), zipPath, now(),
  ]);
  audit('export', exportId, 'exported', { files: manifest.assets.length });

  res.json({
    exportId,
    dir: outDir,
    zipPath,
    downloadUrl: `/api/exports/${exportId}/zip`,
    files: manifest.assets.length,
    manifest,
  });
}));

// Asesor de Moda y Dirección de Arte IA (Clone Studio FashionChatModal)
app.post('/api/chat', wrap(async (req, res) => {
  const message = cleanText(req.body?.message, '', 500);
  const context = cleanText(req.body?.context, '', 500);
  if (!message) return res.status(400).json({ error: 'Escribe una consulta para el asesor' });
  const out = await chatFashionAdvisor({ message, context });
  res.json(out);
}));

app.get('/api/exports/:id/zip', wrap(async (req, res) => {
  const ex = get<any>(`SELECT * FROM exports WHERE id=?`, [req.params.id]);
  if (!ex?.zip_path) return res.status(404).json({ error: 'Exportación no encontrada' });
  const resolved = resolveAssetFile(ex.zip_path);
  if (!resolved || !resolved.endsWith('.zip')) {
    return res.status(404).json({ error: 'Archivo ZIP no encontrado' });
  }
  const manifest = readEvidence(ex.manifest_json);
  if (manifest?.version !== 1 || !Array.isArray(manifest.assets) || !manifest.assets.length ||
      manifest.zipSha256 !== digest(fs.readFileSync(resolved))) {
    throw new GateError('EXPORT_UNVERIFIED', 'Regenera la exportación con un manifiesto verificable');
  }
  for (const entry of manifest.assets) {
    const asset = requireApprovedAsset(entry.id);
    if (asset.project_id !== ex.project_id || fingerprint(asset).sha256 !== entry.sha256 ||
        JSON.stringify(readEvidence(asset.approval_evidence)) !== JSON.stringify(entry.approval)) {
      throw new GateError('EXPORT_STALE', 'La aprobación o el contenido de un archivo exportado cambió');
    }
  }
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${manifest.mode === 'MOCK' ? 'MOCK_' : ''}atelier_${ex.id}.zip"`);
  res.sendFile(resolved);
}));

app.get('/api/assets/:id/download', wrap(async (req, res) => {
  const asset = requireApprovedAsset(req.params.id);
  const resolved = resolveAssetFile(asset.file_path);
  if (!resolved) throw new GateError('ASSET_FILE_MISSING', 'Archivo no disponible');
  res.download(resolved, `${asset.qa_mode === 'MOCK' ? 'MOCK_' : ''}${path.basename(resolved)}`);
}));

// Vista interna, separada de la descarga de entrega.
app.get('/api/assets/:id/file', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Atelier-Usage', 'internal-preview');
  const a = getAsset(req.params.id);
  if (!a) return res.status(404).end();
  const resolved = resolveAssetFile(a.file_path);
  if (!resolved) return res.status(404).end();
  res.sendFile(resolved);
});

// Middleware de error de multer / JSON
app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(400).json({ error: err?.message || 'Solicitud inválida', code: 'BAD_REQUEST' });
});

// static client
const dist = path.join(process.cwd(), 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res, next) => (req.path.startsWith('/api') ? next() : res.sendFile(path.join(dist, 'index.html'))));
}

import { fileURLToPath } from 'node:url';

const isDirectEntry = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectEntry) {
  app.listen(CONFIG.port, () => {
    console.log(`ATELIER API en http://localhost:${CONFIG.port} · modo ${isMock() ? 'MOCK' : 'REAL'}`);
  });
}




