# INFORME DE REMEDIACIÓN CONTROLADA DE DEPENDENCIAS — ATELIER-DEPENDENCY-REMEDIATION-003

- **Proyecto:** ATELIER — Unified Visual Production Engine
- **Repositorio:** `https://github.com/ApolinarCastro/Atelier`
- **Rama Base (Inmutable):** `main`
- **Baseline Inicial:** `bad10bf1d749f2d7cfd0dd4b496c6de3e789fab2`
- **Rama de Trabajo Aislada:** `security/remediation-003`
- **Commit de Remediación:** `0e218194b219bf410d28a86d94380ff85b21ef57` (`0e21819`)
- **Modo:** `READ_ONLY_FIRST → CONTROLLED_IMPLEMENTATION`
- **Fecha de Ejecución:** `2026-11-03T11:43:00-03:00`
- **Decisión Final:** **`REMEDIATION_ACCEPTED`** (en la rama aislada, pendiente de revisión humana para merge a `main`)

---

## 1. Baseline Inicial y Rama de Trabajo

- **Estado de `main`:** Inmutable. El puntero local `main` y el remoto `origin/main` permanecen idénticos e intactos en el SHA `bad10bf1d749f2d7cfd0dd4b496c6de3e789fab2`.
- **Rama de Trabajo:** `security/remediation-003` creada a partir de `bad10bf1d749f2d7cfd0dd4b496c6de3e789fab2`.
- **Restricción Cumplida:** No se realizaron merges ni operaciones de `git push` hacia `main` ni hacia ningún remoto.

---

## 2. Inventario de Archivos Modificados

| Archivo | Tipo de Cambio | Justificación Técnica |
|---|---|---|
| `package.json` | Dependencias | Actualización de `sharp` a `^0.35.5`, `multer` a `^2.5.0` y `@types/multer` a `^2.3.0`. |
| `package-lock.json` | Lockfile | Resolución de dependencias limpias (eliminación de 14 dependencias transitivas obsoletas de multer 1.x; resolución de librerías nativas libvips de sharp 0.35.5). |
| `engines/compose.ts` | Tipado TypeScript | Importación y uso de `import sharp, { type OverlayOptions } from 'sharp'` en lugar del namespace legacy `sharp.OverlayOptions` para compatibilidad estricta con TypeScript 5.6 y definiciones de sharp 0.35.x. |
| `server/index.ts` | Configuración Multer | Endurecimiento del middleware multipart en memoria mediante límites explícitos (`limits: { fileSize: 25 * 1024 * 1024, files: 1, fields: 15 }`), previniendo saturación de memoria por campos o archivos masivos no acotados. |

---

## 3. Versiones Anteriores y Posteriores

| Dependencia | Versión Baseline (`main`) | Versión Remediada (`security/remediation-003`) | Tipo de Dependencia |
|---|---|---|---|
| `sharp` | `0.33.5` | `0.35.5` | Producción directa |
| `multer` | `1.4.5-lts.2` (deprecado) | `2.5.0` (estable oficial) | Producción directa |
| `@types/multer` | `1.4.12` | `2.3.0` | Desarrollo directa |

---

## 4. Justificación Técnica de cada Cambio

1. **Remediación de `sharp` (0.33.5 → 0.35.5):**
   - Corrige las tres vulnerabilidades de severidad Alta reportadas en los componentes binarios nativos:
     - `GHSA-f88m-g3jw-g9cj` (vulnerabilidades en `libvips`: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591).
     - `GHSA-rgj7-g3m4-5g8c` (desbordamientos en `libheif`: GHSA-g89c-p67h-r497 y GHSA-2jg2-4ch7-h545).
     - `GHSA-wq5f-xc86-pv6w` (use-after-free en `librsvg`: CVE-2026-96889).
   - Elimina la totalidad de alertas de seguridad del motor gráfico en `npm audit`.

2. **Remediación de `multer` (1.4.5-lts.2 → 2.5.0):**
   - Elimina el estado deprecado de `multer@1.x` y sus vulnerabilidades heredadas en parsers antiguos (`dicer` y `busboy@0.x`).
   - `multer@2.5.0` utiliza oficialmente `busboy@^1.6.0`, moderno, mantenido y protegido contra ataques ReDoS.
   - Reduce el árbol de dependencias de producción de 131 a 112 paquetes.
   - Preserva exactamente el contrato `req.file.buffer` requerido por todos los controladores de ATELIER (`models/upload`, `products`, `references`, `assets/upload`).

