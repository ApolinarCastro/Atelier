import crypto from 'node:crypto';
import sharp from 'sharp';
import { get, run, now, uid, all, tx, audit } from '../server/db.ts';
import { GateError } from '../server/gates.ts';
import { register } from '../server/queue.ts';
import { analyzeJson, generateImage } from '../server/provider.ts';
import { createAsset, assetImage } from './assets.ts';
import type { ProductScriptBundle, StylistScriptPart, StylistScenePlan, Asset } from '../shared/types.ts';


const METADATA_PROMPT = `Analyze this product photo for a fashion e-commerce catalog.
Return ONLY valid JSON:
{"title":"","brand":"","price":0,"currency":"CLP","description":"","composition":"","sizes":["XS","S","M","L","XL"],"category":"Tops|Bottoms|Chaquetas|Tejidos|Vestidos|Conjuntos|Accesorios"}`;

register('intake.metadata', async (p) => {
  const img = await assetImage(p.assetId);
  const { data, model } = await analyzeJson<any>({ prompt: METADATA_PROMPT, images: [img] });
  const existing = get<any>(`SELECT * FROM products WHERE id=?`, [p.productId]);
  run(
    `UPDATE products SET title=?, brand=?, price=?, currency=?, description=?, composition=?,
       sizes_json=?, category=? WHERE id=?`,
    [
      existing?.title && existing.title !== 'Producto' ? existing.title : (data.title || 'Prenda Editorial'),
      existing?.brand || data.brand || 'ATELIER',
      existing?.price || data.price || 39990,
      existing?.currency || data.currency || 'CLP',
      existing?.description || data.description || null,
      existing?.composition || data.composition || null,
      JSON.stringify(data.sizes || ['XS', 'S', 'M', 'L', 'XL']),
      data.category || existing?.category || 'Tops',
      p.productId,
    ],
  );
  return { productId: p.productId, model, costUsd: 0.001 };
});

export async function ingestProduct(opts: {
  projectId: string;
  buffer: Buffer;
  filename?: string;
  title?: string;
  colorName?: string;
  sourceUrl?: string;
}) {
  const productId = uid('pr_');
  run(
    `INSERT INTO products(id, project_id, title, source_url, created_at) VALUES(?,?,?,?,?)`,
    [productId, opts.projectId, opts.title || opts.filename || 'Producto', opts.sourceUrl || null, now()],
  );
  const asset = await createAsset({
    projectId: opts.projectId,
    productId,
    type: 'garment_raw',
    stage: 'draft',
    buffer: opts.buffer,
  });
  return { productId, assetId: asset.id };
}

function extractMetaTag(html: string, prop: string): string | undefined {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
  return (html.match(re1)?.[1] || html.match(re2)?.[1])?.trim();
}

function extractJsonLdProduct(html: string): any | null {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const s of scripts) {
    const body = s.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    try {
      const parsed = JSON.parse(body);
      const candidates = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];
      const prod = candidates.find((c: any) => c && (c['@type'] === 'Product' || c['@type'] === 'ProductGroup'));
      if (prod) return prod;
    } catch {
      // ignore invalid JSON-LD block
    }
  }
  return null;
}

/**
 * Integración Virtual Product Stylist: Extractor e-commerce por URL (JSON-LD + OpenGraph + Deduplicación SHA-256)
 */
