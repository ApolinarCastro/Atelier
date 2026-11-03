const J = async (r: Response) => {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
};
export const api = {
  health: () => fetch('/api/health').then(J),
  getConfig: () => fetch('/api/config').then(J),
  saveConfig: (body: { apiKey?: string; mock?: boolean; imageModel?: string; textModel?: string }) =>
    fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(J),
  projects: () => fetch('/api/projects').then(J),
  createProject: (body: any) =>
    fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(J),
  state: (id: string) => fetch(`/api/projects/${id}/state`).then(J),
  createModel: (id: string, body: any) =>
    fetch(`/api/projects/${id}/models`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(J),
  uploadModelPhoto: (id: string, file: File, name: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name);
    return fetch(`/api/projects/${id}/models/upload`, { method: 'POST', body: fd }).then(J);
  },
  generateExpressions: (modelId: string) =>
    fetch(`/api/models/${modelId}/expressions`, { method: 'POST' }).then(J),
  approveModel: (id: string) => fetch(`/api/models/${id}/approve`, { method: 'POST' }).then(J),
  uploadProduct: (id: string, file: File, title: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title);
    return fetch(`/api/projects/${id}/products`, { method: 'POST', body: fd }).then(J);
  },
  ingestProductUrl: (id: string, url: string, title?: string) =>
    fetch(`/api/projects/${id}/products/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, title }),
    }).then(J),
  generateScript: (pid: string) =>
    fetch(`/api/products/${pid}/script`, { method: 'POST' }).then(J),
  addVariant: (pid: string, colorName: string, colorHex?: string) =>
    fetch(`/api/products/${pid}/variants`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ colorName, colorHex }) }).then(J),
  uploadProductReference: (pid: string, file: File, variantId?: string | null) => {
    const fd = new FormData();
    fd.append('file', file);
    if (variantId) fd.append('variantId', variantId);
    return fetch(`/api/products/${pid}/references`, { method: 'POST', body: fd }).then(J);
  },
  assignRawVariant: (assetId: string, variantId: string | null) =>
    fetch(`/api/assets/${assetId}/assign-variant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variantId }),
    }).then(J),
  createLock: (pid: string, body?: { variantId?: string | null; sourceAssetIds?: string[] }) =>
    fetch(`/api/products/${pid}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(J),
  approveLock: (lid: string) => fetch(`/api/locks/${lid}/approve`, { method: 'POST' }).then(J),

  render: (pid: string, body: any) =>
    fetch(`/api/products/${pid}/render`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(J),
  uploadQuickAsset: (projectId: string, file: File, type = 'garment_raw') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    return fetch(`/api/projects/${projectId}/assets/upload`, { method: 'POST', body: fd }).then(J);
  },
  studioPose: (projectId: string, body: any) =>
    fetch(`/api/projects/${projectId}/studio/pose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(J),
  studioClone: (projectId: string, body: any) =>
    fetch(`/api/projects/${projectId}/studio/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(J),
  retryAsset: (aid: string, correctionPrompt: string, params?: any) =>
    fetch(`/api/assets/${aid}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correctionPrompt, params }),
    }).then(J),
  qa: (aid: string) => fetch(`/api/assets/${aid}/qa`, { method: 'POST' }).then(J),
  approveAsset: (aid: string) => fetch(`/api/assets/${aid}/approve`, { method: 'POST' }).then(J),
  compose: (id: string, body: any) =>
    fetch(`/api/projects/${id}/compose`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(J),
  exportProject: (id: string) => fetch(`/api/projects/${id}/export`, { method: 'POST' }).then(J),
  chatAdvisor: (message: string, context?: string) =>
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context }),
    }).then(J),
};
export const fileUrl = (id: string) => `/api/assets/${id}/file`;
export const exportZipUrl = (id: string) => `/api/exports/${id}/zip`;
