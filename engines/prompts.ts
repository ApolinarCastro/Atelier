import type { GarmentDNA, ModelDNA, ReferenceManifestEntry } from '../shared/types.ts';
import { validateExactModeConfig } from '../server/gates.ts';

import {
  SUPERMODEL_ARCHETYPES,
  getArchetype,
  EXPRESSIONS_PANEL_LIST,
  STYLE_PRESETS,
  SKELETAL_POSE_PRESETS,
  BACKGROUND_PRESETS,
  POSE_SUGGESTIONS,
  COMMERCIAL_FASHION_CATALOG_PREAMBLE,
} from '../shared/catalog.ts';

export const NEGATIVE = `
NEGATIVO: rostro recortado, cabeza cortada, fondo gris no solicitado, piel plástica,
caricatura, ilustración, render 3D, deformidades, manos incorrectas, texto, watermark,
joyería, tatuajes, lunares o maquillaje transferidos desde la foto de prenda.`;

const ALLOWED_DNA_KEYS = new Set([
  'archetype_id', 'name', 'age_apparent', 'height_m', 'ethnicity', 'body_type',
  'skin_tone', 'skin_undertone', 'skin_pore_visibility', 'facial_features', 'eye_color',
  'hair_color', 'hair_style', 'makeup', 'expression', 'pose', 'lighting_setup', 'background', 'resolution',
]);

function cleanValue(val: unknown): string {
  const raw = Array.isArray(val) ? val.join(', ') : String(val ?? '');
  return raw.replace(/[\r\n`{}[\]\\]/g, ' ').trim().slice(0, 180);
}

export function castingPrompt(
  dna: ModelDNA,
  opts: { panel?: boolean; expressions?: boolean } = {},
) {
  const arch = getArchetype(dna?.archetype_id) || SUPERMODEL_ARCHETYPES.find(
    (a) => a.id === dna?.archetype_id || a.name === dna?.archetype_id,
  );
  const dnaLine = Object.entries(dna || {})
    .filter(([k, v]) => ALLOWED_DNA_KEYS.has(k) && v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${cleanValue(v)}`)
    .join('\n');

  const koraCanon = `CANON TÉCNICO KORA v1.5 ULTRA (${dna?.resolution || '4K'}):
- Piel hiperrealista con poros asimétricos (${cleanValue(dna?.skin_pore_visibility || 'natural visible pores')}), micro-relieve epidérmico y dispersión subsuperficial (SSS) real.
- Ojos con refracción de iris detallada y menisco lagrimal natural.
- Anatomía exacta de manos, clavículas, cuello y distribución de peso humano real.`;

  if (opts.expressions) {
    return `${COMMERCIAL_FASHION_CATALOG_PREAMBLE}
Genera UNA hoja de contacto horizontal (16:9) dividida en 5 paneles verticales con el MISMO sujeto exacto sobre fondo blanco puro (#FFFFFF), misma iluminación de estudio y vestuario neutro idéntico, mostrando estas 5 micro-expresiones editoriales:
${EXPRESSIONS_PANEL_LIST.join('\n')}

La identidad facial, estructura ósea, tono de piel y cabello deben ser 100% idénticos en los 5 paneles. Sin texto sobre la imagen.

${arch ? `BASE ARQUETIPO (${arch.name}): ${arch.prompts.panel}\n` : ''}
DNA (inmutable):
${dnaLine}
${koraCanon}
${NEGATIVE}`;
  }

  if (opts.panel) {
    return `${COMMERCIAL_FASHION_CATALOG_PREAMBLE}
${arch ? arch.prompts.panel : `Genera UNA hoja de contactos horizontal (16:9) con 5 tomas del MISMO sujeto, fondo blanco puro (#FFFFFF), misma iluminación, misma ropa neutra:
1) frontal  2) tres cuartos izquierdo  3) perfil lateral 90°  4) mano al rostro  5) mirada sobre el hombro.`}
La identidad debe ser idéntica en las 5 celdas. Sin texto ni marcas.

DNA (inmutable):
${dnaLine}
${koraCanon}
${NEGATIVE}`;
  }

  return `${COMMERCIAL_FASHION_CATALOG_PREAMBLE}
ACT AS A MASTER PHOTOGRAPHER & CGI SCIENTIST (KORA v1.5 ULTRA).
${arch ? arch.prompts.ecommerce : 'Genera un retrato hiperrealista de estudio, uso editorial y e-commerce.'}

REGLAS DE IDENTIDAD (inmutables):
- La identidad se define SOLO por el DNA adjunto. No inventes rasgos fuera de él.
- Si se adjunta una imagen de referencia, esa imagen ES la identidad.

${koraCanon}

ENCUADRE: fondo ${cleanValue(dna?.background || 'blanco puro (#FFFFFF)')}, iluminación ${cleanValue(dna?.lighting_setup || 'estudio de 5 puntos')}, composición centrada.

DNA (inmutable):
${dnaLine}
${NEGATIVE}`;
}

