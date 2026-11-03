import { get, run, now, uid, audit, all } from '../server/db.ts';
import { requireAssetApprovable, approvalEvidence } from '../server/gates.ts';
import { saveImage, toBase64 } from '../server/storage.ts';
import type { Asset, AssetType, Stage } from '../shared/types.ts';

export async function createAsset(opts: {
  projectId: string;
  type: AssetType;
  stage?: Stage;
  productId?: string;
  variantId?: string;
  modelId?: string;
  parentAssetId?: string;
  lockId?: string;
  buffer: Buffer;
  ext?: string;
  approved?: boolean;
  mocked?: boolean;
  qaJson?: string;
  qaScore?: number;
}): Promise<Asset> {
  const id = uid('as_');
  const saved = await saveImage(opts.projectId, id, opts.buffer, opts.ext || 'png');
  run(
    `INSERT INTO assets(id, project_id, product_id, variant_id, model_id, type, stage,
      parent_asset_id, lock_id, file_path, mime, width, height, qa_json, qa_score, approved, created_at, qa_mode)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, opts.projectId, opts.productId || null, opts.variantId || null,
      opts.modelId || null, opts.type, opts.stage || 'draft', opts.parentAssetId || null,
      opts.lockId || null, saved.file_path, saved.mime, saved.width, saved.height,
      opts.qaJson || null, opts.qaScore ?? null, opts.approved ? 1 : 0, now(),
      opts.mocked === undefined ? null : opts.mocked ? 'MOCK' : 'REAL',
    ],
  );
  audit('asset', id, 'created', { type: opts.type });
  return get<Asset>(`SELECT * FROM assets WHERE id = ?`, [id])!;
}

export const getAsset = (id: string) => get<Asset>(`SELECT * FROM assets WHERE id = ?`, [id]);

export async function assetImage(id: string) {
  const a = getAsset(id);
  if (!a) throw new Error('Asset no encontrado: ' + id);
  return toBase64(a.file_path);
}

export function approveAsset(id: string, strictRenderQA = false) {
  const asset = requireAssetApprovable(id, strictRenderQA);
  run(`UPDATE assets SET approved=1, stage='approved', approval_evidence=? WHERE id=?`, [approvalEvidence(asset), id]);
  audit('asset', id, 'approved');
  return getAsset(id);
}

export function assetsOf(productId: string, type?: AssetType) {
  return type
    ? all<Asset>(`SELECT * FROM assets WHERE product_id=? AND type=? ORDER BY created_at`, [productId, type])
    : all<Asset>(`SELECT * FROM assets WHERE product_id=? ORDER BY created_at`, [productId]);
}


