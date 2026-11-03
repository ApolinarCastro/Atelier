import React, { useEffect, useState, useCallback } from 'react';
import { api, fileUrl, exportZipUrl } from './api.ts';
import {
  SUPERMODEL_ARCHETYPES,
  STYLE_PRESETS,
  FABRIC_TYPES,
  POSE_CATEGORIES,
  POSE_PLANES,
  POSE_CAMERA_ANGLES,
  POSE_ATTITUDES,
  POSE_SUGGESTIONS,
  SKELETAL_POSE_PRESETS,
  BACKGROUND_PRESETS,
  HAUTE_COUTURE_TEMPLATES,
  CATALOG_RESOLUTIONS,
} from '../shared/catalog.ts';

const STAGES = [
  { id: 0, label: 'Proyecto' },
  { id: 1, label: '1 · Casting KORA 4K' },
  { id: 2, label: '2 · Intake & Guión' },
  { id: 3, label: '3 · Garment Lock 1:1' },
  { id: 4, label: '4 · Render V5 & Pose' },
  { id: 5, label: '5 · QA 5-Controles' },
  { id: 6, label: '6 · Haute Couture & ZIP' },
];

const BODIES = ['slender', 'athletic', 'curvy', 'average', 'petite', 'commercial'];

export default function App() {
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [state, setState] = useState<any>(null);
  const [stage, setStage] = useState(0);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [mode, setMode] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [maskedKey, setMaskedKey] = useState('');
  const [imageModel, setImageModel] = useState('gemini-2.5-flash-image');
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatReply, setChatReply] = useState('');

  const refresh = useCallback(async (pid = projectId) => {
    const ps = await api.projects();
    setProjects(ps);
    if (!pid) return;
    const s = await api.state(pid);
    setState(s);
    if (s?.mode) setMode(s.mode);
  }, [projectId]);

  useEffect(() => {
    (async () => {
      try {
        const h = await api.health();
        setMode(h.mode);
        setMaskedKey(h.maskedKey || '');
        if (h.imageModel) setImageModel(h.imageModel);
        const ps = await api.projects();
        setProjects(ps);
        if (ps.length) { setProjectId(ps[0].id); await refresh(ps[0].id); }
      } catch (e: any) { setErr(e.message); }
    })();
  }, []);

  const saveGeminiKey = () => run('Configurando Motor Gemini', async () => {
    const res = await api.saveConfig({
      apiKey: apiKeyInput.trim() || undefined,
      imageModel,
      mock: false,
    });
    setMode(res.mode);
    setMaskedKey(res.maskedKey || '');
    setApiKeyInput('');
    setShowKeyConfig(false);
  }, 'Motor Gemini configurado en MODO REAL');

  const run = async (label: string, fn: () => Promise<any>, note?: string) => {
    setBusy(label); setErr(''); setMsg('');
    try {
      const r = await fn();
      await refresh();
      if (note) setMsg(note);
      return r;
    } catch (e: any) {
      setErr(e.message);
    } finally { setBusy(''); }
  };

  const createProject = (name = 'Colección', season = 'SS26', clientName = 'Cliente') => run('project', async () => {
    const p = await api.createProject({ name, season, clientName });
    setProjectId(p.id); setStage(1); await refresh(p.id);
  }, 'Proyecto creado');

  const selectProject = async (pid: string) => {
    setProjectId(pid);
    await refresh(pid);
  };

  const askAdvisor = async () => {
    if (!chatInput.trim()) return;
    const q = chatInput;
    setChatInput('');
    const r = await api.chatAdvisor(q, `${state?.project?.name || ''} · Etapa ${stage}`);
    setChatReply(r.reply);
  };

  if (!projectId) {
    return (
      <div className="app"><aside className="side"><div className="brand">ATELIER<small>SUITE UNIFICADA V2.0</small></div></aside>
        <main className="main">
          <h1>Empieza un proyecto</h1>
          <p className="sub">Pipeline unificado · KORA 4K → Extractor URL & Guión → Garment Lock 1:1 → Master Render V5 & Dirección de Pose → QA 5-Controles → Catálogo Haute Couture</p>
          {err && <div className="err">{err}</div>}
          <div className="card"><button className="primary" onClick={() => createProject()} disabled={!!busy}>{busy ? 'Creando…' : 'Crear proyecto'}</button></div>
        </main></div>
    );
  }

  const done: Record<number, boolean> = {
    0: true,
    1: !!state?.models?.some((m: any) => m.status === 'approved'),
    2: !!state?.products?.length,
    3: !!state?.locks?.some((l: any) => l.approved),
    4: !!state?.assets?.some((a: any) => a.stage === 'rendered' || a.stage === 'qa' || a.stage === 'approved'),
    5: !!state?.assets?.some((a: any) => a.approved),
    6: !!state?.assets?.some((a: any) => a.type === 'composed'),
  };

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">ATELIER<small>PRODUCCIÓN VISUAL V2.0</small></div>
        {projects.length > 1 && (
          <div style={{ marginTop: 14 }}>
            <label>Proyecto activo</label>
            <select value={projectId} onChange={(e) => selectProject(e.target.value)}>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} ({p.season || '—'})</option>
              ))}
            </select>
          </div>
        )}
        <div style={{ marginTop: 18 }}>
          {STAGES.map((s) => (
            <div key={s.id} className={`stage ${stage === s.id ? 'active' : ''} ${done[s.id] ? 'done' : ''}`} onClick={() => setStage(s.id)}>
              <span className="dot" /> {s.label}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <div className="mono">modo de ejecución</div>
          <span className={`badge ${mode === 'mock' ? 'mock' : 'ok'}`}>{mode === 'mock' ? 'MOCK · determinista' : 'REAL · Gemini'}</span>
          {state?.jobs_stats && (
            <div className="mono" style={{ marginTop: 10, lineHeight: 1.7 }}>
              jobs: {state.jobs_stats.done} ok · {state.jobs_stats.failed} fail<br />
              costo: ${Number(state.jobs_stats.cost).toFixed(3)}
            </div>
          )}
          <button className="ghost" style={{ marginTop: 12, width: '100%', fontSize: 11 }} onClick={() => setChatOpen(!chatOpen)}>
            {chatOpen ? 'Cerrar Asesor IA' : '💬 Asesor Dirección de Arte'}
          </button>
          {chatOpen && (
            <div style={{ marginTop: 10, padding: 8, background: '#fafafa', border: '1px solid var(--line)', borderRadius: 6 }}>
              <input
                placeholder="Ej: ¿Qué pose usar para blazer?"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && askAdvisor()}
                style={{ fontSize: 11, marginBottom: 6 }}
              />
              <button style={{ width: '100%', padding: '4px 8px', fontSize: 11 }} onClick={askAdvisor}>Consultar</button>
              {chatReply && <p style={{ fontSize: 11, marginTop: 8, lineHeight: 1.4, color: '#27272a' }}>{chatReply}</p>}
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <div className="top">
          <div>
            <h1>{STAGES[stage].label}</h1>
            <p className="sub">{state?.project?.name} · {state?.project?.season}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ghost" onClick={() => setShowKeyConfig(!showKeyConfig)}>
              🔑 {maskedKey ? `API Key (${maskedKey})` : 'Configurar API Key'}
            </button>
            <button className="ghost" onClick={() => refresh()} disabled={!!busy}>Actualizar</button>
          </div>
        </div>

        {showKeyConfig && (
          <div className="card">
            <div className="row">
              <div style={{ flex: 2.2 }}>
                <label>GEMINI_API_KEY {maskedKey ? `(Actual: ${maskedKey})` : ''}</label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                />
              </div>
              <div style={{ flex: 1.5 }}>
                <label>Modelo de Imagen</label>
                <select value={imageModel} onChange={(e) => setImageModel(e.target.value)}>
                  <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                  <option value="gemini-3.1-flash-image-preview">Gemini 3.1 Flash Image Preview</option>
                  <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Exp</option>
                </select>
              </div>
              <div>
                <button className="primary" disabled={!!busy} onClick={saveGeminiKey}>
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {busy && <div className="ok">⏳ {busy}…</div>}
        {err && <div className="err">{err}</div>}
        {msg && !busy && <div className="ok">{msg}</div>}

        {stage === 0 && <StageProject state={state} createProject={createProject} busy={busy} />}
        {stage === 1 && <StageCasting state={state} run={run} busy={busy} projectId={projectId} />}
        {stage === 2 && <StageIntake state={state} run={run} busy={busy} projectId={projectId} />}
        {stage === 3 && <StageLock state={state} run={run} busy={busy} />}
        {stage === 4 && <StageRender state={state} run={run} busy={busy} />}
        {stage === 5 && <StageQA state={state} run={run} busy={busy} />}
        {stage === 6 && <StageCompose state={state} run={run} busy={busy} projectId={projectId} />}
      </main>
    </div>
  );
}

/* ---------------- Etapa 0 ---------------- */
function StageProject({ state, createProject, busy }: any) {
  const [name, setName] = useState('Nueva Colección');
  const [season, setSeason] = useState('FW26');
  const [client, setClient] = useState('Cliente');
  return (
    <>
      <div className="card">
        <table>
          <tbody>
            <tr><th>Proyecto</th><td>{state?.project?.name}</td></tr>
            <tr><th>Temporada</th><td>{state?.project?.season || '—'}</td></tr>
            <tr><th>ID</th><td className="mono">{state?.project?.id}</td></tr>
            <tr><th>Modelos KORA</th><td>{state?.models?.length || 0}</td></tr>
            <tr><th>Productos</th><td>{state?.products?.length || 0}</td></tr>
            <tr><th>Assets Totales</th><td>{state?.assets?.length || 0}</td></tr>
            <tr><th>Entregas ZIP</th><td>{state?.exports?.length || 0}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="row">
          <div style={{ flex: 2 }}><label>Nuevo proyecto</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div style={{ flex: 1 }}><label>Temporada</label><input value={season} onChange={(e) => setSeason(e.target.value)} /></div>
          <div style={{ flex: 1.5 }}><label>Cliente</label><input value={client} onChange={(e) => setClient(e.target.value)} /></div>
          <div><button className="primary" disabled={!!busy} onClick={() => createProject(name, season, client)}>Crear proyecto</button></div>
        </div>
      </div>
    </>
  );
}

/* ---------------- Etapa 1: Casting KORA 4K + Biometría ---------------- */
function StageCasting({ state, run, busy, projectId }: any) {
  const [archId, setArchId] = useState('KORA-01');
  const [name, setName] = useState('KORA-01');
  const [body, setBody] = useState('slender');
  const [skin, setSkin] = useState('olive');
  const [hair, setHair] = useState('long straight');
  const [age, setAge] = useState(24);
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('4K');
  const [pores, setPores] = useState('natural visible pores');
  const [includeExpr, setIncludeExpr] = useState(true);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [uploadModelName, setUploadModelName] = useState('Avatar Foto Real');

  const selectedArch = SUPERMODEL_ARCHETYPES.find((a) => a.id === archId);

  const handleSelectArch = (id: string) => {
    setArchId(id);
    const found = SUPERMODEL_ARCHETYPES.find((a) => a.id === id);
    if (found) {
      setName(found.id);
      setBody(found.dna.body_type);
      setSkin(found.dna.skin_tone);
      setHair(found.dna.hair_style);
      setAge(found.dna.age_apparent);
    }
  };

  const assets = state?.assets || [];
  const sheets = assets.filter((a: any) => a.type === 'model_sheet');
  const exprSheets = assets.filter((a: any) => a.type === 'model_expressions');

  return (
    <>
      <div className="card">
        <div className="row">
          <div style={{ flex: 2.2 }}>
            <label>Arquetipo Supermodelo KORA (11 predefinidos)</label>
            <select value={archId} onChange={(e) => handleSelectArch(e.target.value)}>
              {SUPERMODEL_ARCHETYPES.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
              <option value="custom">Personalizado (Custom DNA)</option>
            </select>
          </div>
          <div style={{ flex: 1.3 }}><label>Nombre del modelo</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div style={{ width: 90 }}><label>Edad</label><input type="number" value={age} onChange={(e) => setAge(+e.target.value)} /></div>
          <div style={{ flex: 1 }}>
            <label>Canon KORA</label>
            <select value={resolution} onChange={(e) => setResolution(e.target.value as any)}>
              <option value="4K">4K Ultra</option>
              <option value="2K">2K Pro</option>
              <option value="1K">1K Fast</option>
            </select>
          </div>
        </div>
        {selectedArch && (
          <p className="sub" style={{ margin: '8px 0 12px', fontSize: 12 }}>
            ✨ <strong>{selectedArch.name}:</strong> {selectedArch.description}
          </p>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          <div style={{ flex: 1.2 }}><label>Tipo de cuerpo</label>
            <select value={body} onChange={(e) => setBody(e.target.value)}>{BODIES.map((b) => <option key={b}>{b}</option>)}</select></div>
          <div style={{ flex: 1.2 }}><label>Tono de piel</label>
            <select value={skin} onChange={(e) => setSkin(e.target.value)}>{['fair', 'light', 'medium', 'olive', 'tan', 'dark'].map((b) => <option key={b}>{b}</option>)}</select></div>
          <div style={{ flex: 1.4 }}><label>Cabello</label>
            <select value={hair} onChange={(e) => setHair(e.target.value)}>{['long straight', 'wavy bob', 'short pixie', 'curly', 'ponytail', 'sleek low bun', 'soft editorial waves', 'short close-cropped'].map((b) => <option key={b}>{b}</option>)}</select></div>
          <div style={{ flex: 1.5 }}><label>Micro-textura dérmica (Poros)</label>
            <select value={pores} onChange={(e) => setPores(e.target.value)}>
              <option value="natural visible pores">Poros naturales visibles</option>
              <option value="ultra-HD micro-pores and subsurface scattering">Ultra-HD Micro-poros + SSS</option>
              <option value="soft editorial satin skin">Satinado editorial suave</option>
            </select>
          </div>
        </div>
        <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
            <input type="checkbox" checked={includeExpr} onChange={(e) => setIncludeExpr(e.target.checked)} style={{ width: 'auto' }} />
            Incluir Hoja de 5 Micro-Expresiones (Curiosidad, Confianza, Diversión, Pensativo, Juguetón)
          </label>
          <button className="primary" disabled={!!busy}
            onClick={() => run('Generando identidad KORA 4K', () => api.createModel(projectId, {
              name,
              includeExpressions: includeExpr,
              dna: {
                archetype_id: archId,
                age_apparent: age,
                body_type: body,
                skin_tone: skin,
                hair_style: hair,
                skin_pore_visibility: pores,
                resolution,
                expression: 'neutral',
                background: 'pure white #FFFFFF',
              },
            }), 'Modelo generado con paleta biométrica + hoja de 5 poses')}>
            {busy ? 'Generando…' : 'Generar Modelo Sintético KORA'}
          </button>
        </div>
      </div>

      <div className="card">
        <label style={{ marginBottom: 8, display: 'block', fontWeight: 600 }}>
          Opción B · Subir Fotografía Real de Modelo / Avatar
        </label>
        <div className="row">
          <div style={{ flex: 1.5 }}>
            <label>Nombre del Avatar</label>
            <input value={uploadModelName} onChange={(e) => setUploadModelName(e.target.value)} />
          </div>
          <div style={{ flex: 2 }}>
            <label>Fotografía real del modelo (PNG/JPG/WEBP)</label>
            <input type="file" accept="image/*" onChange={(e) => setModelFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <button
              className="primary"
              disabled={!modelFile || !!busy}
              onClick={() =>
                run(
                  'Subiendo foto real de modelo',
                  () => api.uploadModelPhoto(projectId, modelFile!, uploadModelName),
                  'Fotografía real de modelo cargada, paleta biométrica extraída y aprobada como IMG 1',
                )
              }
            >
              Subir y Aprobar Foto Real
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Modelo</th><th>Arquetipo</th><th>Paleta Biométrica de Piel (Clone Studio)</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {(state?.models || []).map((m: any) => {
              const dna = m.dna_json ? JSON.parse(m.dna_json) : {};
              const bio = dna.biometricPalette;
              return (
                <tr key={m.id}>
                  <td><strong>{m.name}</strong></td>
                  <td className="mono">{m.archetype} · {dna.resolution || '4K'}</td>
                  <td>
                    {bio ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {bio.swatches?.map((s: any, i: number) => (
                          <span key={i} title={`${s.label}: ${s.hex}`} style={{ width: 14, height: 14, borderRadius: '50%', background: s.hex, display: 'inline-block', border: '1px solid #ccc' }} />
                        ))}
                        <span className="mono" style={{ fontSize: 11 }}>{bio.classifiedTone}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td><span className={`badge ${m.status === 'approved' ? 'ok' : ''}`}>{m.status}</span></td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button style={{ fontSize: 11, padding: '4px 8px' }} disabled={!!busy}
                      onClick={() => run('Generando 5 expresiones', () => api.generateExpressions(m.id), 'Hoja de 5 expresiones generada')}>
                      + 5 Expresiones
                    </button>
                    {m.status !== 'approved' && m.sheet_asset_id &&
                      <button className="primary" style={{ fontSize: 11, padding: '4px 8px' }}
                        onClick={() => run('Aprobando', () => api.approveModel(m.id), 'Identidad aprobada — bloqueada como IMG 1')}>
                        Aprobar identidad
                      </button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid">
        {sheets.map((a: any) => (
          <div className="thumb" key={a.id}>
            <img src={fileUrl(a.id)} alt={a.type} />
            <div className="cap"><span>panel 5 poses</span>{a.approved ? <span className="badge ok">APROBADO</span> : <span className="badge">revisar</span>}</div>
          </div>
        ))}
        {exprSheets.map((a: any) => (
          <div className="thumb" key={a.id}>
            <img src={fileUrl(a.id)} alt={a.type} />
            <div className="cap"><span>5 micro-expresiones</span><span className="badge">{a.width}×{a.height}</span></div>
          </div>
        ))}
        {assets.filter((a: any) => a.type === 'model_portrait').map((a: any) => (
          <div className="thumb" key={a.id}>
            <img src={fileUrl(a.id)} alt={a.type} />
            <div className="cap"><span>retrato KORA</span><span className="badge">{a.width}×{a.height}</span></div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------- Etapa 2: Intake + URL Scraper + Guión Estilista + Referencias por Variante ---------------- */
function StageIntake({ state, run, busy, projectId }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('Blazer Estructurado Lino');
  const [urlInput, setUrlInput] = useState('https://tienda-ejemplo.cl/products/blazer-estructurado-lino');
  const [color, setColor] = useState('Arena');
  const [colorHex, setColorHex] = useState('#cbb89a');
  const [refFiles, setRefFiles] = useState<Record<string, File | null>>({});
  const [refVariants, setRefVariants] = useState<Record<string, string>>({});
  const products = state?.products || [];
  const variants = state?.variants || [];
  const rawAssets = (state?.assets || []).filter((a: any) => a.type === 'garment_raw');

  return (
    <>
      <div className="card">
        <label style={{ marginBottom: 8, display: 'block', fontWeight: 600 }}>Opción A · Subir Fotografía de Prenda</label>
        <div className="row">
          <div style={{ flex: 2 }}><label>Nombre del producto</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div style={{ flex: 2 }}><label>Foto de la prenda (PNG/JPG/WEBP)</label><input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          <div><button className="primary" disabled={!file || !!busy}
            onClick={() => run('Ingestando archivo', () => api.uploadProduct(projectId, file!, title), 'Producto ingestado y metadatos extraídos')}>
            {busy ? 'Subiendo…' : 'Ingestar archivo'}</button></div>
        </div>
      </div>

      <div className="card">
        <label style={{ marginBottom: 8, display: 'block', fontWeight: 600 }}>Opción B · Extractor Automático por URL de E-Commerce (Virtual Product Stylist)</label>
        <div className="row">
          <div style={{ flex: 3 }}>
            <label>URL de ficha de producto (JSON-LD / OpenGraph / Shopify)</label>
            <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://..." />
          </div>
          <div style={{ flex: 1.5 }}>
            <label>Título (opcional)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <button className="primary" disabled={!urlInput.trim() || !!busy}
              onClick={() => run('Extrayendo desde URL', () => api.ingestProductUrl(projectId, urlInput, title), 'Producto extraído desde URL con deduplicación SHA-256')}>
              Extraer desde URL
            </button>
          </div>
        </div>
      </div>

      {products.map((p: any) => {
        const script = p.script_json ? JSON.parse(p.script_json) : null;
        const prodVariants = variants.filter((v: any) => v.product_id === p.id);
        const prodRawAssets = rawAssets.filter((a: any) => a.product_id === p.id);
        const selectedVariantForUpload = refVariants[p.id] ?? '';
        const selectedRefFile = refFiles[p.id] ?? null;

        return (
          <div className="card" key={p.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{p.title}</strong>{' '}
                <span className="mono">· {p.category || 'Tops'} · {p.currency} {p.price ?? '—'}</span>
                {p.source_url && <span className="badge" style={{ marginLeft: 8 }}>URL: {p.source_url.slice(0, 38)}…</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button style={{ fontSize: 11, padding: '4px 10px' }} disabled={!!busy}
                  onClick={() => run('Generando Guión y Escenas', () => api.generateScript(p.id), 'Guión de estilista (5 partes) + 5 escenas generadas')}>
                  🎬 {script ? 'Regenerar Guión & Escenas' : 'Generar Guión Estilista & 5 Escenas'}
                </button>
                <span className="mono">id {p.id}</span>
              </div>
            </div>
            <p className="sub" style={{ margin: '8px 0' }}>{p.description || 'Sin descripción'}</p>
            <div className="mono">Composición: {p.composition || '—'}</div>

            <div className="row" style={{ marginTop: 12 }}>
              <div style={{ flex: 1.5 }}><label>Añadir variante cromática</label><input value={color} onChange={(e) => setColor(e.target.value)} /></div>
              <div style={{ width: 90 }}><label>Color Hex</label><input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)} style={{ height: 36, padding: 2 }} /></div>
              <button onClick={() => run('Variante', () => api.addVariant(p.id, color, colorHex), 'Variante agregada (requiere asignar o subir sus fotografías originales)')}>Agregar variante</button>
            </div>

            {prodVariants.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {prodVariants.map((v: any) => {
                  const vRaws = prodRawAssets.filter((a: any) => a.variant_id === v.id);
                  return (
                    <span key={v.id} className={`badge ${vRaws.length ? 'ok' : ''}`} style={{ marginRight: 6, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      {v.color_hex && <span style={{ width: 10, height: 10, borderRadius: '50%', background: v.color_hex, display: 'inline-block', border: '1px solid #ccc' }} />}
                      {v.color_name} · {vRaws.length ? `${vRaws.length} ref(s)` : 'pendiente de referencias'}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="row" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              <div style={{ flex: 1.5 }}>
                <label>Subir fotografía original adicional (garment_raw)</label>
                <select value={selectedVariantForUpload} onChange={(e) => setRefVariants((m) => ({ ...m, [p.id]: e.target.value }))}>
                  <option value="">Prenda base (sin variante)</option>
                  {prodVariants.map((v: any) => (
                    <option key={v.id} value={v.id}>Variante: {v.color_name} ({v.id})</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 2 }}>
                <label>Archivo de referencia original</label>
                <input type="file" accept="image/*" onChange={(e) => setRefFiles((m) => ({ ...m, [p.id]: e.target.files?.[0] || null }))} />
              </div>
              <div>
                <button
                  disabled={!selectedRefFile || !!busy}
                  onClick={() => run(
                    'Subiendo referencia original',
                    () => api.uploadProductReference(p.id, selectedRefFile!, selectedVariantForUpload || null),
                    'Fotografía original vinculada explícitamente',
                  )}
                >
                  Subir referencia
                </button>
              </div>
            </div>

            {prodRawAssets.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <label>Asociación explícita de fotografías originales (`garment_raw`)</label>
                <div className="grid" style={{ marginTop: 6 }}>
                  {prodRawAssets.map((a: any) => (
                    <div className="thumb" key={a.id}>
                      <img src={fileUrl(a.id)} alt="raw" />
                      <div className="cap">
                        <span className="mono">{a.id.slice(0, 10)}</span>
                        <span className="badge">{a.width}×{a.height}</span>
                      </div>
                      <div style={{ padding: '4px 8px 8px' }}>
                        <select
                          style={{ fontSize: 11, padding: '3px 6px' }}
                          value={a.variant_id || ''}
                          disabled={!!busy}
                          onChange={(e) => run(
                            'Asignando referencia a variante',
                            () => api.assignRawVariant(a.id, e.target.value || null),
                            'Asociación de referencia actualizada',
                          )}
                        >
                          <option value="">Prenda base (sin variante)</option>
                          {prodVariants.map((v: any) => (
                            <option key={v.id} value={v.id}>Variante: {v.color_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {script && (
              <div style={{ marginTop: 14, padding: 12, background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 6 }}>
                <div className="mono" style={{ fontWeight: 600, marginBottom: 6 }}>
                  GUIÓN DE ESTILISTA IA & PLANIFICADOR DE 5 ESCENAS (Virtual Product Stylist)
                </div>
                <table>
                  <thead>
                    <tr><th>Sección</th><th>Duración</th><th>Locución (Basada en Atributos Verificados)</th><th>Plano / Escena</th></tr>
                  </thead>
                  <tbody>
                    {(script.parts || []).map((pt: any, idx: number) => {
                      const sc = script.scenes?.[idx];
                      return (
                        <tr key={pt.section}>
                          <td><span className="badge ok">{pt.section}</span></td>
                          <td className="mono">{pt.durationSec}s</td>
                          <td style={{ fontSize: 12 }}>{pt.narration}</td>
                          <td className="mono" style={{ fontSize: 11 }}>{sc ? `${sc.cameraAngle} (${sc.movement})` : pt.visualFocus}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ---------------- Etapa 3: Garment Lock 1:1 (Prenda Base y por Variante) ---------------- */
function StageLock({ state, run, busy }: any) {
  const products = state?.products || [];
  const variants = state?.variants || [];
  const locks = state?.locks || [];
  const rawAssets = (state?.assets || []).filter((a: any) => a.type === 'garment_raw');
  const cuts = (state?.assets || []).filter((a: any) => a.type === 'garment_cut');

  const renderScopeCard = (p: any, v: any | null) => {
    const scopeVariantId = v ? v.id : null;
    const scopeLocks = locks.filter((l: any) => l.product_id === p.id && (l.variant_id ?? null) === scopeVariantId);
    const lock = scopeLocks[scopeLocks.length - 1];
    const dna = lock?.garment_dna_json ? JSON.parse(lock.garment_dna_json || '{}') : null;
    const scopeRaws = rawAssets.filter((a: any) => a.product_id === p.id && (a.variant_id ?? null) === scopeVariantId);

    return (
      <div className="card" key={`${p.id}_${scopeVariantId || 'base'}`}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <strong>{p.title}</strong>
            {v ? (
              <span className="badge" style={{ marginLeft: 8 }}>
                Variante: {v.color_name} {v.color_hex ? `(${v.color_hex})` : ''}
              </span>
            ) : (
              <span className="badge" style={{ marginLeft: 8 }}>Prenda Base</span>
            )}
            {dna?.lockCode && <span className="badge ok" style={{ marginLeft: 8 }}>{dna.lockCode}</span>}
          </div>
          <span className={`badge ${lock?.approved ? 'ok' : ''}`}>
            {lock ? (lock.approved ? 'lock 1:1 aprobado' : lock.status) : scopeRaws.length ? 'listo para crear lock' : 'pendiente de referencias'}
          </span>
        </div>

        <div className="mono" style={{ marginTop: 6, fontSize: 11 }}>
          Fotografías originales asignadas a este ámbito: <strong>{scopeRaws.length}</strong>
          {!scopeRaws.length && (
            <span style={{ color: '#b91c1c', marginLeft: 8 }}>
              (Falta asignar o subir al menos una fotografía `garment_raw` en Etapa 2 para habilitar este Garment Lock)
            </span>
          )}
        </div>

        {(!lock || lock.status === 'stale_reference') && (
          <div style={{ marginTop: 12 }}>
            <button
              className="primary"
              disabled={!!busy || !scopeRaws.length}
              onClick={() => run(
                'Analizando prenda 1:1',
                () => api.createLock(p.id, { variantId: scopeVariantId }),
                'ADN textil extraído + código VL generado + recorte auxiliar creado',
              )}
            >
              {busy ? 'Analizando…' : v ? `Crear Garment Lock de Variante (${v.color_name})` : 'Crear Garment Lock 1:1 (Prenda Base)'}
            </button>
          </div>
        )}
        {dna && (
          <>
            <p className="sub" style={{ marginTop: 12 }}>{dna.descriptor}</p>
            {dna.sourceHashes?.length > 0 && (
              <div className="mono" style={{ fontSize: 11, marginBottom: 8 }}>
                SHA-256 Origen: {dna.sourceHashes[0].slice(0, 24)}… ({dna.sourceHashes.length} ref)
              </div>
            )}
            <table>
              <tbody>
                {Object.entries(dna.verifiedAttributes || {}).map(([k, vAttr]) => (
                  <tr key={k}><th>{k}</th><td>{String(vAttr ?? '—')}</td></tr>
                ))}
              </tbody>
            </table>
            {!lock.approved && lock.status !== 'stale_reference' && (
              <div style={{ marginTop: 14 }}>
                <button className="primary" onClick={() => run('Aprobando lock', () => api.approveLock(lock.id), 'Lock aprobado — render V5 desbloqueado')}>
                  Aprobar ADN 1:1 {v ? `(${v.color_name})` : 'de la Prenda'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {products.map((p: any) => {
        const prodVariants = variants.filter((v: any) => v.product_id === p.id);
        return (
          <React.Fragment key={p.id}>
            {renderScopeCard(p, null)}
            {prodVariants.map((v: any) => renderScopeCard(p, v))}
          </React.Fragment>
        );
      })}
      <div className="grid">
        {cuts.map((a: any) => (
          <div className="thumb" key={a.id}><img src={fileUrl(a.id)} alt="cut" /><div className="cap"><span>recorte auxiliar 1:1</span><span className="badge">{a.variant_id ? `var ${a.variant_id.slice(0, 8)}` : 'base'}</span></div></div>
        ))}
      </div>
    </>
  );
}


/* ---------------- Etapa 4: Render Master V5 + Dirección de Pose + Virtual Stylist Pro + Clone Studio ---------------- */
function StageRender({ state, run, busy }: any) {
  const models = (state?.models || []).filter((m: any) => m.status === 'approved');
  const locks = (state?.locks || []).filter((l: any) => l.approved);
  const [modelId, setModelId] = useState('');
  const [lockId, setLockId] = useState('');
  const [variantId, setVariantId] = useState('');

  // Virtual Stylist Pro
  const [stylePresetId, setStylePresetId] = useState('minimalist');
  const [fabricType, setFabricType] = useState('Original (Lock)');
  const [drape, setDrape] = useState(55);
  const [wrinkle, setWrinkle] = useState(15);
  const [texture, setTexture] = useState(60);
  const [sheen, setSheen] = useState('matte');

  // Dirección de Pose
  const [poseCategory, setPoseCategory] = useState('Chaquetas');
  const [plane, setPlane] = useState<string>(POSE_PLANES[0]);
  const [cameraAngle, setCameraAngle] = useState<string>(POSE_CAMERA_ANGLES[0]);
  const [attitude, setAttitude] = useState<string>(POSE_ATTITUDES[0]);

  // Clone Studio Pose Esquelética + Fondo
  const [posePresetId, setPosePresetId] = useState('standing_straight');
  const [backgroundPresetId, setBackgroundPresetId] = useState('studio_white_cyc');
  const [additionalPrompt, setAdditionalPrompt] = useState('');

  useEffect(() => { if (models[0] && !modelId) setModelId(models[0].id); }, [models.length]);
  useEffect(() => { if (locks[0] && !lockId) setLockId(locks[0].id); }, [locks.length]);

  const handleStylePresetChange = (id: string) => {
    setStylePresetId(id);
    const p = STYLE_PRESETS.find((s) => s.id === id);
    if (p) {
      setDrape(p.settings.drape);
      setWrinkle(p.settings.wrinkle);
      setTexture(p.settings.texture);
      setSheen(p.settings.sheen);
    }
  };

  const activeLock = locks.find((l: any) => l.id === lockId);
  const productVariants = (state?.variants || []).filter((v: any) => v.product_id === activeLock?.product_id);
  const renders = (state?.assets || []).filter((a: any) => ['tryon', 'view_front', 'view_left', 'view_right', 'view_back', 'ghost'].includes(a.type));
  const poseGuide = POSE_SUGGESTIONS[poseCategory];

  const handleLockChange = (newLockId: string) => {
    setLockId(newLockId);
    const lk = locks.find((l: any) => l.id === newLockId);
    setVariantId(lk?.variant_id || '');
  };

  const handleVariantChange = (newVariantId: string) => {
    setVariantId(newVariantId);
    if (!activeLock) return;
    const matchingLock = locks.find(
      (l: any) => l.product_id === activeLock.product_id && (l.variant_id || '') === newVariantId,
    );
    if (matchingLock) setLockId(matchingLock.id);
  };

  const go = (mode: string) => {
    if (!activeLock) return run('x', async () => { throw new Error('Aprueba un lock primero'); });
    const targetLock = locks.find(
      (l: any) => l.product_id === activeLock.product_id && (l.variant_id || '') === (variantId || ''),
    ) || activeLock;
    return run(
      mode === 'views' ? 'Generando 4 vistas 3D' : mode === 'ghost' ? 'Generando Efecto Flotante (Ghost 3D)' : 'Generando Master Render V5',
      () => api.render(activeLock.product_id, {
        modelId,
        lockId: targetLock.id,
        variantId: variantId || undefined,
        mode,
        params: {
          view: 'Frontal',
          stylePresetId,
          fabricType,
          drape,
          wrinkle,
          texture,
          sheen,
          poseCategory,
          plane,
          cameraAngle,
          attitude,
          posePresetId,
          backgroundPresetId,
          additionalPrompt: additionalPrompt.trim() || undefined,
        },
      }),
      'Render completado con asignación estricta de fuentes (Master Prompt V5)',
    );
  };

  if (!models.length || !locks.length) {
    return <div className="card"><p className="sub">Necesitas un modelo aprobado (Etapa 1) y un garment lock aprobado (Etapa 3).</p></div>;
  }

  return (
    <>
      <div className="card">
        <div className="row">
          <div style={{ flex: 1.8 }}><label>IMG 1 · Identidad Avatar (Inmutable)</label>
            <select value={modelId} onChange={(e) => setModelId(e.target.value)}>{models.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.archetype})</option>)}</select></div>
          <div style={{ flex: 1.8 }}><label>IMG 2 · Garment Lock 1:1</label>
            <select value={lockId} onChange={(e) => handleLockChange(e.target.value)}>
              {locks.map((l: any) => {
                const lv = (state?.variants || []).find((v: any) => v.id === l.variant_id);
                return (
                  <option key={l.id} value={l.id}>
                    {l.id} · v{l.version} ({lv ? `Variante ${lv.color_name}` : 'Prenda Base'})
                  </option>
                );
              })}
            </select></div>
          <div style={{ flex: 1.4 }}><label>Variante Cromática</label>
            <select value={variantId} onChange={(e) => handleVariantChange(e.target.value)}>
              <option value="">Prenda Base (sin variante)</option>
              {productVariants.map((v: any) => {
                const hasApprovedLock = locks.some((l: any) => l.product_id === v.product_id && l.variant_id === v.id);
                return (
                  <option key={v.id} value={v.id}>
                    {v.color_name} {v.color_hex ? `(${v.color_hex})` : ''} {hasApprovedLock ? '✓ Lock OK' : '⚠ Pendiente Lock'}
                  </option>
                );
              })}
            </select>
          </div>
        </div>


        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '14px 0' }} />

        <div className="row">
          <div style={{ flex: 1.6 }}>
            <label>Style Preset (Virtual Stylist Pro)</label>
            <select value={stylePresetId} onChange={(e) => handleStylePresetChange(e.target.value)}>
              {STYLE_PRESETS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1.2 }}>
            <label>Física de Tela (15 tejidos)</label>
            <select value={fabricType} onChange={(e) => setFabricType(e.target.value)}>
              {FABRIC_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div style={{ flex: 0.9 }}><label>Caída (Drape {drape}%)</label><input type="range" min={0} max={100} value={drape} onChange={(e) => setDrape(+e.target.value)} /></div>
          <div style={{ flex: 0.9 }}><label>Arrugas ({wrinkle}%)</label><input type="range" min={0} max={100} value={wrinkle} onChange={(e) => setWrinkle(+e.target.value)} /></div>
          <div style={{ flex: 0.9 }}><label>Textura HD ({texture}%)</label><input type="range" min={0} max={100} value={texture} onChange={(e) => setTexture(+e.target.value)} /></div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div style={{ flex: 1.2 }}>
            <label>Categoría de Prenda</label>
            <select value={poseCategory} onChange={(e) => setPoseCategory(e.target.value)}>
              {Object.keys(POSE_CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 1.4 }}>
            <label>Plano Fotográfico</label>
            <select value={plane} onChange={(e) => setPlane(e.target.value)}>
              {POSE_PLANES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ flex: 1.4 }}>
            <label>Ángulo de Cámara</label>
            <select value={cameraAngle} onChange={(e) => setCameraAngle(e.target.value)}>
              {POSE_CAMERA_ANGLES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div style={{ flex: 1.2 }}>
            <label>Actitud Editorial</label>
            <select value={attitude} onChange={(e) => setAttitude(e.target.value)}>
              {POSE_ATTITUDES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {poseGuide && (
          <div className="mono" style={{ marginTop: 8, padding: 8, background: '#f8fafc', borderRadius: 4, fontSize: 11 }}>
            📐 <strong>Directriz de Pose ({poseCategory}):</strong> {poseGuide.pose} · <strong>Foco:</strong> {poseGuide.focus}
          </div>
        )}

        <div className="row" style={{ marginTop: 12 }}>
          <div style={{ flex: 1.6 }}>
            <label>Pose Esquelética 13-Ángulos (Clone Studio)</label>
            <select value={posePresetId} onChange={(e) => setPosePresetId(e.target.value)}>
              {SKELETAL_POSE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
            </select>
          </div>
          <div style={{ flex: 1.6 }}>
            <label>Fondo de Estudio / Exterior (12 ambientes)</label>
            <select value={backgroundPresetId} onChange={(e) => setBackgroundPresetId(e.target.value)}>
              {BACKGROUND_PRESETS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 2 }}>
            <label>Instrucción adicional de refinamiento (opcional)</label>
            <input value={additionalPrompt} onChange={(e) => setAdditionalPrompt(e.target.value)} placeholder="Ej: Mangas ligeramente remangadas, botones abrochados..." />
          </div>
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <button className="primary" disabled={!!busy} onClick={() => go('tryon')}>Generar Try-On (Master V5)</button>
          <button disabled={!!busy} onClick={() => go('views')}>Generar 4 Vistas 3D (Frontal/Lat/Espalda)</button>
          <button disabled={!!busy} onClick={() => go('ghost')}>Efecto Flotante (Ghost Mannequin 3D)</button>
        </div>
      </div>

      <div className="grid">
        {renders.map((a: any) => (
          <div className="thumb" key={a.id}>
            <img src={fileUrl(a.id)} alt={a.type} />
            <div className="cap"><span>{a.type.replace('view_', 'vista ')}</span>
              <span className={`badge ${a.approved ? 'ok' : ''}`}>{a.approved ? 'aprobado' : a.stage}</span></div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------- Etapa 5: QA 5-Controles Clone Studio V5 + Reintento Asistido ---------------- */
function StageQA({ state, run, busy }: any) {
  const pending = (state?.assets || []).filter((a: any) => ['tryon', 'ghost', 'view_front', 'view_left', 'view_right', 'view_back'].includes(a.type));
  const [retryMap, setRetryMap] = useState<Record<string, string>>({});

  return (
    <>
      <div className="card">
        <p className="sub" style={{ margin: 0 }}>
          <strong>Auditoría Forense de 5 Controles (Clone Studio V5) + Óptica CIE76 ΔE:</strong> Verifica Control A (Identidad Avatar), Control B (Exclusión de Atributos Prohibidos: cero joyas/maquillaje/tatuajes importados), Control C (Fidelidad Textil 1:1), Control D (Composición y Pose) y Control E (Calidad Técnica). Incluye Reintento Asistido directo.
        </p>
      </div>
      <div className="grid">
        {pending.map((a: any) => {
          const qa = a.qa_json ? JSON.parse(a.qa_json) : null;
          const opt = qa?.opticalMetrics;
          const ctrls = qa?.controls;
          const corrText = retryMap[a.id] ?? '';
          return (
            <div className="thumb" key={a.id}>
              <img src={fileUrl(a.id)} alt={a.type} />
              <div className="cap"><span>{a.type}</span>
                {qa ? <span className={`badge ${qa.overallStatus === 'PASS' ? 'ok' : 'bad'}`}>{qa.overallStatus} {Math.round((a.qa_score || 0) * 100)}%</span> : <span className="badge">sin QA</span>}
              </div>
              {opt && (
                <div className="mono" style={{ padding: '0 8px 4px', fontSize: 10 }}>
                  ΔE: {opt.deltaE} · nitidez: {opt.sharpness} · {opt.dimensions}
                </div>
              )}
              {ctrls && (
                <div className="mono" style={{ padding: '0 8px 6px', fontSize: 10, lineHeight: 1.4 }}>
                  A(ID): {ctrls.controlA_identity?.passed ? '✓' : '✗'} · B(Excl): {ctrls.controlB_prohibitedExclusion?.passed ? '✓' : '✗'} · C(Tela): {ctrls.controlC_textileFidelity?.passed ? '✓' : '✗'} · D(Pose): {ctrls.controlD_compositionPose?.passed ? '✓' : '✗'}
                </div>
              )}
              <div style={{ padding: '0 8px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button style={{ padding: '5px 9px', fontSize: 11 }} disabled={!!busy}
                  onClick={() => run('Auditando 5 Controles QA', () => api.qa(a.id), 'Auditoría QA de 5 controles completada')}>Auditar QA</button>
                {qa?.overallStatus === 'PASS' && !a.approved &&
                  <button className="primary" style={{ padding: '5px 9px', fontSize: 11 }} disabled={!!busy}
                    onClick={() => run('Aprobando', () => api.approveAsset(a.id), 'Asset aprobado para catálogo')}>Aprobar</button>}
                {a.approved && <span className="badge ok">aprobado</span>}
              </div>
              <div style={{ padding: '0 8px 8px', borderTop: '1px solid var(--line)', paddingTop: 6 }}>
                <input
                  placeholder="Corrección V5 (ej: ajustar cuello)..."
                  value={corrText}
                  onChange={(e) => setRetryMap((m) => ({ ...m, [a.id]: e.target.value }))}
                  style={{ fontSize: 10, padding: '4px 6px', marginBottom: 4 }}
                />
                <button
                  style={{ width: '100%', padding: '4px 6px', fontSize: 10 }}
                  disabled={!!busy}
                  onClick={() => run('Ejecutando Reintento Asistido V5', () => api.retryAsset(a.id, corrText || 'Corregir fidelidad 1:1 de costuras y cuello'), 'Nuevo render corregido generado')}
                >
                  🔄 Reintento Asistido (Corrección V5)
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------------- Etapa 6: Compose Haute Couture + Detección Anatómica + ZIP ---------------- */
function StageCompose({ state, run, busy, projectId }: any) {
  const approved = (state?.assets || []).filter((a: any) => a.approved && a.type !== 'composed');
  const [sel, setSel] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState('AUTO');
  const [resolution, setResolution] = useState('1000x1500');
  const [fitMode, setFitMode] = useState('CONTAIN');
  const [cols, setCols] = useState(2);
  const [margin, setMargin] = useState(40);
  const [gap, setGap] = useState(20);
  const [borderWidth, setBorderWidth] = useState(0);

  const composed = (state?.assets || []).filter((a: any) => a.type === 'composed');
  const exportsList = state?.exports || [];

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <>
      <div className="card">
        <label>Selecciona Assets Aprobados para Maquetar ({sel.length} de {approved.length} seleccionados)</label>
        <div className="grid" style={{ marginTop: 8 }}>
          {approved.map((a: any) => (
            <div className="thumb" key={a.id} onClick={() => toggle(a.id)}
              style={{ outline: sel.includes(a.id) ? '2px solid var(--acc)' : 'none', cursor: 'pointer' }}>
              <img src={fileUrl(a.id)} alt={a.type} />
              <div className="cap"><span>{a.type}</span><span className="badge">{sel.includes(a.id) ? `✓ #${sel.indexOf(a.id) + 1}` : ''}</span></div>
            </div>
          ))}
          {!approved.length && <p className="sub">Aprueba assets en la Etapa 5 para poder maquetar el catálogo.</p>}
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <div style={{ flex: 2 }}>
            <label>Plantilla Editorial Haute Couture (Catalog Maker)</label>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="AUTO">AUTO · Selección inteligente según N° de fotos ({sel.length})</option>
              {HAUTE_COUTURE_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.name} — {t.description}</option>
              ))}
              <option value="GRID">Grilla Simétrica por Columnas</option>
            </select>
          </div>
          <div style={{ flex: 1.4 }}>
            <label>Resolución de Salida</label>
            <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
              {Object.entries(CATALOG_RESOLUTIONS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Encuadre (Fit Mode)</label>
            <select value={fitMode} onChange={(e) => setFitMode(e.target.value)}>
              <option value="CONTAIN">CONTAIN (Cero recorte)</option>
              <option value="COVER">COVER (Llenado editorial)</option>
              <option value="ORIGINAL">ORIGINAL (Escala interna)</option>
            </select>
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          {templateId === 'GRID' && (
            <div style={{ width: 110 }}><label>Columnas</label>
              <select value={cols} onChange={(e) => setCols(+e.target.value)}>{[1, 2, 3, 4].map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          )}
          <div style={{ width: 110 }}><label>Margen (px)</label><input type="number" value={margin} onChange={(e) => setMargin(+e.target.value)} /></div>
          <div style={{ width: 110 }}><label>Espaciado (px)</label><input type="number" value={gap} onChange={(e) => setGap(+e.target.value)} /></div>
          <div style={{ width: 110 }}><label>Borde celda (px)</label><input type="number" min={0} max={10} value={borderWidth} onChange={(e) => setBorderWidth(+e.target.value)} /></div>
          <button className="primary" disabled={!sel.length || !!busy}
            onClick={() => run('Componiendo lámina Haute Couture', () => api.compose(projectId, {
              assetIds: sel, templateId, resolution, fitMode, cols, margin, gap, borderWidth,
            }), 'Lámina editorial generada con detección anatómica y hash SHA-256')}>
            Componer Catálogo Haute Couture
          </button>
          <button disabled={!!busy} onClick={() => run('Exportando', () => api.exportProject(projectId), 'Paquete ZIP de entrega generado (incluye imágenes, guiones y manifest)')}>
            Exportar Entrega (.ZIP)
          </button>
        </div>
      </div>

      {exportsList.length > 0 && (
        <div className="card">
          <label>Paquetes de entrega (.ZIP con Assets + Guiones + Manifest SHA-256) ({exportsList.length})</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            {exportsList.map((ex: any) => (
              <a
                key={ex.id}
                href={exportZipUrl(ex.id)}
                download={`atelier_${ex.id}.zip`}
                className="badge ok"
                style={{ textDecoration: 'none', padding: '6px 12px' }}
              >
                ⬇ Descargar atelier_{ex.id}.zip
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="grid">
        {composed.map((a: any) => {
          const meta = a.qa_json ? JSON.parse(a.qa_json) : null;
          const qv = meta?.qualityValidation;
          return (
            <div className="thumb" key={a.id}>
              <img src={fileUrl(a.id)} style={{ aspectRatio: '2/3' }} alt="composed" />
              <div className="cap">
                <span>{meta?.templateName || 'catálogo'}</span>
                <span className="badge ok">{a.width}×{a.height}</span>
              </div>
              {!a.approved && <button onClick={() => run('Aprobando composición',
                () => api.approveAsset(a.id), 'Composición aprobada')}>Aprobar composición</button>}
              {qv && (
                <div className="mono" style={{ padding: '0 8px 8px', fontSize: 10 }}>
                  SHA-256: {qv.outputSha256?.slice(0, 14)}… · Cero distorsión: {qv.zeroScaleDistortion ? '✓' : '✗'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

