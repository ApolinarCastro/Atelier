import sharp from 'sharp';
import { get, run, now, uid, all } from '../server/db.ts';
import { register } from '../server/queue.ts';
import { generateImage } from '../server/provider.ts';
import { castingPrompt } from './prompts.ts';
import { createAsset, assetImage } from './assets.ts';
import { SUPERMODEL_ARCHETYPES } from '../shared/catalog.ts';
import type { ModelDNA, SkinToneSwatch } from '../shared/types.ts';

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function classifySkinToneFromLuminance(luma: number): string {
  if (luma > 205) return 'Fair Porcelain (Piel Muy Clara)';
  if (luma > 180) return 'Light Neutral (Piel Clara)';
  if (luma > 155) return 'Medium Warm (Piel Media)';
  if (luma > 130) return 'Olive Mediterranean (Oliva)';
  if (luma > 95) return 'Tan Bronze (Bronce Cálido)';
  return 'Deep Ebony (Ébano Profundo)';
}

export async function extractBiometricSkinPalette(
  buffer: Buffer,
  fallbackTone = 'medium',
): Promise<{ classifiedTone: string; swatches: SkinToneSwatch[] }> {
  try {
    const { data, info } = await sharp(buffer)
      .resize(64, 64, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels: { r: number; g: number; b: number; luma: number }[] = [];
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Exclude pure white/black backgrounds
      if (r > 244 && g > 244 && b > 244) continue;
      if (r < 12 && g < 12 && b < 12) continue;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      pixels.push({ r, g, b, luma });
    }

    if (pixels.length < 20) {
      throw new Error('Píxeles insuficientes');
    }

    pixels.sort((a, b) => b.luma - a.luma);
    const labels = ['Highlight', 'Light Base', 'True Midtone', 'Warm Contour', 'Deep Shadow'];
    const bucketSize = Math.max(1, Math.floor(pixels.length / 5));
    const swatches: SkinToneSwatch[] = [];

    for (let bIdx = 0; bIdx < 5; bIdx++) {
      const slice = pixels.slice(bIdx * bucketSize, (bIdx + 1) * bucketSize);
      if (!slice.length) continue;
      const r = Math.round(slice.reduce((s, p) => s + p.r, 0) / slice.length);
      const g = Math.round(slice.reduce((s, p) => s + p.g, 0) / slice.length);
      const b = Math.round(slice.reduce((s, p) => s + p.b, 0) / slice.length);
      swatches.push({
        hex: rgbToHex(r, g, b),
        rgb: [r, g, b],
        percentage: 20,
        label: labels[bIdx],
      });
    }

    const mid = swatches[2] || swatches[0];
    const midLuma = 0.299 * mid.rgb[0] + 0.587 * mid.rgb[1] + 0.114 * mid.rgb[2];
    return {
      classifiedTone: classifySkinToneFromLuminance(midLuma),
      swatches,
    };
  } catch {
    const toneMap: Record<string, [number, number, number]> = {
      fair: [238, 212, 198],
      light: [226, 194, 173],
      medium: [198, 156, 128],
      olive: [184, 143, 110],
      tan: [156, 108, 77],
      dark: [88, 56, 41],
    };
    const base = toneMap[fallbackTone] || toneMap.medium;
    const luma = 0.299 * base[0] + 0.587 * base[1] + 0.114 * base[2];
    return {
      classifiedTone: classifySkinToneFromLuminance(luma),
      swatches: [
        { label: 'Highlight', rgb: [Math.min(255, base[0] + 22), Math.min(255, base[1] + 22), Math.min(255, base[2] + 22)], hex: rgbToHex(base[0] + 22, base[1] + 22, base[2] + 22), percentage: 20 },
        { label: 'Base', rgb: base, hex: rgbToHex(base[0], base[1], base[2]), percentage: 50 },
        { label: 'Shadow', rgb: [Math.max(0, base[0] - 28), Math.max(0, base[1] - 28), Math.max(0, base[2] - 28)], hex: rgbToHex(base[0] - 28, base[1] - 28, base[2] - 28), percentage: 30 },
      ],
    };
  }
}