3. **Endurecimiento en `server/index.ts`:**
   - La configuración de `upload` ahora acota explícitamente:
     - `fileSize: 25 * 1024 * 1024` (25 MB por archivo).
     - `files: 1` (rechaza cargas de múltiples archivos simultáneos en endpoints de un solo archivo).
     - `fields: 15` (previene sobrecarga de buffers por envío de campos multipart masivos).

---

## 5. Vulnerabilidades Antes y Después (`npm audit`)

| Estado | Total Vulnerabilidades | Severidad Alta | Severidad Moderada | Paquetes Afectados |
|---|---|---|---|---|
| **Antes (`main`)** | **7** | **4** | **3** | `sharp` (Alta), `zod` (Alta), `@google/genai` (Alta), `vite` (Alta), `esbuild` (Mod.), `uuid` (Mod.), `gaxios` (Mod.) + deprecación de `multer 1.x`. |
| **Después (`remediation-003`)** | **6** | **3** | **3** | `zod` (Alta), `@google/genai` (Alta), `vite` (Alta), `esbuild` (Mod.), `uuid` (Mod.), `gaxios` (Mod.). |

**Delta de Seguridad:**
- `sharp` **0 vulnerabilidades** (Alta resuelta).
- `multer` **0 deprecaciones** (Modernizado a 2.5.0 con `busboy@^1.6.0`).
- No se introdujo ninguna vulnerabilidad nueva.

---

## 6. Resultados Completos de la Batería de Pruebas

Todas las pruebas se ejecutaron sobre la rama `security/remediation-003` en modo `MOCK` aislado (`$env:ATELIER_MOCK="1"`, sin llamadas a proveedores de pago):

| Comando / Script | Código de Salida | Resultado | Evidencia / Observaciones |
|---|---|---|---|
| `npx tsc --noEmit` | `0` | **PASS** | 0 errores de tipado TypeScript tras la adaptación de `OverlayOptions`. |
| `npm run build` (`vite build`) | `0` | **PASS** | `dist/assets/index-DpAU-j-2.js` (212.04 kB) generado en 489 ms. |
| `npm run check:qa` (`scripts/qa-delivery-check.ts`) | `0` | **PASS** | 34 comprobaciones de gates de calidad y entrega HTTP (`409` y `200`) completadas en puerto efímero. |
| `npm run check:variants` (`scripts/variant-reference-check.ts`) | `0` | **PASS** | Los 9 escenarios obligatorios de referencias, variantes, `studio.pose`, invalidación y aislamiento pasaron al 100%. |
| `npm run smoke` (`scripts/smoke.ts`) | `0` | **PASS** | 6 etapas E2E completadas; GateError LOCK_NOT_APPROVED, ASSET_QA_REQUIRED y ASSET_NOT_APPROVED verificados; ZIP exportado (354.6 KB, 6 archivos). |

---

## 7. Comparaciones de Fidelidad Visual y Métricas Ópticas

Se comprobó expresamente que la actualización de `sharp@0.33.5` a `sharp@0.35.5` no alteró ninguna dimensión ni cálculo óptico:

1. **Métricas Ópticas CIE76 $\Delta E$:**
   - En `scripts/smoke.ts`, la comparación colorimétrica entre el blazer de referencia y el render try-on arrojó exactamente $\Delta E = \mathbf{7.14}$, **idéntico al valor obtenido en el baseline original**.
2. **Dimensiones y Resolución:**
   - Composición Haute Couture: exactamente `1500x2250` píxeles.
   - Formatos verificados: PNG (con canal alfa y transparencia), JPEG y WEBP operan con decodificación y re-encapsulamiento íntegros.
3. **Detección de Silueta y Landmarks Anatómicos:**
   - `detectSubjectLandmarks` en `engines/compose.ts` opera con `raw()` y redimensionamiento `120x160`, produciendo posicionamiento simétrico idéntico en las celdas editoriales de la plantilla `hc_3_a`.

---

## 8. Compatibilidad de Ingesta Multipart (`multer 2.5.0`)

1. **Contrato `req.file.buffer`:**
   - Totalmente preservado. Los controladores en `server/index.ts` consumen `req.file.buffer` sin variaciones de interfaz.
