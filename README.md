# Buscador de afinidad de voto — Elecciones Generales 29-NOV-2026

Web estática, solo cliente y sin backend que ayuda a cualquier persona a ver **qué partido
español se ajusta más a sus posiciones** de cara a las elecciones generales del
**29 de noviembre de 2026**.

El flujo es: elegir comunidad autónoma y hasta 5 temas prioritarios opcionales ponderados ×1,5 →
responder 25 preguntas neutrales (de opción única o múltiple) → ver, por cada pregunta, el
partido votable en tu territorio más afín, y al final el **% de afinidad** por partido
aplicable, la **cobertura de datos**, los **temas sin datos suficientes**, los **enlaces a los
programas**, la **última actualización** y la **metodología**.

Todo el contenido (temas, partidos, territorios, preguntas y posiciones) vive en `/data` y es
auditable: cada posición guarda fuente, fecha, tipo y estado. Actualizar posiciones **no
requiere tocar la lógica**: se editan los JSON de `/data` y se vuelve a publicar.

## Requisitos

- **Node ≥22** (probado con Node 22.21.0 y npm 10.9.4). El proyecto es ESM (`"type": "module"`).
- No hay dependencias de runtime externas: el sitio no hace peticiones de red ni usa recursos
  de terceros (privacidad).

## Puesta en marcha

```bash
npm ci          # instalación reproducible
npm run dev     # servidor de desarrollo
npm run build   # typecheck + build de producción en dist/
npm run preview # sirve dist/ localmente
```

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo de Vite. |
| `npm run build` | `tsc --noEmit` + `vite build` → `dist/`. |
| `npm run preview` | Sirve el artefacto `dist/` para revisión local. |
| `npm run typecheck` | TypeScript estricto sin emitir. |
| `npm test` | Toda la suite de Vitest. |
| `npm run test:watch` | Vitest en modo vigilancia. |
| `npm run test:data` | Tests del contrato y los ficheros de `/data`. |
| `npm run test:core` | Tests del motor de scoring. |
| `npm run test:ui` | Tests de la UI (happy-dom). |
| `npm run lint` | ESLint. |
| `npm run validate:data` | Valida `/data` contra el esquema zod, referencias cruzadas y matriz 11×25. |
| `npm run coverage:data` | Informe de cobertura de posiciones por partido y global. |
| `npm run check:dist` | Verifica que `dist/index.html` usa rutas relativas y que sus assets existen. |

## Cómo actualizar posiciones (sin tocar la lógica)

Toda la información de partidos y temas es dato editable en `/data`. Para cambiar o añadir una
posición:

1. **Edita el JSON del partido** en `data/positions/<partido>.json`. Cada fila tiene:
   `topicId`, `value` (número en `[-1, 1]` o `null`), `status`, `sourceType`, `sourceUrl`,
   `sourceDate` (ISO `YYYY-MM-DD`) y, opcionalmente, `note` (paráfrasis breve con atribución).
   Si necesitas un partido o tema nuevo, edita también `data/parties.json` o `data/topics.json`
   (y la pregunta correspondiente en `data/questions.json`).
2. **Valida el contrato**: `npm run validate:data`
   (esquema, campos obligatorios por posición, referencias cruzadas y matriz completa 11×25).
3. **Revisa la cobertura**: `npm run coverage:data`
   (los tests exigen ≥70% global y ≥50% por partido con estado `verificado` o `provisional`).
4. **Pasa la suite completa**: `npm test`
   (incluye contrato, integración territorial, motor y el test que garantiza que `src/` no
   contiene ids de partidos ni temas).
5. **Commit y push a `main`**: el workflow de GitHub Actions ejecuta
   lint + tests + validación + build y **despliega automáticamente**.

Reglas del contrato que debes respetar al editar:

- `value === null` ⇔ `status === "sin-datos-suficientes"` ⇔ `sourceType === "sin-datos"`.
- Con `value` no nulo: `status` es `"verificado"` si `sourceType === "programa-2026"` o
  `sourceDate >= 2026-01-01`; en cualquier otro caso, `"provisional"`.
- Una **búsqueda negativa** (no se encontró posición) usa `value: null`,
  `sourceType: "sin-datos"` y documenta en `sourceUrl` el índice oficial consultado, con
  `sourceDate` igual a la fecha de consulta. Aunque sea de 2026, **nunca** se marca `verificado`.
- Actualiza `data/meta.json` (`updatedAt`, `dataVersion`, `notes`) cuando cambies contenido.

### Modelo de datos

```
data/territories.json            [{ id, name }]                                 // 19 territorios
data/parties.json                [{ id, displayName, scope, communities?,       // 11 partidos
                                     websiteUrl, programUrl, programYear, identityNote? }]
data/topics.json                 [{ id, name, block, evidence[] }]              // 25 temas
data/questions.json              [{ id, topicId, text, type, axisNote?, options[] }] // 25 preguntas
data/positions/<partyId>.json    [{ topicId, value, status, sourceType,         // 25 por partido
                                     sourceUrl, sourceDate, note? }]
data/meta.json                   { updatedAt, dataVersion, notes? }
```

Código:

```
src/data/    esquema zod + loader (única puerta de acceso a los datos)
src/core/    motor de scoring puro, sin DOM
src/ui/      render DOM con textContent
scripts/     validación, seed, cobertura y check de build
tests/       data/, core/, ui/ y scripts/
```

