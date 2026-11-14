# 0001 — Sitio estático con Vite y TypeScript, publicado en GitHub Pages

- **Estado:** aceptada (registrada a posteriori el 2026-11-14)
- **Fecha:** 2026-10-05
- **Contexto:** Una herramienta informativa de afinidad electoral debe ser barata de alojar,
  auditable y respetuosa con la privacidad: las respuestas del usuario no deben salir del
  navegador.
- **Decisión:** Sitio solo cliente con Vite y TypeScript estricto, sin framework de UI (render DOM
  con `textContent` en `src/ui/`), zod como única dependencia de runtime, Vitest (+ happy-dom) y
  ESLint. Se publica en GitHub Pages con `.github/workflows/deploy.yml`, que ejecuta lint, test,
  validate:data, build y check:dist en cada push a `main`. `base: './'` permite servirlo en un
  subdirectorio.
- **Consecuencias:** Sin backend, secretos ni peticiones de red; la persistencia es solo
  `localStorage`. Cada push a `main` es un despliegue a producción. Añadir un framework o una
  dependencia de runtime requiere un ADR nuevo.
- **Alternativas:** No constan en el repositorio.