export const LOCK_ANALYSIS = `You are a forensic fashion inspector creating a deterministic Garment Lock descriptor from original product photography.
Analyze the provided product image(s). Only report attributes visually verified with high confidence.
Evaluate: color, pattern, silhouette, neckline, lapel, buttonCount, buttonPlacement,
pocketCount, pocketType, sleeveLength, cuffDetails, hemShape, fabricAppearance,
visibleSeams, visibleConstructionDetails.
List attributes that cannot be determined in unknownAttributes.
Return ONLY valid JSON:
{"descriptor":"2-3 frases objetivas en español","verifiedAttributes":{"color":"","pattern":"","silhouette":"","neckline":"","lapel":"","buttonCount":0,"buttonPlacement":"","pocketCount":0,"pocketType":"","sleeveLength":"","cuffDetails":"","hemShape":"","fabricAppearance":"","visibleSeams":"","visibleConstructionDetails":""},"unknownAttributes":[]}`;

export const ISOLATE = `${COMMERCIAL_FASHION_CATALOG_PREAMBLE}
Isolate the exact garment from the provided product references.
Remove: person, background, floor, walls, unrelated objects, other garments, jewelry or accessories not belonging to the garment.
Preserve 1:1: color, pattern, silhouette, neckline, lapels, buttons, pockets, sleeves, cuffs, hem, texture, visible seams, construction details.
Do not redesign. Do not stylize. Do not beautify. Do not add missing details. Do not modify proportions.
Output on pure white #FFFFFF with neutral even studio light.`;

export const QA_PROMPT = `Compare SOURCE (image 1: approved garment lock) against CANDIDATE (image 2: rendered output) using the 5-Control Deterministic & Forensic QA Protocol (Clone Studio V5).
Evaluate each garment attribute with: MATCH | POSSIBLE_MISMATCH | MISMATCH | NOT_VISIBLE.
Attributes: color, pattern, silhouette, neckline, lapels, buttons, pockets, sleeves, hem, texture,
addedElements (MATCH if nothing invented), missingElements (MATCH if everything preserved).
Also evaluate the 5 Mandatory Controls:
- controlA_identity: Avatar facial/body identity preserved without distortion.
- controlB_prohibitedExclusion: Zero unrequested jewelry, lipstick changes, makeup changes, or skin marks imported from garment source.
- controlC_textileFidelity: 1:1 garment silhouette, color, seams, and drape fidelity.
- controlD_compositionPose: Full framing without cropped head/feet and natural anatomy.
- controlE_technicalQuality: Clean lighting, sharp focus, commercial catalog readiness.
overallStatus = PASS if color, silhouette, pattern and addedElements are MATCH or POSSIBLE_MISMATCH and controls A, B, C pass.
overallStatus = FAIL if any critical MISMATCH in color, silhouette, addedElements, or control failure.
Return ONLY valid JSON:
{"overallStatus":"PASS|FAIL","attributes":{...},"hasCriticalMismatch":false,"notes":"","controls":{"controlA_identity":{"passed":true,"confidence":0.98,"details":""},"controlB_prohibitedExclusion":{"passed":true,"noJewelryAdded":true,"noLipstickChange":true,"noMakeupChange":true,"noSkinMarksImported":true,"noAnatomyDeformation":true,"violations":[]},"controlC_textileFidelity":{"passed":true,"silhouetteIntact":true,"details":""},"controlD_compositionPose":{"passed":true,"posePreserved":true,"details":""},"controlE_technicalQuality":{"passed":true,"details":""},"suggestedAction":"APPROVE|ASSISTED_RETRY|HALT_PRESERVE_PREVIOUS"}}`;

