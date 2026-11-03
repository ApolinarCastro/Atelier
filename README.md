# ATELIER — plataforma unificada de producción visual

Pipeline de 6 etapas que unifica las 7 apps originales en **una sola**:
`Casting → Intake → Garment Lock → Render → QA → Compose/Entrega`.

## Arranque

```bash
npm install
cp .env.example .env

# Modo MOCK (sin API, para probar el flujo completo)
ATELIER_MOCK=1 npm run dev        # UI http://localhost:5173 · API :8787

# Producción local (UI compilada, un solo puerto)
npm run build && ATELIER_MOCK=1 npm start   # http://localhost:8787

# Modo REAL (Gemini)
GEMINI_API_KEY=tu_key ATELIER_MOCK=0 npm start
```

Prueba del pipeline completo sin UI:

```bash
ATELIER_MOCK=1 npm run smoke
```

## Arquitectura

| Capa | Archivo | Rol |
|---|---|---|
| DB | `server/db.ts` | SQLite (`node:sqlite`), 10 tablas + audit_log |
| Storage | `server/storage.ts` | `data/storage/<project>/<asset>.png` |
| Cola | `server/queue.ts` | jobs secuenciales con costo y estado |
| Gates | `server/gates.ts` | 3 bloqueos obligatorios entre etapas |
| Proveedor | `server/provider.ts` | Gemini real / mock determinista |
| Motores | `engines/*.ts` | casting, intake, lock, render, qa, compose |
| API | `server/index.ts` | REST + estáticos |
| UI | `src/App.tsx` | 6 etapas navegables |

## Los 3 gates

1. `requireApprovedModel` — no hay render sin `model_sheet` aprobado.
2. `requireApprovedLock` — no hay render sin ADN de prenda aprobado.
3. `requireApprovedAsset` — no hay export sin QA PASS + aprobación humana.

## Modelo de datos clave

`assets` es la entidad única: `id, type, stage, parent_asset_id, lock_id, qa_json, approved`.
Toda imagen nace ahí y arrastra procedencia. `jobs` registra modelo usado y costo por llamada.

## Variables

| Var | Default | Uso |
|---|---|---|
| `ATELIER_MOCK` | auto | `1` = sin API |
| `GEMINI_API_KEY` | — | modo real |
| `MODEL_TEXT` | `gemini-2.5-flash` | análisis/QA |
| `MODEL_IMAGE` | `gemini-2.5-flash-image` | renders |
| `PORT` | `8787` | API |

## Estado

- 6 etapas verificadas por smoke test y por HTTP end-to-end (Windows / Linux / macOS).
- 3 Gates activos en motores y endpoints REST (`requireApprovedModel`, `requireApprovedLock`, `requireApprovedAsset` + `requireAssetApprovable`).
- Variantes de color conectadas al motor de render (`tryon`, `views`, `ghost`).
- QA Híbrido: evaluación semántica IA + métricas ópticas deterministas (`sharp`: distancia colorimétrica CIE76 $\Delta E$, nitidez y resolución).
- Exportación empaquetada en archivo `.zip` estándar (PKZIP Deflate) descargable por API (`GET /api/exports/:id/zip`) y UI.
- Endurecimiento de seguridad: protección contra *Path Traversal*, cabeceras HTTP de seguridad, *Rate Limiting* por IP, validación de MIME/imagen y autenticación opcional por token (`ATELIER_API_TOKEN`).


## Cierre QA → aprobación → entrega

**Estado: PASS para los controles de servidor verificados en MOCK.**

La auditoría se confirmó: la aprobación y la entrega admitían renders sin QA, el evaluador suplía controles faltantes y la composición permitía omitir la comprobación. El control ahora exige un PASS completo para try-on, ghost mannequin, vistas y retoques. La evaluación conserva el identificador, el modo y las huellas del candidato, los originales y, donde aplica, la hoja de identidad aprobada. La aprobación manual se registra por separado y queda vinculada al informe y al contenido. Un original incompatible, una copia del candidato, un control incompleto o un atributo no visible impiden la autorización. Las referencias y los artefactos auxiliares siguen su propio flujo.

La descarga individual, la composición y el paquete ZIP usan el control central. Cada composición conserva las huellas de sus componentes y requiere aprobación propia. La carpeta y el ZIP se escriben en preparación y se publican juntos después de verificar la selección. La descarga de un ZIP vuelve a validar su manifiesto y los assets. Los paquetes MOCK se etiquetan y guardan en una carpeta separada. El endpoint de previsualización queda disponible para revisión interna.

### Archivos

- `server/qa-evidence.ts`, `server/gates.ts` y `engines/qa.ts` implementan validación, procedencia, huellas y vigencia.
- `server/db.ts`, `shared/types.ts`, `engines/assets.ts` y `engines/render.ts` registran modo y evidencia de aprobación. `server/provider.ts` devuelve un fixture explícitamente simulado.
- `server/index.ts`, `engines/compose.ts` y `src/App.tsx` aplican las reglas a la entrega y habilitan la aprobación manual de composiciones.
- `scripts/qa-delivery-check.ts` prueba los endpoints en localhost. `scripts/smoke.ts` usa originales válidos y comprueba el flujo actualizado.

### Verificación

- `node --import tsx scripts/qa-delivery-check.ts` pasó en localhost con datos aislados y proveedor MOCK. La aprobación y la exportación directa de un render sin QA respondieron 409 y no crearon una carpeta de entrega. Un PASS sin aprobación también respondió 409. Tras la aprobación manual, la descarga individual, la composición y el ZIP respondieron 200. Al cambiar el original, la descarga de la composición y la del ZIP volvieron a responder 409.
- `npm run smoke` pasó con `ATELIER_MOCK=1` y un directorio de datos aislado. `tsc --noEmit` y `npm run build` pasaron.
- No se ejecutó Gemini real. Los fixtures verifican el contrato y las rutas. La valoración visual de qué detalle muestra un original sigue dependiendo del evaluador, porque el catálogo de referencias carece de una anotación independiente por vista y atributo. No se incorporó un umbral óptico nuevo.

### Datos históricos y recuperación

El arranque añade dos columnas SQLite opcionales. Los registros antiguos conservan sus archivos y estados. Los renders sin procedencia verificable requieren regeneración y una evaluación y aprobación nuevas. Las composiciones y los ZIP históricos sin evidencia requieren regeneración. Las entregas ya copiadas fuera de Atelier quedan fuera del control de la API.

Para revertir el código, restaurar los archivos de una copia previa y conservar las columnas añadidas. Si también se necesita restaurar datos, detener Atelier y recuperar una copia consistente del directorio de datos anterior al cambio. Esta copia de trabajo carecía de metadatos de Git y no se pudo contrastar su estado con un commit.

Pendientes fuera del alcance: ingesta por URL, recuperación de cola, política general de reintentos, video y procesamiento masivo.