export async function ingestProductFromUrl(opts: {
  projectId: string;
  url: string;
  fallbackTitle?: string;
}) {
  const rawUrl = String(opts.url || '').trim();
  if (!/^https?:\/\//i.test(rawUrl)) {
    throw new Error('La URL debe comenzar con http:// o https://');
  }

  let title = opts.fallbackTitle || '';
  let brand = 'ATELIER';
  let price: number | null = null;
  let currency = 'CLP';
  let description = '';
  let imageUrls: string[] = [];
  let discoveredColors: string[] = [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(rawUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AtelierCatalogBot/2.0)',
        Accept: 'text/html,application/xhtml+xml,application/json',
      },
    });
    clearTimeout(timer);

    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('image/')) {
      const arr = await resp.arrayBuffer();
      const buf = Buffer.from(arr);
      const urlSlug = new URL(rawUrl).pathname.split('/').pop() || 'Prenda URL';
      const res = await ingestProduct({
        projectId: opts.projectId,
        buffer: buf,
        filename: urlSlug,
        title: title || urlSlug,
        sourceUrl: rawUrl,
      });
      return { ...res, extractedFrom: 'direct-image', discoveredColors: [] };
    }

    const html = await resp.text();
    const ld = extractJsonLdProduct(html);
    if (ld) {
      title = title || ld.name || '';
      brand = (typeof ld.brand === 'object' ? ld.brand?.name : ld.brand) || brand;
      description = ld.description || '';
      const offers = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
      if (offers?.price) price = Number(offers.price) || null;
      if (offers?.priceCurrency) currency = String(offers.priceCurrency);
      const imgs = Array.isArray(ld.image) ? ld.image : ld.image ? [ld.image] : [];
      for (const im of imgs) {
        const u = typeof im === 'string' ? im : im?.url;
        if (u) imageUrls.push(u);
      }
      if (ld.color) discoveredColors.push(String(ld.color));
    }

    title = title || extractMetaTag(html, 'og:title') || extractMetaTag(html, 'twitter:title') || '';
    description = description || extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description') || '';
    const ogImg = extractMetaTag(html, 'og:image') || extractMetaTag(html, 'twitter:image');
    if (ogImg) imageUrls.push(ogImg);
    const ogPrice = extractMetaTag(html, 'product:price:amount') || extractMetaTag(html, 'og:price:amount');
    if (!price && ogPrice) price = Number(ogPrice.replace(/[^0-9.]/g, '')) || null;
    const ogCurr = extractMetaTag(html, 'product:price:currency') || extractMetaTag(html, 'og:price:currency');
    if (ogCurr) currency = ogCurr;
  } catch {
    // Fallback determinista cuando la URL es de entorno local/offline o bloquea bots
  }

  if (!title) {
    try {
      const u = new URL(rawUrl);
      const slug = u.pathname.split('/').filter(Boolean).pop() || 'prenda-ecommerce';
      title = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    } catch {
      title = 'Prenda E-Commerce URL';
    }
  }

  let primaryBuffer: Buffer | null = null;
  const seenHashes = new Set<string>();

  for (const imgUrl of imageUrls.slice(0, 3)) {
    try {
      const resolvedUrl = new URL(imgUrl, rawUrl).toString();
      const r = await fetch(resolvedUrl);
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      const sha = crypto.createHash('sha256').update(buf).digest('hex');
      if (seenHashes.has(sha)) continue;
      const meta = await sharp(buf).metadata();
      if ((meta.width || 0) >= 64 && (meta.height || 0) >= 64) {
        seenHashes.add(sha);
        if (!primaryBuffer) primaryBuffer = buf;
      }
    } catch {
      // ignore failed secondary image
    }
  }

  if (!primaryBuffer) {
    const g = await generateImage({
      prompt: `Product photograph of ${title} on pure white background #FFFFFF`,
      aspectRatio: '3:4',
      label: `URL · ${title.slice(0, 22)}`,
    });
    primaryBuffer = g.buffer;
  }

  const productId = uid('pr_');
  run(
    `INSERT INTO products(id, project_id, title, brand, price, currency, description, source_url, category, created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [
      productId,
      opts.projectId,
      title.slice(0, 120),
      brand.slice(0, 60),
      price || 44990,
      currency.slice(0, 10),
      description ? description.slice(0, 400) : `Extraído automáticamente desde ${rawUrl}`,
      rawUrl,
      'Tops',
      now(),
    ],
  );

  const asset = await createAsset({
    projectId: opts.projectId,
    productId,
    type: 'garment_raw',
    stage: 'draft',
    buffer: primaryBuffer,
  });

  for (const col of discoveredColors.slice(0, 4)) {
    addVariant(productId, col);
  }

  return { productId, assetId: asset.id, title, discoveredColors };
}

/**
 * Integración Virtual Product Stylist: Generador de Guión de Estilista (5 secciones) + Planificador de Escenas (5 tomas)
 */
export function generateProductScript(productId: string): ProductScriptBundle {
  const product = get<any>(`SELECT * FROM products WHERE id=?`, [productId]);
  if (!product) throw new Error('Producto no encontrado');
  const lock = get<any>(`SELECT * FROM locks WHERE product_id=? ORDER BY created_at DESC LIMIT 1`, [productId]);
  const dna = lock?.garment_dna_json ? JSON.parse(lock.garment_dna_json) : null;
  const attrs = dna?.verifiedAttributes || {};
  const assets = all<any>(`SELECT * FROM assets WHERE product_id=? ORDER BY created_at DESC`, [productId]);

  const title = product.title || 'Prenda de Colección';
  const color = attrs.color || 'tono original de colección';
  const fabric = product.composition || attrs.fabricAppearance || 'tejido seleccionado de alta densidad';
  const silhouette = attrs.silhouette || 'corte arquitectónico contemporáneo';
  const neckline = attrs.neckline || 'terminación limpia en cuello';
  const sleeves = attrs.sleeveLength || 'proporción equilibrada';

  const parts: StylistScriptPart[] = [
    {
      section: 'INTRO',
      durationSec: 5,
      narration: `Presentamos ${title} en ${color}: una pieza esencial de ${product.category || 'colección'} diseñada con ${silhouette}.`,
      visualFocus: 'Plano entero frontal (Hero shot) destacando caída general y presencia cromática.',
    },
    {
      section: 'DETAILS',
      durationSec: 7,
      narration: `Confeccionada en ${fabric}, destaca por su ${neckline}, costuras de precisión (${attrs.visibleSeams || 'a tono'}) y textura verificada 1:1.`,
      visualFocus: 'Close-up macro a trama textil, cuello, botonadura y terminaciones.',
    },
    {
      section: 'FIT',
      durationSec: 6,
      narration: `Su estructura de ${silhouette} y manga ${sleeves} ofrece un calce versátil que estiliza la línea de hombros con caída natural.`,
      visualFocus: 'Giro de perfil 3/4 y vista lateral para demostrar aplomo y ajuste anatómico.',
    },
    {
      section: 'STYLING',
      durationSec: 6,
      narration: `Combínala en clave minimalista para e-commerce editorial o elévala con sastrería neutra para un look de día a noche.`,
      visualFocus: 'Toma en movimiento fluido (Pasarela / Contrapposto) mostrando dinamismo del tejido.',
    },
    {
      section: 'CLOSING',
      durationSec: 4,
      narration: `Disponible en tallas ${product.sizes_json ? JSON.parse(product.sizes_json).join(', ') : 'XS a XL'}. Fidelidad visual certificada por ATELIER Garment Lock.`,
      visualFocus: 'Composición final de catálogo con vistas múltiples y sello de calidad.',
    },
  ];

  const findAsset = (types: string[]) => assets.find((a) => types.includes(a.type))?.id;

  const scenes: StylistScenePlan[] = [
    {
      id: 1,
      type: 'INTRO',
      cameraAngle: 'Eye-level Full Shot (3:4)',
      movement: 'Slow push-in 5%',
      durationSec: 5,
      description: `Presentación frontal de ${title} sobre ciclorama blanco.`,
      linkedAssetId: findAsset(['tryon', 'view_front', 'garment_cut']),
    },
    {
      id: 2,
      type: 'DETAIL',
      cameraAngle: 'Macro Close-Up Textil',
      movement: 'Pan vertical suave de cuello a basta',
      durationSec: 7,
      description: `Detalle constructivo: ${fabric}, ${neckline} y costuras.`,
      linkedAssetId: findAsset(['garment_cut', 'ghost']),
    },
    {
      id: 3,
      type: 'FIT',
      cameraAngle: 'Perfil 3/4 Lateral',
      movement: 'Órbita editorial 45°',
      durationSec: 6,
      description: `Demostración de calce (${silhouette}) y caída lateral.`,
      linkedAssetId: findAsset(['view_left', 'view_right', 'tryon']),
    },
    {
      id: 4,
      type: 'STYLING',
      cameraAngle: 'Contrapicado Sutil de Pasarela',
      movement: 'Tracking frontal en paso',
      durationSec: 6,
      description: 'Movimiento dinámico del textil y vista posterior.',
      linkedAssetId: findAsset(['view_back', 'tryon']),
    },
    {
      id: 5,
      type: 'CLOSING',
      cameraAngle: 'Composición Editorial Haute Couture',
      movement: 'Static Lock-off',
      durationSec: 4,
      description: 'Cierre de catálogo multi-vista.',
      linkedAssetId: findAsset(['composed', 'tryon']),
    },
  ];

  const bundle: ProductScriptBundle = {
    productId,
    generatedAt: now(),
    model: 'atelier-stylist-script-v2',
    parts,
    scenes,
    fullText: parts.map((p) => `[${p.section} · ${p.durationSec}s] ${p.narration}`).join('\n\n'),
  };

  run(`UPDATE products SET script_json=? WHERE id=?`, [JSON.stringify(bundle), productId]);
  return bundle;
}

export function addVariant(productId: string, colorName: string, colorHex?: string) {
  const id = uid('vr_');
  run(`INSERT INTO variants(id, product_id, color_name, color_hex, status) VALUES(?,?,?,?,?)`, [
    id, productId, colorName, colorHex || null, 'pending_references',
  ]);
  return get(`SELECT * FROM variants WHERE id=?`, [id]);
}

export const listVariants = (productId: string) =>
  all(`SELECT * FROM variants WHERE product_id=?`, [productId]);


export function assignRawAssetVariant(assetId: string, variantId: string | null) {
  return tx(() => {
    const asset = get<Asset>(`SELECT * FROM assets WHERE id=?`, [assetId]);
    if (!asset) throw new GateError('ASSET_NOT_FOUND', 'Fotografía original no encontrada');
    if (asset.type !== 'garment_raw') {
      throw new GateError('ASSET_NOT_GARMENT_RAW', 'Solo se pueden asignar a variantes las fotografías originales (garment_raw)');
    }
    if (!asset.product_id) {
      throw new GateError('ASSET_PRODUCT_MISSING', 'La fotografía original no está vinculada a un producto');
    }
    const cleanVariantId = variantId ? String(variantId).trim() : null;
    if (cleanVariantId) {
      const variant = get<any>(`SELECT * FROM variants WHERE id=? AND product_id=?`, [cleanVariantId, asset.product_id]);
      if (!variant) {
        throw new GateError('VARIANT_PRODUCT_MISMATCH', 'La variante seleccionada no pertenece a esta prenda');
      }
    }

    const previousVariantId = asset.variant_id ?? null;
    if (previousVariantId === cleanVariantId) {
      return { asset, invalidatedLocks: [] as string[], invalidatedAssets: [] as string[] };
    }

    run(`UPDATE assets SET variant_id=? WHERE id=?`, [cleanVariantId, asset.id]);

    const productLocks = all<any>(`SELECT * FROM locks WHERE product_id=?`, [asset.product_id]);
    const invalidatedLocks: string[] = [];
    const invalidatedAssets: string[] = [];

    for (const lk of productLocks) {
      let ids: string[] = [];
      try {
        ids = JSON.parse(lk.source_asset_ids_json || '[]');
      } catch {
        ids = [];
      }
      let currentScopeRaws = all<Asset>(
        `SELECT id FROM assets WHERE product_id=? AND COALESCE(variant_id, '') = COALESCE(?, '') AND type='garment_raw'`,
        [asset.product_id, lk.variant_id ?? null],
      ).map((r) => r.id);
      const removedFromLock = Array.isArray(ids) && ids.includes(asset.id) && (lk.variant_id ?? null) !== cleanVariantId;
      const addedToScope = (lk.variant_id ?? null) === cleanVariantId && (!Array.isArray(ids) || !ids.includes(asset.id));

      if (removedFromLock || (addedToScope && currentScopeRaws.length > ids.length)) {
        run(`UPDATE locks SET approved=0, status='stale_reference' WHERE id=?`, [lk.id]);
        invalidatedLocks.push(lk.id);
        const dependentAssets = all<Asset>(`SELECT * FROM assets WHERE lock_id=?`, [lk.id]);
        for (const dep of dependentAssets) {
          if (dep.approved || dep.approval_evidence) {
            run(`UPDATE assets SET approved=0, approval_evidence=NULL, stage='qa' WHERE id=?`, [dep.id]);
            invalidatedAssets.push(dep.id);
          }
        }
      }


    }

    refreshVariantStatus(previousVariantId);
    refreshVariantStatus(cleanVariantId);
    audit('asset', asset.id, 'variant_assigned', {
      fromVariantId: previousVariantId,
      toVariantId: cleanVariantId,
      invalidatedLocks,
      invalidatedAssets,
    });

    return {
      asset: get<Asset>(`SELECT * FROM assets WHERE id=?`, [asset.id])!,
      invalidatedLocks,
      invalidatedAssets,
    };
  });
}

export async function uploadProductReference(opts: {
  productId: string;
  variantId?: string | null;
  buffer: Buffer;
}) {
  const product = get<any>(`SELECT * FROM products WHERE id=?`, [opts.productId]);
  if (!product) throw new GateError('PRODUCT_NOT_FOUND', 'Producto no encontrado');
  const cleanVariantId = opts.variantId ? String(opts.variantId).trim() : undefined;
  if (cleanVariantId) {
    const v = get<any>(`SELECT * FROM variants WHERE id=? AND product_id=?`, [cleanVariantId, product.id]);
    if (!v) throw new GateError('VARIANT_PRODUCT_MISMATCH', 'La variante indicada no pertenece al producto');
  }
  const asset = await createAsset({
    projectId: product.project_id,
    productId: product.id,
    variantId: cleanVariantId,
    type: 'garment_raw',
    stage: 'draft',
    buffer: opts.buffer,
  });
  const scopeLocks = all<any>(
    `SELECT * FROM locks WHERE product_id=? AND COALESCE(variant_id, '') = COALESCE(?, '') AND approved=1`,
    [product.id, cleanVariantId || null],
  );
  for (const lk of scopeLocks) {
    run(`UPDATE locks SET approved=0, status='stale_reference' WHERE id=?`, [lk.id]);
    const dependentAssets = all<Asset>(`SELECT * FROM assets WHERE lock_id=?`, [lk.id]);
    for (const dep of dependentAssets) {
      if (dep.approved || dep.approval_evidence) {
        run(`UPDATE assets SET approved=0, approval_evidence=NULL, stage='qa' WHERE id=?`, [dep.id]);
      }
    }
  }

  if (cleanVariantId) refreshVariantStatus(cleanVariantId);
  return asset;

}


export function refreshVariantStatus(variantId?: string | null) {
  if (!variantId) return;
  const v = get<any>(`SELECT * FROM variants WHERE id=?`, [variantId]);
  if (!v) return;
  const rawCount = get<any>(
    `SELECT COUNT(*) AS c FROM assets WHERE product_id=? AND variant_id=? AND type='garment_raw'`,
    [v.product_id, v.id],
  )?.c || 0;
  if (rawCount === 0) {
    run(`UPDATE variants SET status='pending_references' WHERE id=?`, [v.id]);
    return;
  }
  const approvedLock = get<any>(
    `SELECT id FROM locks WHERE product_id=? AND variant_id=? AND approved=1 ORDER BY created_at DESC LIMIT 1`,
    [v.product_id, v.id],
  );
  if (approvedLock) {
    run(`UPDATE variants SET status='ready' WHERE id=?`, [v.id]);
    return;
  }
  const anyLock = get<any>(
    `SELECT id FROM locks WHERE product_id=? AND variant_id=? ORDER BY created_at DESC LIMIT 1`,
    [v.product_id, v.id],
  );
  run(`UPDATE variants SET status=? WHERE id=?`, [anyLock ? 'pending_lock_approval' : 'pending_lock', v.id]);
}

