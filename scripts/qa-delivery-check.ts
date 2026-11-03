import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { once } from 'node:events';
import sharp from 'sharp';

const directory = fs.mkdtempSync(path.resolve('data', 'qa-check-'));
process.env.ATELIER_DATA = directory;
process.env.ATELIER_MOCK = '1';
process.env.GEMINI_API_KEY = '';
process.env.API_KEY = '';
process.env.ATELIER_API_TOKEN = 'local-test-token';

const { run } = await import('../server/db.ts');
const { createAsset, getAsset } = await import('../engines/assets.ts');
const listener = net.createServer();
listener.listen(0, '127.0.0.1');
await once(listener, 'listening');
const port = (listener.address() as net.AddressInfo).port;
await new Promise<void>(resolve => listener.close(() => resolve()));
const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
  env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'],
});

const image = (color: string) => sharp({
  create: { width: 512, height: 512, channels: 3, background: color },
}).png().toBuffer();
const base = { projectId: 'p', productId: 'product' };
const post = (url: string, body: object = {}) => request(url, body);
function request(url: string, body?: object) {
  return fetch(`http://127.0.0.1:${port}/api${url}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', authorization: 'Bearer local-test-token' },
    body: body && JSON.stringify(body),
  });
}
async function expect(response: Response, status: number, label: string) {
  assert.equal(response.status, status, `${label} ${await response.clone().text()}`);
  console.log(`${status} ${label}`);
  return response;
}

try {
  await Promise.race([
    once(server.stdout!, 'data'),
    once(server, 'exit').then(() => { throw new Error('El servidor de prueba terminó al arrancar'); }),
  ]);
  run("INSERT INTO projects(id,name) VALUES('p','Fixture')");
  const source = await createAsset({ ...base, type: 'garment_raw', buffer: await image('#334455') });
  const lockId = 'lock';
  const refs = (id: string) => JSON.stringify([id]);
  run("INSERT INTO locks(id,product_id,approved,source_asset_ids_json) VALUES(?,?,1,?)",
    [lockId, base.productId, refs(source.id)]);
  const candidate = await createAsset({ ...base, lockId, type: 'ghost', mocked: true, buffer: await image('#445566') });
  const route = `/assets/${candidate.id}`;
  const qa = (body = {}) => post(route + '/qa', body);
  const approve = () => post(route + '/approve');
  const download = () => request(route + '/download');
  const exportAsset = () => post('/projects/p/export', { assetIds: [candidate.id] });
  await expect(await approve(), 409, 'QA ausente bloquea aprobación');
  await expect(await exportAsset(), 409, 'QA ausente bloquea exportación directa');
  await expect(await qa({ sourceAssetId: candidate.id }), 409, 'candidato como referencia');
  const copy = await createAsset({ ...base, type: 'garment_raw', buffer: await image('#445566') });
  run('UPDATE locks SET source_asset_ids_json=? WHERE id=?', [refs(copy.id), lockId]);
  await expect(await qa(), 409, 'copia idéntica como referencia');
  for (const change of [
    { projectId: 'other' }, { productId: 'other' }, { variantId: 'other' },
  ]) {
    const incompatible = await createAsset({ ...base, ...change, type: 'garment_raw', buffer: await image('#435465') });
    run('UPDATE locks SET source_asset_ids_json=? WHERE id=?', [refs(incompatible.id), lockId]);
    await expect(await qa(), 409, 'referencia incompatible');
  }
  run("UPDATE locks SET source_asset_ids_json='[]' WHERE id=?", [lockId]);
  await expect(await qa(), 409, 'referencia ausente');
  assert.equal(JSON.parse(getAsset(candidate.id)!.qa_json!).status, 'INCOMPLETE');
  run('UPDATE locks SET source_asset_ids_json=? WHERE id=?', [refs(source.id), lockId]);
  await expect(await qa(), 200, 'QA MOCK con originales válidos');
  const report = getAsset(candidate.id)!.qa_json!;
  assert.equal(JSON.parse(report).overallStatus, 'PASS');
  await expect(await download(), 409, 'PASS sin aprobación');
  await expect(await post('/projects/p/compose', { assetIds: [candidate.id], requireApproved: false }), 409,
    'composición directa no permite omitir aprobación');
  for (const invalid of ['{', JSON.stringify({ overallStatus: 'PASS' }),
    JSON.stringify({ ...JSON.parse(report), controls: {} }),
    JSON.stringify({ ...JSON.parse(report), overallStatus: 'FAIL' })]) {
    run('UPDATE assets SET qa_json=? WHERE id=?', [invalid, candidate.id]);
    await expect(await approve(), 409, 'informe inválido, histórico o FAIL');
    await expect(await exportAsset(), 409, 'informe inválido, histórico o FAIL bloquea exportación');
  }
  assert.equal(fs.existsSync(path.join(directory, 'exports')), false);
  run("UPDATE assets SET qa_json=?, qa_mode='REAL' WHERE id=?", [report, candidate.id]);
  await expect(await approve(), 409, 'QA MOCK no autoriza REAL');
  await expect(await qa(), 409, 'el evaluador MOCK rechaza REAL');
  run("UPDATE assets SET qa_json=?, qa_mode='MOCK' WHERE id=?", [report, candidate.id]);
  await expect(await approve(), 200, 'aprobación manual vigente');
  await expect(await download(), 200, 'descarga individual autorizada');
  const comp = await (await expect(await post('/projects/p/compose', { assetIds: [candidate.id] }), 200,
    'composición autorizada')).json();
  await expect(await post(`/assets/${comp.assetId}/approve`), 200, 'aprobación de composición');
  const ex = await (await expect(await post('/projects/p/export', { assetIds: [candidate.id, comp.assetId] }), 200,
    'exportación completa autorizada')).json();
  assert.equal(ex.manifest.mode, 'MOCK');
  const zip = `/exports/${ex.exportId}/zip`;
  await expect(await request(zip), 200, 'ZIP vigente');
  const derived = await createAsset({ ...base, lockId, type: 'ghost', mocked: true, parentAssetId: candidate.id,
    buffer: await image('#556677') });
  await expect(await post(`/assets/${derived.id}/approve`), 409, 'derivado sin autorización heredada');
  const original = fs.readFileSync(candidate.file_path);
  fs.writeFileSync(candidate.file_path, await image('#aabbcc'));
  await expect(await download(), 409, 'cambio de candidato');
  await expect(await request(zip), 409, 'ZIP con componente modificado');
  fs.writeFileSync(candidate.file_path, original);
  fs.writeFileSync(source.file_path, await image('#babbcc'));
  await expect(await download(), 409, 'cambio de referencia');
  await expect(await request(`/assets/${comp.assetId}/download`), 409, 'composición con referencia obsoleta');
  await expect(await request(zip), 409, 'ZIP bloqueado tras invalidación de referencia');
  await expect(await request(route + '/file'), 200, 'vista interna sigue disponible');
} finally {
  server.kill();
  console.log(`Datos de prueba aislados en ${directory}`);
}

