# TODO — propuestas pendientes

> Dos cosas abiertas tras la ronda 1 de pulido. Este documento es una **propuesta**, no un plan aprobado: hay que decidir alcance y secuencia antes de arrancar.
>
> Última actualización: 2026-10-06.

---

## 1. Mejorar los textos (claridad de resultados)

**Problema:** el dato es correcto pero la interfaz no se explica sola. Hechos comprobados con la app real:

- `Cobertura: 89,1 % · Comparadas: 22 de 25 preguntas` — no dice que la media se apoya solo en esas 22 respuestas ni que la cobertura esté ponderada por prioridades.
- `Temas sin datos: Seguridad ciudadana, …` — suena a «no sabemos nada», cuando en realidad es «este partido no tiene posición documentada en ese tema».
- `Más afín: BNG, Podemos, Sumar — 95,0 % de cercanía en esta pregunta` — no deja claro que son esos tres los de más afinidad, ni que el 95 % sea cercanía en la escala y no un % de acuerdo ni de programa.

**Propuesta (copy puro, sin tocar cálculo):**

| Texto actual | Propuesta |
| --- | --- |
| `Cobertura: 89,1 % · Comparadas: 22 de 25 preguntas` | `Se compara en 22 de tus 25 respuestas (89,1 % del peso)` |
| `Temas sin datos: …` | `Sin posición documentada en: …` |
| `95,0 % de cercanía en esta pregunta` | `Coincide al 95,0 % con tu respuesta` |

Añadir una línea de ayuda bajo «Ranking por afinidad»:

> La afinidad solo usa las respuestas donde el partido tiene posición documentada; la cobertura indica cuánta de tu cuestionario entra en ese cálculo. No multiplica afinidad por cobertura.

**Detalle a corregir:** `Comparadas: N de 25` usa el total del cuestionario, mientras que la cobertura se calcula sobre las respuestas dadas. Si alguien omite preguntas, los dos números dejan de ser comparables. Unificar el denominador.

**Fuente:** conversación de 2026-10-06; las tres frases son las propuestas por el usuario.

**Alcance:** `src/ui/results.ts`, `src/ui/methodology.ts`, `src/styles/base.css`, `README.md`, tests de copy. Sin cambios en `src/core/scoring.ts`.

---

## 2. Mejorar las preguntas y respuestas (rediseño metodológico — «ronda 2»)

**Problema:** 17 de 25 preguntas tienen 3 opciones y muchas combinan varias medidas en una misma opción. Problemas detectados en el repaso externo:

- Dos decisiones en una opción (ej. «intervenir precios **y** cerrar nuclear»).
- Medidas compatibles presentadas como alternativas (transparencia, penas, simplificación).
- Referencias vagas («mantener el equilibrio actual», «ajustes moderados»).
- Conceptos sin explicar (conciertos, cotizaciones, ratios).
- Multiselección que promedia: elegir −1 y +1 da 0, lo mismo que elegir «mantener actuales», aunque no lo hayas elegido.

**Propuesta:** un patrón para todo el catálogo:

- **Una propuesta concreta por pregunta** + respuestas de acuerdo/desacuerdo en escala común.
- **Siempre ≥4 opciones.** Escala sugerida: totalmente en desacuerdo · más bien en desacuerdo · ni de acuerdo ni en desacuerdo · más bien de acuerdo · totalmente de acuerdo · no tengo opinión formada.
- La opción intermedia participa en el cálculo; «no sé / omitir» no.
- **Eliminar las multiselecciones puntuables** (reservarlas para prioridades).
- Revisar solapamientos: inmigración↔Marruecos, calidad del empleo↔paro↔economía, corrupción↔calidad democrática, medio ambiente↔energía.

**Orden de trabajo propuesto (por el repaso):**

1. Elegir **una decisión concreta por tema**; sustituir los temas donde no haya pregunta útil.
2. Redactar la propuesta y una ayuda breve **sin argumentos a favor ni en contra**.
3. Eliminar las multiselecciones puntuables.
4. Revisar evidencias y **recodificar las 275 posiciones** contra las nuevas propuestas.
5. Versionar preguntas y posiciones juntas.
6. Probarlas con personas que no conozcan el proyecto.

**Por qué no se tocó en la ronda 1:** cambiar el eje invalida los valores actuales (energía, corrupción, etc.). Implica escribir 25 preguntas nuevas **y** recodificar las 275 posiciones de 11 partidos. El usuario decidió separarlo (2026-10-06).

**Fuente:** repaso externo aportado el 2026-10-06 (`.opencode/work/pulido-mvp/INPUT-REVIEW.md`).

---

## Estado actual

| Ronda | Contenido | Estado |
| --- | --- | --- |
| Ronda 1 | Prioridades ×5, etiqueta de afinidad, cobertura/comparabilidad, comunicación | ✅ Terminada y aprobada (`f9c7e36`…`63913c8`) |
| — | Textos de resultados | ❌ Propuesta pendiente (arriba) |
| Ronda 2 | Preguntas/respuestas + recodificación de posiciones | ❌ Propuesta pendiente (arriba) |

Resto del repaso externo **fuera de alcance** por ahora: «verificado» vs reciente, alcance territorial (provincia vs comunidad), verificación de fuentes CIS.