## Política de fuentes y estados

Jerarquía de fuentes por posición:

1. **Programa electoral 2026** (si existe) → `verificado` o `provisional` según fecha/tipo.
2. **Programa de generales 2023** → `provisional`.
3. **Posición oficial reciente** (votaciones nominales, declaraciones oficiales contrastadas) →
   `provisional`.

El comparador de programas 23J de RTVE se usa como secundaria trazable. **Wikipedia nunca se
usa como cita final.** Cada fila sin datos documenta el índice oficial consultado (búsqueda
negativa) y su fecha de consulta.

Estados por posición:

- **`verificado`**: respaldo del ciclo 2026 (`programa-2026` o fuente con fecha ≥ 2026-01-01).
- **`provisional`**: con dato, pero de evidencia anterior (programa 2023, declaración o
  votación).
- **`sin-datos-suficientes`**: no se localizó una posición sostenible; se muestra la búsqueda
  realizada, sin inventar ni rellenar "por simetría".

Principios de neutralidad:

- Los partidos se listan en **orden alfabético** en toda la interfaz, **excepto el ranking de
  resultados**, que va por afinidad descendente con desempate alfabético (excepción documentada
  en la metodología).
- Sin color ni logo de partido como identidad; sin nombres de partidos en los enunciados de las
  preguntas.
- Los temas se justifican con evidencia (CIS Estudio 3577 para el Bloque A; agenda/programa
  para el Bloque B) y el posible sesgo percibido de la fuente CIS se declara en la metodología.

## Metodología (resumen)

- Posición del usuario: `single` → valor de la opción; `multi` → media de los valores elegidos;
  pregunta omitida → no puntúa.
- Afinidad por pregunta: `1 − |u − p| / 2` ∈ [0,1] (distancia máxima del eje = 2).
- Peso: `1,5` si el tema se marcó prioritario (hasta 5, elegidos en el paso inicial), `1,0` si no.
- Afinidad por partido: `Σ(peso × afinidad) / Σ(peso)` sobre los temas puntuables.
- Cobertura: `Σpeso(puntuables) / Σpeso(respondidos)`.
- Filtrado territorial: los partidos no aplicables en la comunidad elegida no se puntúan.
- Datos faltantes: se excluyen del cálculo y reducen la cobertura; sin cobertura → "Sin datos
  suficientes", sin porcentaje.
- Ranking principal: solo partidos con comparación suficiente (≥10 preguntas comparadas y ≥60 %
  de cobertura ponderada); el resto va bajo «Cobertura insuficiente». Con menos de 10 respuestas
  se avisa de comparación parcial y no se muestra ranking.
- Sin respuestas: la afinidad y la cobertura quedan vacías (nunca `0/0` ni `NaN`).

Esta herramienta **no es una predicción electoral** ni una estimación de intención de voto.

## Despliegue en GitHub Pages

El repositorio incluye el workflow `.github/workflows/deploy.yml` (build con Node 22,
`npm ci`, lint, tests, validación de datos, build y `check:dist`, y despliegue con
`actions/deploy-pages`). CI ejecuta lint + tests + validación **antes** de publicar.

Pasos para el propietario (crear el repositorio remoto y habilitar Pages no los hace el
workflow):

1. Crea el repositorio en GitHub y añade el remoto:
   `git remote add origin git@github.com:<owner>/<repo>.git` y `git push -u origin main`.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada push a `main` (o un `workflow_dispatch` manual) compila y publica. La URL será
   `https://<owner>.github.io/<repo>/`.

El **base path** de un *project site* (publicar en un subdirectorio `/<repo>/`) está resuelto
con `base: './'` en `vite.config.ts`, que genera rutas relativas; `npm run check:dist` falla si
aparece una referencia absoluta (`href="/` o `src="/`). Prueba local del subdirectorio:

```bash
TMP_DIR=$(mktemp -d) && mkdir -p "$TMP_DIR/sub" && cp -R dist/. "$TMP_DIR/sub/" \
  && (cd "$TMP_DIR" && python3 -m http.server 4173)
# abrir http://localhost:4173/sub/
```

No hay secretos, backend ni datos personales.

## Límites y licencias

- **GitHub Pages**: límite de tamaño de sitio ≈ **1 GB** y de ancho de banda ≈ **100 GB/mes**;
  HTTPS gratuito. El proyecto es solo estático, sin backend.
- **CIS (Estudio 3577)**: se cita la fuente con URL y fecha y se respetan sus condiciones de
  reutilización de datos; se declara el sesgo percibido de la fuente institucional.
- **Programas y marcas de partidos**: los textos son material con copyright; se **cita y
  enlaza** al documento original, **sin reproducir extractos extensos** ni usar logos o marcas.
- **Wikipedia**: no se usa como cita final.

Los programas de 2026 pueden no estar publicados durante la campaña; en ese caso las posiciones
se apoyan en 2023/declaraciones/votaciones y se marcan como `provisional` con aviso visible.

## Estado de los datos

- `dataVersion`: `0.3.1` · `updatedAt`: `2026-10-05`.
- Cobertura global de posiciones: **233/275 (84,7%)**; mínima por partido, Coalición Canaria
  (17/25, 68,0%).
