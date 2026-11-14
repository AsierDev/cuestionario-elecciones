# Brújula de voto 29N — Constitución para agentes

## Qué es

Web estática, solo cliente (Vite + TypeScript sin framework, zod, Vitest), que compara las
respuestas del usuario a 30 propuestas con las posiciones documentadas de los partidos que
concurren a las elecciones generales del 29-N-2026. Se publica en GitHub Pages. La descripción
completa para personas está en `README.md`.

## Invariantes

- **Sin backend ni red**: el sitio no hace peticiones ni carga recursos de terceros. Las
  respuestas solo se guardan en `localStorage` del navegador (`src/ui/persistence.ts`).
- **El contenido es dato**: temas, partidos, territorios, preguntas y posiciones viven en
  `/data` y solo se leen a través de `src/data/load.ts`. `src/` no contiene ids de partidos ni
  temas como literales (lo comprueba `tests/data/no-hardcode.test.ts`).
- **Capas**: `src/core/` es puro y sin DOM; `src/ui/` renderiza con `textContent`.
- **Neutralidad**: partidos en orden alfabético en toda la interfaz salvo el ranking de
  resultados (afinidad descendente, desempate alfabético); sin colores ni logos de partido;
  ningún texto del cuestionario nombra partidos ni personas; cada propuesta plantea una sola
  medida.
- **Contrato de posiciones** (validado en `src/data/schema.ts`):
  - `value === null` ⇔ `status === "sin-datos-suficientes"` ⇔ `sourceType === "sin-datos"`.
  - Con valor: `verificado` si `sourceType === "programa-2026"` o `sourceDate >= 2026-01-01`;
    si no, `provisional`. Una búsqueda negativa nunca es `verificado`.
  - Nunca se rellena una posición «por simetría» ni se estima: sin fuente sostenible, `null`.
  - Wikipedia nunca es cita final. No se reproducen extractos extensos de programas.
- Al cambiar contenido de `/data`, actualiza `data/meta.json` (`updatedAt`, `dataVersion`,
  `notes`) y la sección «Estado de los datos» de `README.md`.
- **Rutas relativas**: `base: './'` en `vite.config.ts`; `npm run check:dist` falla con rutas
  absolutas.
- **Git**: commits convencionales en español con ámbito (`feat(datos): …`, `fix(resultados): …`).
  Cada push a `main` despliega en producción, así que antes de hacer push debe pasar todo lo que
  ejecuta CI. No hagas commit ni push salvo que el usuario lo pida.
- Las salidas del flujo RPI van en `.opencode/work/<tarea>/` (ignorado por git).

## Comandos

Node ≥22 (`.nvmrc`), npm.

| Tarea | Comando |
|---|---|
| Instalar | `npm ci` |
| Servidor de desarrollo | `npm run dev` |
| Tests (todo / por área) | `npm test` · `npm run test:data` · `test:core` · `test:ui` |
| Lint / tipos | `npm run lint` · `npm run typecheck` |
| Validar `/data` | `npm run validate:data` |
| Cobertura de posiciones | `npm run coverage:data` |
| Build + comprobar artefacto | `npm run build && npm run check:dist` |

CI (`.github/workflows/deploy.yml`) ejecuta lint, test, validate:data, build y check:dist.

## Brain protocol

La base de conocimiento de este repo empieza en `docs/README.md`. Síguelo antes de actuar:

1. **Antes de responder una pregunta o cambiar código**, lee `docs/README.md` y abre solo los
   documentos listados para el área que vas a tocar. Este proyecto no tiene backend ni servicios
   externos: los únicos «contratos» son el esquema de `src/data/schema.ts` y los JSON de `/data`.
   Nunca infieras un campo, fuente o posición que no esté en una fuente.
   - **Las tareas triviales se saltan el índice**: erratas, formato o un cambio de una línea en
     un área cuya regla ya está cargada.
   - **Subagentes delegados**: si tu encargo lista documentos del brain, lee solo esos; abre el
     índice solo si no bastan.
   - **Los documentos grandes se buscan, no se leen**: los marcados `historical` o como solo
     búsqueda se consultan buscando la ruta o el término que necesitas, nunca enteros.
2. **Cita lo que usaste**: nombra los documentos o ficheros fuente en los que se apoya tu
   respuesta o plan.
3. **Si el código y la documentación no coinciden, detente.** Informa del conflicto con evidencia
   (documento `ruta:línea` frente a código `ruta:línea`), di qué lado crees correcto y por qué, y
   **espera confirmación humana antes de cambiar el código o el documento.**
4. **Definición de terminado**: si tu cambio altera el contrato de datos, la arquitectura, una
   dependencia, una regla o un comportamiento documentado, actualiza el documento
   correspondiente (o añade un ADR) en el mismo cambio. Si cambiaron las `sources` de un
   documento y sigue siendo correcto, actualiza su `last_verified`. Antes de dar la tarea por
   terminada, hacer commit o abrir un PR, pregúntate: *¿qué necesita saber la próxima tarea que
   aún no esté en el brain?* Propón la actualización o indica que no hay ninguna.
5. **El conocimiento nuevo va al índice**: un documento, regla o skill nuevo no está terminado
   hasta que aparece en `docs/README.md` (y pasa
   `npm run lint && npm test && npm run validate:data`).
6. **La información que falta es una pregunta, no una suposición**: si ni el brain ni las
   fuentes lo responden, pregunta.

## Router de tareas

| Si vas a… | Lee | Valida con |
|---|---|---|
| Añadir o recodificar posiciones de un partido | `README.md` § «Cómo actualizar posiciones» y § «Política de fuentes y estados» | `npm run validate:data && npm run coverage:data && npm test` |
| Añadir un partido, tema, territorio o propuesta | `README.md` § «Modelo de datos», `src/data/schema.ts`, ADR 0002 | `npm run validate:data && npm test` |
| Redactar o editar propuestas y fichas | `README.md` § «Principios de neutralidad» (en Política de fuentes) | `npm run test:data` |
| Tocar el scoring o los umbrales | `README.md` § «Metodología», `src/core/config.ts`, `src/ui/methodology.ts` | `npm run test:core` |
| Tocar la interfaz | `src/ui/`, `README.md` § introducción (flujo) | `npm run test:ui` y revisión en `npm run dev` |
| Cambiar build, CI o despliegue | `README.md` § «Despliegue en GitHub Pages», ADR 0001 | `npm run build && npm run check:dist` |
| Cambiar la arquitectura o añadir una dependencia | `docs/decisions/` | ADR nuevo |
| Añadir un documento, regla o ADR | `docs/conventions/knowledge-lifecycle.md` | Listado en `docs/README.md` |

## Mapa del brain

| Necesidad | Dónde |
|---|---|
| Índice de toda la documentación | `docs/README.md` |
| Producto, datos, fuentes, metodología, despliegue | `README.md` |
| Por qué se decidió algo | `docs/decisions/` |
| Cómo se mantiene la base de conocimiento | `docs/conventions/knowledge-lifecycle.md` |