export interface ColorVariant {
  color_name: string;
  color_hex?: string;
}

export interface RenderParams {
  view?: string;
  drape?: number;
  wrinkle?: number;
  sheen?: string;
  texture?: number;
  garmentFocus?: string;
  colorVariant?: ColorVariant;
  referenceManifest?: ReferenceManifestEntry[];
  // Integración Virtual Stylist Pro
  stylePresetId?: string;
  fabricType?: string;
  // Integración Dirección de Pose
  poseCategory?: string;
  frameType?: string;
  plane?: string;
  cameraAngle?: string;
  attitude?: string;
  // Integración Clone Studio V5
  posePresetId?: string;
  customPoseValues?: Record<string, number>;
  hairColorOverride?: string;
  eyeColorOverride?: string;
  footwearOverride?: string;
  generationMode?: 'exact' | 'v2_strict_lock' | 'creative' | 'minimalist';
  backgroundPresetId?: string;
  additionalPrompt?: string;
  correctionPrompt?: string;
}

function formatReferenceManifest(manifest?: ReferenceManifestEntry[]): Record<string, string> {
  if (!Array.isArray(manifest) || !manifest.length) {
    return {
      IMAGE_1_IDENTITY_SOURCE: 'AVATAR_ONLY — preserve 100% face, bone structure, skin tone, hair, eyes, hands and body proportions from Image 1.',
      IMAGE_2_GARMENT_ORIGINAL: 'ORIGINAL_GARMENT_PHOTO — primary 1:1 source for garment geometry, seams, buttons, neckline, hem, color and fabric weave.',
      AUXILIARY_SUPPORTS: 'Any isolated garment_cut or previous render is an auxiliary support only and never overrides original garment photography.',
      ZERO_CROSS_CONTAMINATION: 'NEVER transfer face, skin tone, hair, jewelry, watches, rings, lipstick, makeup, tattoos or moles from any garment reference.',
    };
  }
  const map: Record<string, string> = {};
  for (const ref of manifest) {
    const label = `IMAGE_${ref.imageIndex}_${ref.role.toUpperCase()}`;
    if (ref.role === 'identity_sheet') {
      map[label] = `Asset ${ref.assetId} (${ref.type}, sha256:${ref.sha256.slice(0, 12)}) — AVATAR_ONLY: exclusive source for face, bone structure, skin tone, hair, eyes, hands and body proportions.`;
    } else if (ref.role === 'garment_original') {
      map[label] = `Asset ${ref.assetId} (${ref.type}, variant:${ref.variantId || 'base'}, sha256:${ref.sha256.slice(0, 12)}) — ORIGINAL_GARMENT_PHOTO: primary 1:1 evidence for garment construction, seams, buttons, neckline, hem, color and fabric weave.`;
    } else if (ref.role === 'garment_cut_support') {
      map[label] = `Asset ${ref.assetId} (${ref.type}, variant:${ref.variantId || 'base'}, sha256:${ref.sha256.slice(0, 12)}) — AUXILIARY_GARMENT_CUT_SUPPORT: isolated silhouette helper only; never overrides original garment photographs.`;
    } else if (ref.role === 'previous_render_support') {
      map[label] = `Asset ${ref.assetId} (${ref.type}, variant:${ref.variantId || 'base'}, sha256:${ref.sha256.slice(0, 12)}) — AUXILIARY_PREVIOUS_RENDER_SUPPORT: prior render to correct; preserve framing/pose while restoring 1:1 fidelity from the original garment photographs and identity sheet.`;
    } else if (ref.role === 'pose_source_support') {
      map[label] = `Asset ${ref.assetId} (${ref.type}, variant:${ref.variantId || 'base'}, sha256:${ref.sha256.slice(0, 12)}) — AUXILIARY_POSE_SOURCE_SUPPORT: source render for pose adjustment; never overrides identity_sheet or garment_original references.`;
    } else if (ref.role === 'background_support') {
      map[label] = `Asset ${ref.assetId} (${ref.type}, sha256:${ref.sha256.slice(0, 12)}) — EXPLICIT_CUSTOM_BACKGROUND: source backdrop to composite the subject and garment onto seamlessly with matching ambient lighting and contact shadows.`;
    } else if (ref.role === 'target_support') {
      map[label] = `Asset ${ref.assetId} (${ref.type}, sha256:${ref.sha256.slice(0, 12)}) — TARGET_SCENE_REFERENCE: source for garment styling, pose, perspective, scale, lighting and camera angle. NEVER transfer identity, face, makeup, jewelry or skin marks from this target to the avatar.`;
    }
  }
  map.ZERO_CROSS_CONTAMINATION =
    'NEVER transfer face, skin tone, hair, jewelry, watches, rings, lipstick, makeup, tattoos or moles from any garment reference, and NEVER treat generated views or cuts as original garment photography.';
  return map;
}