2. **Límites de Seguridad Validados:**
   - Tamaño máximo por archivo: 25 MB (`fileSize: 25 * 1024 * 1024`).
   - Límite de archivos por petición: 1 (`files: 1`).
   - Límite de campos: 15 (`fields: 15`).
   - Filtro de tipo MIME: restringido a `image/png`, `image/jpeg` y `image/webp`.
3. **Detección de Contenido Real:**
   - `server/storage.ts` ejecuta `sharp(buf).metadata()` antes de persistir cualquier archivo en disco. Si el búfer no corresponde a una imagen binaria válida (por ejemplo, scripts o ejecutables disfrazados con extensión `.png`), se rechaza de inmediato con `Error: El archivo proporcionado no es una imagen válida`.

---

## 9. Riesgos y Vulnerabilidades Residuales (Etapa C)

Las 6 vulnerabilidades residuales se clasifican según su alcanzabilidad y contexto técnico:

| Paquete | Severidad | Clasificación | Justificación y Estado |
|---|---|---|---|
| `vite` | Alta | `MITIGATED` | Vulnerabilidad circunscrita al servidor de desarrollo local en Windows (`launch-editor`). En producción, Express sirve estáticos de `dist/` sin Vite. Actualizar a Vite 8 rompería `@vitejs/plugin-react@4.x`. |
| `esbuild` | Moderada | `MITIGATED` | Subdependencia de desarrollo de Vite. Inexistente en producción. |
| `zod` | Alta | `MITIGATED` | Vulnerabilidad por colecciones masivas no acotadas. En ATELIER, los esquemas de Zod validan internamente respuestas estructuradas de Gemini / mock, sin exposición directa a payloads arbitrarios de clientes web. |
| `@google/genai` | Alta | `OPEN` | Hereda la vulnerabilidad de `zod`. Requiere una migración mayor planificada a la rama `2.x` del SDK oficial de Google en un sprint de arquitectura dedicado (excluido expresamente del alcance de este checkpoint). |
| `uuid` | Moderada | `NOT_APPLICABLE` | Afecta llamadas a `uuid.v3/v5/v6` con buffer preasignado. ATELIER utiliza `crypto.randomBytes(8)` para generar IDs y `gaxios` sólo invoca `v4()`. |
| `gaxios` | Moderada | `NOT_APPLICABLE` | Dependencia transitiva de `@google/genai` que hereda el advisory de `uuid`. |

---

## 10. Procedimiento de Reversión (Rollback)

Dado que todo el trabajo se realizó en la rama aislada `security/remediation-003` sin alterar `main`, el procedimiento de reversión es inmediato y determinista:

1. **Reversión a nivel de rama:**
   ```bash
   git checkout main
   git branch -D security/remediation-003
   ```
2. **Reversión de dependencias en caso de haber ejecutado `npm install` localmente:**
   ```bash
   git checkout main
   npm ci
   ```
   Esto restaura exactamente el lockfile del baseline `bad10bf1d749f2d7cfd0dd4b496c6de3e789fab2`.

---

## 11. Evidencia de Integridad de `main`

- **Comando:** `git rev-parse main`  
  **Resultado:** `bad10bf1d749f2d7cfd0dd4b496c6de3e789fab2`
- **Comando:** `git rev-parse origin/main`  
  **Resultado:** `bad10bf1d749f2d7cfd0dd4b496c6de3e789fab2`
- **Comando:** `git log -n 1 main --oneline`  
  **Resultado:** `bad10bf Initial commit: ATELIER platform with garment & variant provenance (001)`
- **Diferencia con remoto:** `0 commits ahead, 0 commits behind` en `main`.

---

## 12. Decisión y Recomendación Final

**`REMEDIATION_ACCEPTED`**

**Fundamento:**
- Las vulnerabilidades objetivo de `sharp` (libvips, libheif, librsvg) y los riesgos de deprecación/seguridad de `multer` fueron resueltos en su totalidad sin introducir incompatibilidades.
- Todas las pruebas de compilación (`tsc`, `build`) y pruebas funcionales/de seguridad (`smoke`, `check:qa`, `check:variants`) pasaron con código `0`.
- Se demostró identidad matemática en las métricas ópticas ($\Delta E = 7.14$).
- La rama `main` permanece intacta.

**Próximo paso sugerido:**
Revisar este informe técnico. Si se aprueba, proceder a la autorización para integrar `security/remediation-003` en `main` mediante un Pull Request o merge fast-forward limpio.

