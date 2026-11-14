# 0002 — Contenido como datos auditables en JSON con contrato zod

- **Estado:** aceptada (registrada a posteriori el 2026-11-14)
- **Fecha:** 2026-10-05
- **Contexto:** Las posiciones de los partidos cambian durante la campaña (programas 2026,
  coaliciones, votaciones) y cada una debe poder auditarse sin leer código.
- **Decisión:** Todo el contenido (territorios, partidos, temas, propuestas, posiciones y meta)
  vive en `/data` como JSON. `src/data/schema.ts` define el contrato con zod (incluidas las reglas
  valor/estado/fuente) y `src/data/load.ts` es la única puerta de acceso. Cada posición guarda
  `sourceType`, `sourceUrl`, `sourceDate`, `status` y `note`. `src/` no contiene ids de contenido.
- **Consecuencias:** Actualizar posiciones no toca la lógica: se editan JSON y se valida con
  `npm run validate:data` y `npm test` (contrato, cobertura mínima, neutralidad y no-hardcode).
  La jerarquía de fuentes está en `README.md` § «Política de fuentes y estados».
- **Alternativas:** No constan en el repositorio.
