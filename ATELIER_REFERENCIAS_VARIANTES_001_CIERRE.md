# ATELIER — REFERENCIAS Y VARIANTES 001 (`ATELIER_REFERENCIAS_VARIANTES_001_CIERRE`)

- **Estado de cierre:** **PASS** (para todos los contratos, rutas, procedencia criptográfica, aislamiento de variantes y controles de entrega verificados en MOCK y con adaptador simulado sobre datos aislados).
- **Alcance de la validación:** Las pruebas en modo `MOCK` y con adaptador simulado acreditan **contratos, selección/orden de referencias, procedencia SHA-256 y compuertas de entrega**, pero **no declaran validada la fidelidad visual REAL** (la cual requiere pruebas con proveedor Gemini real).

---

## 1. Cambios y archivos afectados

| Archivo | Símbolos / Rutas principales | Descripción del cambio |
|---|---|---|
| [server/db.ts](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/server/db.ts#L92-L102) | `locks.variant_id`, `idx_locks_product_variant`, `idx_assets_product_variant` | Migración automática idempotente para vincular explícitamente cada `Garment Lock` a su ámbito (`variant_id = NULL` para prenda base o `variant_id = 'vr_...'` para una variante). |
| [shared/types.ts](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/shared/types.ts#L31-L72) | [`ReferenceManifestEntry`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/shared/types.ts#L31-L39), [`GarmentDNA`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/shared/types.ts#L41-L48), [`Variant`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/shared/types.ts#L50-L57), [`GarmentLock`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/shared/types.ts#L59-L71) | Contrato tipado para el manifiesto de referencias por generación (`order`, `imageIndex`, `assetId`, `role`, `type`, `sha256`, `variantId`) y entidades de variante/lock. |
| [engines/intake.ts](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/engines/intake.ts#L346-L499) | [`addVariant`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/engines/intake.ts#L346-L352), [`assignRawAssetVariant`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/engines/intake.ts#L357-L434), [`uploadProductReference`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/engines/intake.ts#L436-L471), [`refreshVariantStatus`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/engines/intake.ts#L474-L499) | Subida y asignación explícita de originales (`garment_raw`) a variantes, preservando originales históricos (`variant_id = null`) sin deducción por nombre/color. Al cambiar la asociación o añadir referencias a un ámbito, los locks y aprobaciones afectadas se invalidan (`status = 'stale_reference'`, `approved = 0`). |
| [engines/lock.ts](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/engines/lock.ts#L1-L265) | [`resolveLockSources`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/engines/lock.ts#L116-L193), [`createLock`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/engines/lock.ts#L195-L208), [`approveLock`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/engines/lock.ts#L210-L250), `lock.analyze`, `lock.isolate` | Vinculación de cada Garment Lock con el producto y la variante correspondientes. Rechazo explícito (`REFERENCE_LIMIT_EXCEEDED`) cuando se superan las 6 referencias originales sin descartar originales silenciosamente. Bloqueo (`VARIANT_REFERENCES_MISSING`) cuando una variante carece de originales propios. |
| [engines/render.ts](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/engines/render.ts#L1-L360) | [`assembleProviderReferences`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/engines/render.ts#L69-L95), `render.tryon`, `render.view`, `render.ghost`, `render.retry`, `studio.pose` | Todos los renders envían las fotografías originales (`garment_raw`) del lock aprobado como evidencia primaria y el recorte (`garment_cut`) o render previo únicamente como apoyos identificados. `studio.pose` conserva `variant_id`, `model_id`, `lock_id` y `parent_asset_id`, e incorpora la hoja de identidad aprobada y los originales de prenda cuando deriva de un render de catálogo. Se registra en `audit_log` (`action = 'render_references'`) y en la respuesta el manifiesto con IDs, roles, orden y huellas SHA-256. |
| [engines/prompts.ts](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/engines/prompts.ts#L156-L372) | `formatReferenceManifest`, [`tryOnPrompt`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/engines/prompts.ts#L190-L278), [`viewPrompt`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/engines/prompts.ts#L287-L312), [`ghostPrompt`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/engines/prompts.ts#L314-L335), [`poseStudioPrompt`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/engines/prompts.ts#L337-L371) | Los prompts numeran dinámicamente cada imagen (`IMAGE_1_...`, `IMAGE_2_...`) según las entradas reales enviadas al proveedor, distinguiendo `identity_sheet`, `garment_original`, `garment_cut_support`, `previous_render_support` y `pose_source_support`. |
| [server/gates.ts](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/server/gates.ts#L29-L73) | [`requireApprovedLock`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/server/gates.ts#L29-L73) | Valida correspondencia exacta entre `lock.variant_id`, `expectedVariantId` y `source.variant_id`, verifica las huellas SHA-256 contra `garment_dna_json.sourceHashes` y exige actualizar y reaprobar el lock si cambió cualquier referencia. |
| [server/qa-evidence.ts](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/server/qa-evidence.ts#L30-L81) | [`qaEvidence`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/server/qa-evidence.ts#L30-L81) | Conserva la igualdad estricta `(source.variant_id ?? null) === (asset.variant_id ?? null)` y verifica `(lock.variant_id ?? null) === (asset.variant_id ?? null)` sin convertir `variant_id = null` en comodín y sin alterar las políticas `NOT_VISIBLE` ni `POSSIBLE_MISMATCH`. |
| [server/provider.ts](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/server/provider.ts#L27-L44) | [`setProviderAdapter`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/server/provider.ts#L36-L38), [`getProviderAdapter`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/server/provider.ts#L40-L42) | Adaptador inyectable para capturar y auditar determinísticamente las entradas multimodales en pruebas sin llamadas externas. |
| [server/index.ts](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/server/index.ts#L296-L388) | `POST /api/products/:id/references`, `POST /api/assets/:id/assign-variant`, `POST /api/products/:id/lock`, `POST /api/products/:id/render` | Endpoints REST para subir referencias por variante, asignar originales existentes y operar locks/renders por variante. |
| [src/api.ts](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/src/api.ts#L40-L61) y [src/App.tsx](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/src/App.tsx#L471-L885) | `StageIntake`, `StageLock`, `StageRender` | Controles de interfaz para subir o asignar `garment_raw` a variantes (Etapa 2), crear/aprobar Garment Lock para prenda base y para cada variante mostrando qué evidencia falta (Etapa 3), y seleccionar sincronizadamente Lock y variante en Render (Etapa 4). |
| [scripts/variant-reference-check.ts](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/scripts/variant-reference-check.ts) | Suite de 9 escenarios | Batería automatizada que verifica los 9 escenarios obligatorios sobre un directorio temporal aislado. |

---

## 2. Migración y tratamiento de datos históricos

1. **Respaldo consistente previo:**
   - Antes de ejecutar las pruebas y verificaciones se realizó una copia íntegra de los archivos de código y un respaldo consistente de la base de datos SQLite mediante `VACUUM INTO` en:
     `C:\Users\ASUS Zenbook\.gemini\antigravity\brain\bcc5c5d5-ee31-4e7b-98d2-7b6d2f3411a8\scratch\backup_ref_var_001\atelier.db.bak` (`180,224` bytes).
2. **Migración SQLite aditiva e idempotente:**
   - En el arranque ([server/db.ts](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/server/db.ts#L98-L102)) se comprueba `PRAGMA table_info(locks)` y se añade `ALTER TABLE locks ADD COLUMN variant_id TEXT` si no existe, además de los índices `idx_locks_product_variant` e `idx_assets_product_variant`.
3. **Preservación de datos históricos sin inferencias automáticas:**
   - Los registros históricos de `assets` con `type = 'garment_raw'` y `variant_id = NULL`, así como los `locks` históricos con `variant_id = NULL`, permanecen intactos en el ámbito explícito de **prenda base (sin variante)**.
   - Ningún original histórico se reasigna automáticamente por nombre, posición o color. Para cualquier variante nueva o histórica sin originales asignados, la interfaz y la API informan que está en estado `pending_references` y requieren que el operador suba o asigne explícitamente sus fotografías originales antes de crear su Garment Lock o renderizar.

---

## 3. Comandos ejecutados y resultados

Todas las pruebas se ejecutaron con `ATELIER_MOCK=1`, sin credenciales de API y utilizando directorios de datos temporales aislados:

| Comando ejecutado | Resultado | Resumen de verificación |
|---|---|---|
| `npx tsc --noEmit` | **PASS** (`exit 0`) | 0 errores de tipos en `server/`, `engines/`, `shared/`, `src/` y `scripts/`. |
| `npm run build` | **PASS** (`exit 0`) | Compilación de cliente React/Vite en `dist/` (`dist/assets/index-DpAU-j-2.js`, `212.04 kB`). |
| `npx tsx scripts/variant-reference-check.ts` | **PASS** (`exit 0`) | 46 aserciones HTTP + inspección de hashes SHA-256 en adaptador simulado cubriendo los **9 escenarios obligatorios**. |
| `npx tsx scripts/qa-delivery-check.ts` | **PASS** (`exit 0`) | 34 aserciones del cierre previo de QA → aprobación → composición → exportación ZIP sin regresiones. |
| `ATELIER_DATA=<temp_dir> ATELIER_MOCK=1 npx tsx scripts/smoke.ts` | **PASS** (`exit 0`) | Smoke test completo de las 6 etapas sobre directorio aislado (`15 jobs done`, `5 assets exportados`, ZIP válido). |

---

## 4. Evidencia de las referencias capturadas por el adaptador simulado

En [`scripts/variant-reference-check.ts`](file:///C:/Users/ASUS%20Zenbook/Documents/Atelier/scripts/variant-reference-check.ts), el adaptador inyectado mediante `setProviderAdapter` intercepta cada llamada a `generateImage` y `analyzeJson`, calcula el hash SHA-256 de cada imagen base64 recibida y comprueba el manifiesto registrado:

| Operación | Ámbito | Orden exacto de imágenes recibidas por el adaptador (`args.images`) | Roles registrados en `references` / `audit_log` |
|---|---|---|---|
| `lock.analyze` | Variante A (`Marino`, 2 fotos originales) | `[sha256(varA_raw_1), sha256(varA_raw_2)]` | Análisis exclusivo de los 2 originales asignados a `varA` (0 fotos de `varB` o `base`). |
| `lock.analyze` | Variante B (`Arena`, 1 foto original) | `[sha256(varB_raw_1)]` | Análisis exclusivo del original asignado a `varB`. |
| `render.tryon` | Producto sin variantes (`base`) | `[sha256(model_sheet), sha256(noVar_raw_1), sha256(noVar_cut)]` | `1: identity_sheet`, `2: garment_original`, `3: garment_cut_support`. |
| `render.tryon` | Variante A (`Marino`) | `[sha256(model_sheet), sha256(varA_raw_1), sha256(varA_raw_2), sha256(varA_cut)]` | `1: identity_sheet`, `2: garment_original`, `3: garment_original`, `4: garment_cut_support`. |
| `render.view` (`front`, `left`, `right`, `back`) | Variante A (`Marino`) | `[sha256(model_sheet), sha256(varA_raw_1), sha256(varA_raw_2), sha256(varA_cut)]` (en cada una de las 4 vistas) | `1: identity_sheet`, `2: garment_original`, `3: garment_original`, `4: garment_cut_support` (ninguna vista generada se presenta como original). |
| `render.ghost` | Variante B (`Arena`) | `[sha256(varB_raw_1), sha256(varB_cut)]` | `1: garment_original`, `2: garment_cut_support`. |
| `render.retry` | Corrección de `tryonA` (Variante A) | `[sha256(model_sheet), sha256(varA_raw_1), sha256(varA_raw_2), sha256(varA_cut), sha256(tryonA_prev)]` | `1: identity_sheet`, `2: garment_original`, `3: garment_original`, `4: garment_cut_support`, `5: previous_render_support`. |
| `studio.pose` | Derivado de `tryonA` (Variante A) | `[sha256(model_sheet), sha256(varA_raw_1), sha256(varA_raw_2), sha256(varA_cut), sha256(tryonA_source)]` | `1: identity_sheet`, `2: garment_original`, `3: garment_original`, `4: garment_cut_support`, `5: pose_source_support` (conservando `variant_id`, `model_id` y `lock_id`). |
| `qa.evaluate` | Candidato `tryonA` (Variante A) | `[sha256(varA_raw_1), sha256(tryonA), sha256(varA_raw_2), sha256(model_sheet)]` | Evalúa el candidato contra todos los originales del lock de `varA` y la hoja de identidad aprobada. |
| `render.*` / `lock.*` | Variante sin originales (`Oliva Sin Fotos`) | **`0 llamadas al adaptador`** (`capturedGenerateCalls.length === 0`, `capturedAnalyzeCalls.length === 0`) | Bloqueado en el servidor con HTTP `409` (`VARIANT_REFERENCES_MISSING` / `LOCK_VARIANT_MISMATCH`) antes de invocar al proveedor. |

---

## 5. Verificación de interfaz y limitaciones documentadas

- **Comprobación de interfaz (`src/App.tsx` + `src/api.ts`):**
  - Se verificó mediante compilación estática (`tsc --noEmit`) y empaquetado de producción (`npm run build`), así como contra las rutas HTTP reales que consume `src/api.ts` (`/api/products/:id/references`, `/api/assets/:id/assign-variant`, `/api/products/:id/lock`, `/api/products/:id/render`, `/api/projects/:id/state`), que el estado devuelto al cliente con dos variantes (`Marino` y `Arena`) expone las variantes, sus originales asignados (`garment_raw`), sus `locks` independientes por `variant_id` y los selectores sincronizados en `StageIntake`, `StageLock` y `StageRender`.
  - **Limitación del entorno de ejecución:** No se ejecutó automatización de navegador headless (Playwright/Puppeteer) sobre el DOM renderizado; la verificación extremo a extremo se realizó contra el servidor HTTP real en localhost y el bundle de Vite compilado.
- **Limitación sobre fidelidad visual REAL:**
  - Todas las pruebas se ejecutaron en modo `MOCK` / adaptador simulado sin llamadas pagadas. Esto certifica la procedencia criptográfica, el aislamiento de variantes y el envío exacto de imágenes y prompts al adaptador, pero **no certifica la fidelidad visual fotorrealista del modelo generativo en modo `REAL` (`GEMINI_API_KEY`)**.
- **Pendientes fuera de alcance (no modificados en esta tarea):**
  - `Qwen-Image`, `Kluger` y `Z-Image`.
  - Generación de video de asesora, voz TTS y sincronización labial.
  - Biblioteca de fondos personalizados (`BackgroundManager`).
  - Procesamiento masivo por lotes (`BatchService`), recuperación avanzada de cola y política general de reintentos.
  - Alineación editorial anatómica en composición (`detectSubjectLandmarks`).
  - Restauración de identificadores históricos de casting (`ISA-02` a `VEGA-09`) y corrección general de overrides en modo Exacto.
  - Políticas `NOT_VISIBLE` y `POSSIBLE_MISMATCH` en `passesQA`.

---

## 6. Procedimiento de reversión

1. **Reversión de código:**
   Con el servidor detenido, restaurar los archivos desde la copia de respaldo creada antes de esta intervención:
   ```powershell
   $bkp = "C:\Users\ASUS Zenbook\.gemini\antigravity\brain\bcc5c5d5-ee31-4e7b-98d2-7b6d2f3411a8\scratch\backup_ref_var_001"
   Copy-Item -Path "$bkp\server","$bkp\engines","$bkp\shared","$bkp\src","$bkp\scripts","$bkp\package.json" -Destination "C:\Users\ASUS Zenbook\Documents\Atelier" -Recurse -Force
   Remove-Item "C:\Users\ASUS Zenbook\Documents\Atelier\scripts\variant-reference-check.ts" -ErrorAction SilentlyContinue
   ```
2. **Reversión de base de datos SQLite (si fuera necesario):**
   La columna `locks.variant_id` es opcional (`NULL` por defecto) y compatible con versiones previas. Si se desea restaurar exactamente el archivo `data/atelier.db` previo a esta sesión, con la aplicación detenida ejecutar:
   ```powershell
   Remove-Item "C:\Users\ASUS Zenbook\Documents\Atelier\data\atelier.db-wal","C:\Users\ASUS Zenbook\Documents\Atelier\data\atelier.db-shm" -ErrorAction SilentlyContinue
   Copy-Item "C:\Users\ASUS Zenbook\.gemini\antigravity\brain\bcc5c5d5-ee31-4e7b-98d2-7b6d2f3411a8\scratch\backup_ref_var_001\atelier.db.bak" "C:\Users\ASUS Zenbook\Documents\Atelier\data\atelier.db" -Force
   ```

