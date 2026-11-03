import sharp from 'sharp';
import { CONFIG, isMock } from './config.ts';

export interface GenImageArgs {
  prompt: string;
  images?: { data: string; mimeType: string }[];
  aspectRatio?: '3:4' | '1:1' | '16:9' | '2:3';
  label?: string;
  seed?: string | number;
  colorHex?: string;
}

const ASPECT_PX: Record<string, [number, number]> = {
  '3:4': [1152, 1536],
  '1:1': [1024, 1024],
  '16:9': [1536, 864],
  '2:3': [1024, 1536],
};

export interface GenResult {
  buffer: Buffer;
  model: string;
  costUsd: number;
  mocked: boolean;
}

export interface ProviderAdapter {
  generateImage?: (args: GenImageArgs) => Promise<GenResult>;
  analyzeJson?: <T = any>(args: {
    prompt: string;
    images?: { data: string; mimeType: string }[];
  }) => Promise<{ data: T; model: string; costUsd: number }>;
}

let customProviderAdapter: ProviderAdapter | null = null;

export function setProviderAdapter(adapter: ProviderAdapter | null) {
  customProviderAdapter = adapter;
}

export function getProviderAdapter(): ProviderAdapter | null {
  return customProviderAdapter;
}


export function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Síntesis visual local cuando no hay GEMINI_API_KEY:
 * - Si hay imagen de prenda real subida por el usuario (images), procesa y compone la foto REAL de la prenda con sharp.
 * - Si es Casting sin foto de referencia, dibuja un maniquí / croquis anatómico de estudio (o panel de 5 poses) indicando cómo activar la API Key.
 */