register('casting.portrait', async (p) => {
  const modelRow = get<any>(`SELECT * FROM models WHERE id=?`, [p.modelId]);
  const ref = p.referenceAssetId ? [await assetImage(p.referenceAssetId)] : [];
  const g = await generateImage({
    prompt: castingPrompt(p.dna),
    images: ref,
    aspectRatio: '3:4',
    label: `MODELO · ${p.dna?.archetype_id || 'retrato'}`,
    seed: modelRow?.seed,
  });
  const a = await createAsset({
    projectId: p.projectId,
    modelId: p.modelId,
    type: 'model_portrait',
    stage: 'draft',
    buffer: g.buffer,
  });

  // Extrae paleta biométrica de piel (Clone Studio) y actualiza el DNA del modelo
  const biometricPalette = await extractBiometricSkinPalette(g.buffer, p.dna?.skin_tone);
  const currentDna: ModelDNA = modelRow?.dna_json ? JSON.parse(modelRow.dna_json) : p.dna || {};
  currentDna.biometricPalette = biometricPalette;
  run(`UPDATE models SET dna_json=? WHERE id=?`, [JSON.stringify(currentDna), p.modelId]);

  return { assetId: a.id, model: g.model, costUsd: g.costUsd, biometricPalette };
});

register('casting.panel', async (p) => {
  const modelRow = get<any>(`SELECT * FROM models WHERE id=?`, [p.modelId]);
  const ref = p.referenceAssetId ? [await assetImage(p.referenceAssetId)] : [];
  const g = await generateImage({
    prompt: castingPrompt(p.dna, { panel: true }),
    images: ref,
    aspectRatio: '16:9',
    label: `PANEL 5 POSES · ${p.dna?.archetype_id || 'KORA'}`,
    seed: modelRow?.seed,
  });
  const a = await createAsset({
    projectId: p.projectId,
    modelId: p.modelId,
    type: 'model_sheet',
    stage: 'draft',
    buffer: g.buffer,
  });
  run(`UPDATE models SET sheet_asset_id=?, status='review' WHERE id=?`, [a.id, p.modelId]);
  return { assetId: a.id, model: g.model, costUsd: g.costUsd };
});

register('casting.expressions', async (p) => {
  const modelRow = get<any>(`SELECT * FROM models WHERE id=?`, [p.modelId]);
  if (!modelRow) throw new Error('Modelo no encontrado');
  const dna: ModelDNA = modelRow.dna_json ? JSON.parse(modelRow.dna_json) : p.dna || {};
  const ref = modelRow.sheet_asset_id ? [await assetImage(modelRow.sheet_asset_id)] : [];
  const g = await generateImage({
    prompt: castingPrompt(dna, { expressions: true }),
    images: ref,
    aspectRatio: '16:9',
    label: `5 EXPRESIONES · ${modelRow.name}`,
    seed: modelRow.seed,
  });
  const a = await createAsset({
    projectId: p.projectId,
    modelId: p.modelId,
    type: 'model_expressions',
    stage: 'draft',
    buffer: g.buffer,
  });
  return { assetId: a.id, model: g.model, costUsd: g.costUsd };
});

export function createModel(projectId: string, name: string, dna: ModelDNA) {
  const id = uid('md_');
  const arch = SUPERMODEL_ARCHETYPES.find(
    (a) => a.id === dna.archetype_id || a.id === name || a.name === dna.archetype_id,
  );
  const mergedDna: ModelDNA = {
    ...(arch?.dna || {}),
    ...dna,
    archetype_id: arch?.id || dna.archetype_id || name,
    resolution: dna.resolution || '4K',
  };
  run(
    `INSERT INTO models(id, project_id, name, archetype, dna_json, seed, status, created_at)
     VALUES(?,?,?,?,?,?,?,?)`,
    [id, projectId, name, mergedDna.archetype_id || 'custom', JSON.stringify(mergedDna), uid('seed_'), 'draft', now()],
  );
  return get(`SELECT * FROM models WHERE id=?`, [id]);
}

export const listModels = (projectId: string) =>
  all(`SELECT * FROM models WHERE project_id=? ORDER BY created_at DESC`, [projectId]);
