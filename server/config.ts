import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const defaultDataDir = path.resolve(rootDir, 'data');
const envPath = path.resolve(rootDir, '.env');

const initialKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();

export const CONFIG = {
  port: Number(process.env.PORT || 8787),
  mock: process.env.ATELIER_MOCK === '1' ? true : !initialKey,
  apiKey: initialKey,
  apiToken: process.env.ATELIER_API_TOKEN || '',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  dataDir: process.env.ATELIER_DATA
    ? path.resolve(process.env.ATELIER_DATA)
    : defaultDataDir,
  models: {
    text: process.env.MODEL_TEXT || 'gemini-2.5-flash',
    image: process.env.MODEL_IMAGE || 'gemini-2.5-flash-image',
  },
  pixPerCreditUsd: Number(process.env.USD_PER_RENDER || 0.04),
};

export const isMock = () => CONFIG.mock || !CONFIG.apiKey;

export function updateRuntimeConfig(opts: {
  apiKey?: string;
  mock?: boolean;
  imageModel?: string;
  textModel?: string;
}) {
  if (typeof opts.apiKey === 'string') {
    CONFIG.apiKey = opts.apiKey.trim();
    process.env.GEMINI_API_KEY = CONFIG.apiKey;
  }
  if (typeof opts.imageModel === 'string' && opts.imageModel.trim()) {
    CONFIG.models.image = opts.imageModel.trim();
    process.env.MODEL_IMAGE = CONFIG.models.image;
  }
  if (typeof opts.textModel === 'string' && opts.textModel.trim()) {
    CONFIG.models.text = opts.textModel.trim();
    process.env.MODEL_TEXT = CONFIG.models.text;
  }
  if (typeof opts.mock === 'boolean') {
    CONFIG.mock = opts.mock || !CONFIG.apiKey;
  } else {
    CONFIG.mock = !CONFIG.apiKey;
  }

  // Persistir en .env para siguientes reinicios
  try {
    const lines = [
      '# Configuración ATELIER V2.0',
      `ATELIER_MOCK=${CONFIG.mock ? '1' : '0'}`,
      `GEMINI_API_KEY=${CONFIG.apiKey}`,
      `MODEL_IMAGE=${CONFIG.models.image}`,
      `MODEL_TEXT=${CONFIG.models.text}`,
      `PORT=${CONFIG.port}`,
      `ATELIER_DATA=./data`,
      `ATELIER_API_TOKEN=${CONFIG.apiToken}`,
      `CORS_ORIGIN=${CONFIG.corsOrigin}`,
      '',
    ];
    fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
  } catch {
    // ignore write errors in read-only environments
  }
}