async function mockImage(args: GenImageArgs): Promise<Buffer> {
  const { prompt, aspectRatio = '3:4', label = 'ATELIER', colorHex, images = [] } = args;
  const [w, h] = ASPECT_PX[aspectRatio] || ASPECT_PX['3:4'];
  const tag = label.slice(0, 42).replace(/[<>&"']/g, '');

  // Caso 1: Existen imágenes de referencia reales (ej. prenda subida en Intake -> Lock, Ghost, Try-On, Vistas)
  if (images.length > 0) {
    try {
      // Seleccionar la fotografía original de la prenda (no la hoja horizontal 16:9 ni el recorte)
      let garmentRef = images[0];
      for (const candidate of images) {
        const buf = Buffer.from(candidate.data, 'base64');
        const meta = await sharp(buf).metadata();
        if (meta.width && meta.height && meta.width <= meta.height * 1.35) {
          garmentRef = candidate;
          break;
        }
      }
      const rawBuf = Buffer.from(garmentRef.data, 'base64');


      // Verifica que no sea un SVG de panel 16:9, sino una prenda procesable
      let pipeline = sharp(rawBuf);
      if (colorHex) {
        const rgb = hexToRgb(colorHex);
        if (rgb) {
          pipeline = pipeline.tint(rgb);
        }
      }
      if (label.includes('LEFT')) {
        pipeline = pipeline.flop();
      }

      const targetW = Math.round(w * 0.82);
      const targetH = Math.round(h * 0.78);
      const resizedGarment = await pipeline
        .resize({
          width: targetW,
          height: targetH,
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png()
        .toBuffer();

      const badgeSvg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="floorShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#000000" stop-opacity="0.14"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="#ffffff"/>
        <ellipse cx="${w * 0.5}" cy="${h * 0.88}" rx="${w * 0.28}" ry="${h * 0.025}" fill="url(#floorShadow)"/>
        <rect x="24" y="${h - 68}" width="${w - 48}" height="44" rx="8" fill="#18181b" fill-opacity="0.88"/>
        <text x="44" y="${h - 40}" font-family="Helvetica,Arial" font-size="20" fill="#ffffff" font-weight="600">${tag}</text>
      </svg>`;

      const baseCanvas = await sharp(Buffer.from(badgeSvg)).png().toBuffer();
      return await sharp(baseCanvas)
        .composite([
          {
            input: resizedGarment,
            left: Math.round((w - targetW) / 2),
            top: Math.round(h * 0.06),
          },
        ])
        .png()
        .toBuffer();
    } catch {
      // continue to croquis fallback if image buffer cannot be decoded
    }
  }

  // Caso 2: Panel horizontal 16:9 de 5 poses o 5 expresiones (Casting)
  const hum = hash(prompt);
  const skinTones = ['#f3d9c6', '#e8be9f', '#d19c74', '#b97c50', '#7c4b2b'];
  const skinFill = skinTones[hum % skinTones.length];
  const hairFill = ['#1c1917', '#451a03', '#78350f', '#d97706', '#27272a'][(hum >> 3) % 5];

  if (aspectRatio === '16:9') {
    const cellW = Math.floor(w / 5);
    let panelsSvg = '';
    const poseLabels = label.includes('EXPRESIONES')
      ? ['1 · Curiosidad', '2 · Confianza', '3 · Diversión', '4 · Pensativo', '5 · Juguetón']
      : ['1 · Frontal', '2 · Tres Cuartos', '3 · Perfil 90°', '4 · Manos Rostro', '5 · Sobre Hombro'];

    for (let i = 0; i < 5; i++) {
      const cx = i * cellW + cellW / 2;
      const headOffset = i === 2 ? -6 : i === 1 ? -3 : i === 4 ? 4 : 0;
      panelsSvg += `
        <rect x="${i * cellW + 8}" y="16" width="${cellW - 16}" height="${h - 96}" rx="8" fill="#ffffff" stroke="#e4e4e7" stroke-width="2"/>
        <!-- Silueta Editorial Maniquí -->
        <path d="M ${cx - 65} ${h - 110} C ${cx - 62} ${h * 0.52}, ${cx - 45} ${h * 0.44}, ${cx - 18} ${h * 0.42} L ${cx + 18} ${h * 0.42} C ${cx + 45} ${h * 0.44}, ${cx + 62} ${h * 0.52}, ${cx + 65} ${h - 110} Z" fill="#27272a"/>
        <rect x="${cx - 14}" y="${h * 0.34}" width="28" height="44" rx="10" fill="${skinFill}"/>
        <ellipse cx="${cx + headOffset}" cy="${h * 0.25}" rx="42" ry="54" fill="${skinFill}" stroke="#d4d4d8" stroke-width="1.5"/>
        <path d="M ${cx - 44 + headOffset} ${h * 0.24} C ${cx - 44} ${h * 0.14}, ${cx + 44} ${h * 0.14}, ${cx + 44 + headOffset} ${h * 0.24} C ${cx + 30} ${h * 0.19}, ${cx - 30} ${h * 0.19}, ${cx - 44 + headOffset} ${h * 0.24} Z" fill="${hairFill}"/>
        <circle cx="${cx - 14 + headOffset}" cy="${h * 0.24}" r="3.5" fill="#18181b"/>
        <circle cx="${cx + 14 + headOffset}" cy="${h * 0.24}" r="3.5" fill="#18181b"/>
        <path d="M ${cx - 9 + headOffset} ${h * 0.29} Q ${cx + headOffset} ${h * 0.305} ${cx + 9 + headOffset} ${h * 0.29}" stroke="#9a3412" stroke-width="2.2" fill="none"/>
        <text x="${cx}" y="${h - 94}" font-family="Helvetica,Arial" font-size="14" fill="#52525b" text-anchor="middle" font-weight="600">${poseLabels[i]}</text>
      `;
    }

    const svg16x9 = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f8fafc"/>
      ${panelsSvg}
      <rect x="16" y="${h - 60}" width="${w - 32}" height="44" rx="8" fill="#18181b"/>
      <text x="36" y="${h - 32}" font-family="Helvetica,Arial" font-size="18" fill="#ffffff" font-weight="600">${tag}</text>
    </svg>`;
    return sharp(Buffer.from(svg16x9)).png().toBuffer();
  }

  // Caso 3: Retrato / Cuerpo entero 3:4
  const cx = w / 2;
  const svgPortrait = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <circle cx="${cx}" cy="${h * 0.42}" r="${w * 0.38}" fill="#f8fafc" stroke="#e4e4e7" stroke-width="2"/>
    <!-- Maniquí Anatómico de Estudio -->
    <path d="M ${cx - 180} ${h * 0.86} C ${cx - 170} ${h * 0.54}, ${cx - 120} ${h * 0.47}, ${cx - 45} ${h * 0.45} L ${cx + 45} ${h * 0.45} C ${cx + 120} ${h * 0.47}, ${cx + 170} ${h * 0.54}, ${cx + 180} ${h * 0.86} Z" fill="#18181b"/>
    <rect x="${cx - 32}" y="${h * 0.36}" width="64" height="90" rx="22" fill="${skinFill}"/>
    <ellipse cx="${cx}" cy="${h * 0.26}" rx="96" ry="124" fill="${skinFill}" stroke="#d4d4d8" stroke-width="2"/>
    <path d="M ${cx - 98} ${h * 0.25} C ${cx - 96} ${h * 0.12}, ${cx + 96} ${h * 0.12}, ${cx + 98} ${h * 0.25} C ${cx + 65} ${h * 0.18}, ${cx - 65} ${h * 0.18}, ${cx - 98} ${h * 0.25} Z" fill="${hairFill}"/>
    <ellipse cx="${cx - 34}" cy="${h * 0.25}" rx="10" ry="6" fill="#18181b"/>
    <ellipse cx="${cx + 34}" cy="${h * 0.25}" rx="10" ry="6" fill="#18181b"/>
    <path d="M ${cx - 22} ${h * 0.31} Q ${cx} ${h * 0.325} ${cx + 22} ${h * 0.31}" stroke="#9a3412" stroke-width="4" fill="none"/>
    <rect x="32" y="${h - 84}" width="${w - 64}" height="52" rx="10" fill="#18181b"/>
    <text x="56" y="${h - 52}" font-family="Helvetica,Arial" font-size="22" fill="#ffffff" font-weight="600">${tag}</text>
  </svg>`;
  return sharp(Buffer.from(svgPortrait)).png().toBuffer();
}

const COMMERCIAL_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
];

export async function generateImage(args: GenImageArgs): Promise<GenResult> {
  if (customProviderAdapter?.generateImage) {
    return customProviderAdapter.generateImage(args);
  }
  if (isMock()) {
    return {
      buffer: await mockImage(args),
      model: 'mock-image',
      costUsd: 0,
      mocked: true,
    };
  }


  const { GoogleGenAI, Modality } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: CONFIG.apiKey });
  const parts: any[] = [];
  for (const img of args.images || []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }
  parts.push({ text: `${args.prompt}\n\nOutput aspect ratio: ${args.aspectRatio || '3:4'}` });

  const modelsToTry = Array.from(
    new Set([CONFIG.models.image, 'gemini-2.5-flash-image', 'gemini-2.0-flash-exp']),
  );

  let lastErr: any = null;
  for (const modelName of modelsToTry) {
    try {
      const res = await ai.models.generateContent({
        model: modelName,
        contents: { parts },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
          safetySettings: COMMERCIAL_SAFETY_SETTINGS as any,
        },
      });
      const part = res.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
      if (part?.inlineData?.data) {
        const buffer = Buffer.from(part.inlineData.data, 'base64');
        return { buffer, model: modelName, costUsd: CONFIG.pixPerCreditUsd, mocked: false };
      }
      const blockReason = res.candidates?.[0]?.finishReason;
      lastErr = new Error(`El modelo ${modelName} no devolvió imagen (finishReason: ${blockReason || 'unknown'})`);
    } catch (e: any) {
      lastErr = e;
    }
  }

  throw new Error(lastErr?.message || 'Error al generar imagen con Gemini API. Verifica tu GEMINI_API_KEY.');
}

function parseJsonSafe<T>(rawText: string): T {
  const trimmed = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(trimmed || '{}') as T;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
    }
    throw new Error('Respuesta JSON inválida del proveedor IA');
  }
}

export async function analyzeJson<T = any>(args: {
  prompt: string;
  images?: { data: string; mimeType: string }[];
}): Promise<{ data: T; model: string; costUsd: number }> {
  if (customProviderAdapter?.analyzeJson) {
    return customProviderAdapter.analyzeJson<T>(args);
  }
  if (isMock()) {
    return {
      data: mockAnalysis<T>(args.prompt),
      model: 'mock-text',
      costUsd: 0,
    };
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: CONFIG.apiKey });
  const parts: any[] = [];
  for (const img of args.images || []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }
  parts.push({ text: args.prompt });
  const res = await ai.models.generateContent({
    model: CONFIG.models.text,
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      safetySettings: COMMERCIAL_SAFETY_SETTINGS as any,
    },
  });
  const text = (res as any).text || '';
  const usage = (res as any).usageMetadata;
  const costUsd = usage?.totalTokenCount
    ? Number(((usage.totalTokenCount / 1_000_000) * 0.35).toFixed(6))
    : 0.001;
  return { data: parseJsonSafe<T>(text), model: CONFIG.models.text, costUsd };
}

export async function chatFashionAdvisor(args: {
  message: string;
  context?: string;
}): Promise<{ reply: string; model: string; costUsd: number }> {
  if (isMock()) {
    const msg = args.message.toLowerCase();
    let reply =
      'Recomendación de Dirección de Arte ATELIER: Para máxima fidelidad 1:1 usa el preset "Minimalist E-Commerce" (Drape 55, Wrinkle 15) con pose "Catálogo Recto Simétrico" y fondo "Estudio Blanco Ciclorama (#FFFFFF)".';
    if (msg.includes('pose')) {
      reply =
        'Dirección de Pose: Para Tops y Blusas usa Plano Medio con torso despejado y brazos levemente separados; para Chaquetas y Blazers usa postura estructurada con mano sutil en bolsillo sin deformar hombreras; para Pantalones/Bottoms usa apoyo de peso en una cadera (contrapposto) para definir tiro y caída.';
    } else if (msg.includes('tela') || msg.includes('drape') || msg.includes('seda') || msg.includes('lino')) {
      reply =
        'Física Textil (Virtual Stylist Pro): Para Lino o Seda sube el Drape a 75-85 y Textura a 85; para Sastrería/Lana estructurada baja el Drape a 25-35 y Arrugas a 10 para conservar el aplomo arquitectónico.';
    } else if (msg.includes('qa') || msg.includes('error') || msg.includes('corregir')) {
      reply =
        'Auditoría QA V5 (5 Controles): Si detectas desviación en cuello, botones o color, utiliza el botón "Reintento Asistido (Corrección)" en la Etapa 5 indicando la instrucción correctiva puntual.';
    }
    return { reply, model: 'mock-advisor', costUsd: 0 };
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: CONFIG.apiKey });
  const sys = `Eres el Director de Arte y Estilista Técnico Senior de ATELIER (plataforma de producción visual e-commerce y alta costura).
Responde en español de forma concisa, técnica y accionable sobre dirección de pose, física textil (drape, arrugas, lustre), iluminación de estudio, arquetipos KORA y control de calidad 1:1.
Contexto del proyecto: ${args.context || 'Producción de catálogo activo'}`;
  const res = await ai.models.generateContent({
    model: CONFIG.models.text,
    contents: `${sys}\n\nConsulta del operador: ${args.message}`,
  });
  return {
    reply: (res as any).text || 'Sin respuesta del asesor.',
    model: CONFIG.models.text,
    costUsd: 0.0005,
  };
}

function mockAnalysis<T>(prompt: string): T {
  if (prompt.includes('forensic fashion inspector')) {
    return {
      descriptor:
        'Prenda de silueta estructurada contemporánea, color azul marino profundo uniforme, tejido de algodón peinado de trama fina visible, cuello redondo simétrico, costuras limpias a tono y terminación de basta recta.',
      verifiedAttributes: {
        color: 'azul marino',
        pattern: 'solid',
        silhouette: 'structured straight',
        neckline: 'crew',
        lapel: 'none',
        buttonCount: 4,
        buttonPlacement: 'front placket',
        pocketCount: 0,
        pocketType: 'none',
        sleeveLength: 'long',
        cuffDetails: 'clean rib',
        hemShape: 'straight',
        fabricAppearance: 'cotton',
        visibleSeams: 'topstitching',
        visibleConstructionDetails: 'reinforced collar binding',
      },
      unknownAttributes: [],
    } as unknown as T;
  }
  if (prompt.includes('Compare SOURCE')) {
    return {
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
      notes: 'Fixture MOCK de QA. No representa una verificación visual.',
      controls: {
        controlA_identity: { passed: true, confidence: 0.98, details: 'Identidad facial, tono de piel y morfología idénticas a IMG 1.' },
        controlB_prohibitedExclusion: {
          passed: true,
          noJewelryAdded: true,
          noLipstickChange: true,
          noMakeupChange: true,
          noSkinMarksImported: true,
          noAnatomyDeformation: true,
          violations: [],
        },
        controlC_textileFidelity: { passed: true, silhouetteIntact: true, details: 'Color, trama, cuello y costuras coinciden con el Garment Lock.' },
        controlD_compositionPose: { passed: true, posePreserved: true, details: 'Encuadre completo sin recortes y postura natural.' },
        controlE_technicalQuality: { passed: true, details: 'Iluminación limpia y resolución apta para catálogo.' },
        suggestedAction: 'APPROVE',
      },
    } as unknown as T;
  }
  return {
    title: 'Prenda Editorial E-Commerce',
    brand: 'ATELIER Studio',
    price: 49990,
    currency: 'CLP',
    description: 'Prenda confeccionada con fibras seleccionadas de alta densidad, corte arquitectónico y calce versátil para catálogo contemporáneo.',
    composition: 'Algodón Orgánico 95%, Elastano 5%',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    category: 'Tops',
  } as unknown as T;
}

