import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { CONFIG } from './config.ts';

const root = path.resolve(CONFIG.dataDir, 'storage');
fs.mkdirSync(root, { recursive: true });

const ALLOWED_EXT = new Set(['png', 'jpg', 'jpeg', 'webp']);

export function safeSegment(raw: string, fallback = '_default'): string {
  const cleaned = String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned.slice(0, 80) || fallback;
}

export const dirFor = (projectId: string) => {
  const seg = safeSegment(projectId, '_global');
  const d = path.resolve(root, seg);
  if (!d.startsWith(root + path.sep) && d !== root) {
    throw new Error('Ruta de almacenamiento inválida');
  }
  fs.mkdirSync(d, { recursive: true });
  return d;
};

export interface SavedImage {
  file_path: string;
  mime: string;
  width: number;
  height: number;
}

export async function saveImage(
  projectId: string,
  assetId: string,
  input: Buffer | string,
  ext = 'png',
): Promise<SavedImage> {
  const safeExt = ALLOWED_EXT.has(ext.toLowerCase()) ? ext.toLowerCase() : 'png';
  const safeAssetId = safeSegment(assetId, 'asset');
  const buf = Buffer.isBuffer(input)
    ? input
    : Buffer.from(input.replace(/^data:image\/\w+;base64,/, ''), 'base64');

  const dir = dirFor(projectId);
  const file = path.resolve(dir, `${safeAssetId}.${safeExt}`);
  if (!file.startsWith(dir + path.sep)) {
    throw new Error('Intento de escritura fuera del directorio permitido');
  }

  const meta = await sharp(buf).metadata();
  if (!meta.width || !meta.height) {
    throw new Error('El archivo proporcionado no es una imagen válida');
  }

  await sharp(buf).toFile(file);
  return {
    file_path: file,
    mime: safeExt === 'jpg' || safeExt === 'jpeg' ? 'image/jpeg' : safeExt === 'webp' ? 'image/webp' : 'image/png',
    width: meta.width,
    height: meta.height,
  };
}

export async function toBase64(filePath: string) {
  const resolved = resolveAssetFile(filePath);
  if (!resolved) throw new Error('Archivo de asset no encontrado');
  const buf = fs.readFileSync(resolved);
  const ext = path.extname(resolved).replace('.', '').toLowerCase() || 'png';
  return { data: buf.toString('base64'), mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}` };
}

export function resolveAssetFile(filePath: string) {
  if (!filePath) return null;
  const resolved = path.resolve(filePath);
  const allowedRoot = path.resolve(CONFIG.dataDir);
  if (!resolved.startsWith(allowedRoot + path.sep)) return null;
  if (!fs.existsSync(resolved)) return null;
  return resolved;
}

/**
 * Crea un archivo ZIP estándar (PKZIP Deflate) sin dependencias externas.
 */
export function createZipBuffer(entries: { name: string; data: Buffer }[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name.replace(/\\/g, '/'), 'utf8');
    const raw = entry.data;
    const compressed = zlib.deflateRawSync(raw);
    const crc = zlib.crc32(raw) >>> 0;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4);         // version needed
    localHeader.writeUInt16LE(0, 6);          // flags
    localHeader.writeUInt16LE(8, 8);          // method: deflate
    localHeader.writeUInt16LE(0, 10);         // mod time
    localHeader.writeUInt16LE(0, 12);         // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(raw.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // central dir signature
    centralHeader.writeUInt16LE(20, 4);         // version made by
    centralHeader.writeUInt16LE(20, 6);         // version needed
    centralHeader.writeUInt16LE(0, 8);          // flags
    centralHeader.writeUInt16LE(8, 10);         // method: deflate
    centralHeader.writeUInt16LE(0, 12);         // mod time
    centralHeader.writeUInt16LE(0, 14);         // mod date
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(raw.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);         // extra len
    centralHeader.writeUInt16LE(0, 32);         // comment len
    centralHeader.writeUInt16LE(0, 34);         // disk number
    centralHeader.writeUInt16LE(0, 36);         // internal attrs
    centralHeader.writeUInt32LE(0, 38);         // external attrs
    centralHeader.writeUInt32LE(offset, 42);    // local header offset

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDirSize = centralParts.reduce((a, b) => a + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