const drapeDesc = (v: number) => (v < 40 ? 'rigid, structured architectural drape' : v < 70 ? 'natural balanced drape' : 'fluid, flowing high-movement drape');
const wrinkleDesc = (v: number) =>
  v < 30 ? 'minimal clean studio folds' : v < 65 ? 'natural realistic motion creases' : 'pronounced organic linen/cotton wrinkling';
const textureDesc = (v: number) =>
  v < 35 ? 'smooth fine surface' : v < 70 ? 'clearly visible weave structure' : 'micro-HD thread and fiber texture';

export function tryOnPrompt(lock: GarmentDNA, params: RenderParams = {}) {
  validateExactModeConfig(params);
  const stylePreset = STYLE_PRESETS.find((s) => s.id === params.stylePresetId);
  const posePreset = SKELETAL_POSE_PRESETS.find((p) => p.id === params.posePresetId);
  const bgPreset = BACKGROUND_PRESETS.find((b) => b.id === params.backgroundPresetId) || BACKGROUND_PRESETS[0];
  const poseGuide = params.poseCategory ? POSE_SUGGESTIONS[params.poseCategory] : undefined;

  const view = params.view || params.frameType || 'Frontal';
  const drape = params.drape ?? stylePreset?.settings.drape ?? 55;
  const wrinkle = params.wrinkle ?? stylePreset?.settings.wrinkle ?? 25;
  const sheen = params.sheen || stylePreset?.settings.sheen || 'matte';
  const texture = params.texture ?? stylePreset?.settings.texture ?? 65;
  const garmentFocus = params.garmentFocus || poseGuide?.focus || stylePreset?.settings.focus || 'the locked garment';
  const colorVariant = params.colorVariant;

  const lockedAttrs = {
    ...(lock.verifiedAttributes || {}),
    ...(params.fabricType && params.fabricType !== 'Original (Lock)' ? { fabricAppearance: params.fabricType } : {}),
    ...(colorVariant ? { color: `${colorVariant.color_name}${colorVariant.color_hex ? ` (${colorVariant.color_hex})` : ''}` } : {}),
  };

  return JSON.stringify(
    {
      prompt_name: 'ATELIER_MasterPrompt_V5_ExactReplica_1to1',
      preamble: COMMERCIAL_FASHION_CATALOG_PREAMBLE,
      objective:
        'Clonar la prenda del Garment Lock con coincidencia visual 1:1 sobre el Avatar aprobado, respetando el orden y rol exacto de cada imagen de referencia, física textil y dirección de pose.',
      mandatory_source_allocation: formatReferenceManifest(params.referenceManifest),

      inputs: {

        visual_lock_code: lock.lockCode || 'VL-LOCKED',
        garment_to_extract: cleanValue(garmentFocus),
        requested_view: cleanValue(view),
        visual_lock_descriptor: lock.descriptor,
        locked_attributes: lockedAttrs,
        color_variant_override: colorVariant || null,
        fabric_physics: {
          style_preset: stylePreset?.name || 'Custom',
          fabric_override: params.fabricType || 'Original (Lock)',
          drape_factor: Math.max(0, Math.min(100, Number(drape) || 55)) / 100,
          drape_description: drapeDesc(Number(drape) || 55),
          wrinkle_intensity: wrinkleDesc(Number(wrinkle) || 25),
          texture_detail: textureDesc(Number(texture) || 65),
          sheen: cleanValue(sheen),
        },
        pose_direction: {
          category: params.poseCategory || 'General',
          frame_type: cleanValue(view),
          photographic_plane: cleanValue(params.plane || 'Plano entero (Full shot)'),
          camera_angle: cleanValue(params.cameraAngle || 'Nivel de ojos (Eye-level neutro)'),
          attitude: cleanValue(params.attitude || 'Segura y natural'),
          category_pose_directive: poseGuide?.pose || 'Postura equilibrada sin cubrir detalles constructivos de la prenda.',
        },
        skeletal_pose_preset: posePreset || params.customPoseValues
          ? {
              id: posePreset?.id || 'custom_13_joint',
              name: posePreset?.name || 'Articulación 13-Ángulos Personalizada',
              description: posePreset?.promptDescription || 'Custom articulated skeletal posture',
              joint_angles: params.customPoseValues || posePreset?.values,
            }
          : null,
        avatar_overrides: {
          generation_mode: params.generationMode || 'exact',
          hair_color: params.hairColorOverride && params.hairColorOverride !== 'original' ? cleanValue(params.hairColorOverride) : 'PRESERVE_AVATAR_ORIGINAL',
          eye_color: params.eyeColorOverride && params.eyeColorOverride !== 'original' ? cleanValue(params.eyeColorOverride) : 'PRESERVE_AVATAR_ORIGINAL',
          footwear: params.footwearOverride && params.footwearOverride !== 'reference' ? cleanValue(params.footwearOverride) : 'PRESERVE_AVATAR_ORIGINAL',
        },
        environment_and_lighting: {
          background_id: bgPreset.id,
          background_name: bgPreset.name,
          background_directive: bgPreset.promptDirective,
          lighting: stylePreset?.settings.lighting || 'Neutral 5-point commercial studio lighting',
        },
        operator_refinement: params.additionalPrompt ? cleanValue(params.additionalPrompt) : null,
        corrective_retry_feedback: params.correctionPrompt ? cleanValue(params.correctionPrompt) : null,
      },
      strict_prohibitions: [
        'No reinterpretar color salvo color_variant_override explícito',
        'No inventar bolsillos, botones, logos ni costuras inexistentes',
        'No transferir joyería, maquillaje ni marcas dérmicas ajenas al Avatar',
        'No recortar cabeza, manos ni pies en planos enteros',
        'No generar texto ni marcas de agua',
      ],
    },
    null,
    2,
  );
}

export function buildCorrectiveRetryPrompt(baseLock: GarmentDNA, correctionInstruction: string, params: RenderParams = {}) {
  return tryOnPrompt(baseLock, {
    ...params,
    correctionPrompt: `CORRECCIÓN PRIORITARIA SOLICITADA POR AUDITORÍA: ${cleanValue(correctionInstruction)}. Mantén intactos todos los atributos de identidad (identity_sheet) y de las fotografías originales de la prenda (garment_original), usando el render previo y el recorte únicamente como apoyos auxiliares.`,
  });
}

export function viewPrompt(view: string, lock: GarmentDNA, lockId: string, colorVariant?: ColorVariant, params: RenderParams = {}) {
  const bgPreset = BACKGROUND_PRESETS.find((b) => b.id === params.backgroundPresetId) || BACKGROUND_PRESETS[0];
  const lockedAttrs = {
    ...(lock.verifiedAttributes || {}),
    ...(colorVariant ? { color: `${colorVariant.color_name}${colorVariant.color_hex ? ` (${colorVariant.color_hex})` : ''}` } : {}),
  };
  const allocationLines = Object.entries(formatReferenceManifest(params.referenceManifest))
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  return `${COMMERCIAL_FASHION_CATALOG_PREAMBLE}
Render requested multi-angle view: ${cleanValue(view).toUpperCase()}.

Mandatory Anchors & Exact Image Order (inmutables):
${allocationLines}
- Visual Lock ID: ${lock.lockCode || lockId}
- Locked attributes: ${JSON.stringify(lockedAttrs)}

Rules:
- Same garment construction on every view: seams, buttons, pockets, hem.
- Same fabric colour ${colorVariant ? `(${colorVariant.color_name} ${colorVariant.color_hex || ''})` : 'sampled 1:1 from original garment photographs'}, no white balance shift.
- Background: ${bgPreset.promptDirective}
- View-specific reconstruction only: infer logically from original garment construction, never redesign, and never treat generated views as original garment evidence.
${params.additionalPrompt ? `- Operator refinement: ${cleanValue(params.additionalPrompt)}` : ''}

Prohibited: new details, changed colour, changed silhouette, added jewelry/accessories, text, watermarks.`;
}

export function ghostPrompt(lock: GarmentDNA, colorVariant?: ColorVariant, additionalPrompt?: string, referenceManifest?: ReferenceManifestEntry[]) {
  const lockedAttrs = {
    ...(lock.verifiedAttributes || {}),
    ...(colorVariant ? { color: `${colorVariant.color_name}${colorVariant.color_hex ? ` (${colorVariant.color_hex})` : ''}` } : {}),
  };
  const allocationLines = Object.entries(formatReferenceManifest(referenceManifest))
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  return `${COMMERCIAL_FASHION_CATALOG_PREAMBLE}
Render the garment in 3D Invisible-Mannequin (Efecto Flotante / Ghost Mannequin) mode, full length, floating centred on pure white #FFFFFF with neutral even studio light and soft contact shadow only beneath the hem.
Show natural 3D interior collar/neck depth as if worn by an invisible form.

Mandatory Reference Order & Roles:
${allocationLines}

Keep exact 1:1: colour, fabric texture, seams, buttons, pockets, hem, proportions — identical to the original garment photographs.
Visual Lock Code: ${lock.lockCode || 'VL-LOCKED'}
Locked attributes: ${JSON.stringify(lockedAttrs)}
${additionalPrompt ? `Operator refinement: ${cleanValue(additionalPrompt)}` : ''}

Do not add a person, limbs, hanger, stand, hands or text.`;
}

export function poseStudioPrompt(opts: {
  category?: string;
  subcategory?: string;
  frameType?: string;
  plane?: string;
  cameraAngle?: string;
  lighting?: string;
  attitude?: string;
  intention?: string;
  garmentFocus?: string;
  customPose?: string;
  correctionPrompt?: string;
  referenceManifest?: ReferenceManifestEntry[];
}) {
  const guide = opts.category ? POSE_SUGGESTIONS[opts.category] : undefined;
  const allocationLines = opts.referenceManifest?.length
    ? `\nMandatory Reference Order & Roles:\n${Object.entries(formatReferenceManifest(opts.referenceManifest)).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n`
    : '';
  return `${COMMERCIAL_FASHION_CATALOG_PREAMBLE}
ACT AS A MASTER FASHION PHOTOGRAPHER & POSE DIRECTOR.
Using the provided reference photographs in their exact declared roles, generate a hyperrealistic studio photograph preserving 100% the subject's facial identity, skin tone, hair, and exact garment construction/color/texture from the original garment references, while applying the following Pose & Camera Direction:
${allocationLines}
- Categoría / Subcategoría de Prenda: ${cleanValue(opts.category || 'Tops')} · ${cleanValue(opts.subcategory || 'General')}
- Tipo de Toma (Encuadre): ${cleanValue(opts.frameType || 'Frontal 1')}
- Plano Fotográfico: ${cleanValue(opts.plane || 'Plano entero (Full shot)')}
- Ángulo de Cámara: ${cleanValue(opts.cameraAngle || 'Nivel de ojos (Eye-level neutro)')}
- Iluminación de Estudio: ${cleanValue(opts.lighting || 'Estudio 5 puntos neutro')}
- Actitud y Expresión: ${cleanValue(opts.attitude || 'Segura y natural')}
- Intención Editorial: ${cleanValue(opts.intention || 'Destacar caída y corte de la prenda')}
- Foco Constructivo de la Prenda: ${cleanValue(opts.garmentFocus || guide?.focus || 'Silueta y costuras limpias')}
- Directriz Biomecánica de Pose: ${cleanValue(opts.customPose || guide?.pose || 'Postura equilibrada sin cubrir detalles clave de la prenda')}
${opts.correctionPrompt ? `\nCORRECCIÓN PUNTUAL SOLICITADA: ${cleanValue(opts.correctionPrompt)}` : ''}

${NEGATIVE}`;
}


