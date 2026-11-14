# Ciclo de vida del conocimiento

Cómo se mantiene al día la base de conocimiento de este repositorio. La entrada es `AGENTS.md`
(sección `## Brain protocol`); el índice es `docs/README.md`.

## Dónde va cada cosa

| Contenido | Ubicación |
|---|---|
| Invariantes, comandos, límites, router | `AGENTS.md` (breve) |
| Producto, modelo de datos, fuentes, metodología, despliegue (para personas) | `README.md` |
| Decisiones y sus motivos | `docs/decisions/` |
| Procedimientos largos (si `README.md` se queda corto) | `docs/runbooks/` |
| Dependencias externas (hoy no hay) | `docs/context/system.md` |

Crea un directorio la primera vez que lo necesites, no antes. Todo documento nuevo se añade a
`docs/README.md` en el mismo cambio.

## Añadir un documento

1. Comprueba si un documento existente (incluido `README.md`) debería contenerlo; actualízalo.
2. Escríbelo enfocado (≤ ~2.000 tokens estimados; si no, divídelo).
3. Añade una línea a `docs/README.md`: `- [nombre](ruta) — leer al … · <estado>`.
4. Márcalo `unverified` hasta comprobar sus afirmaciones contra el código.

## Añadir un ADR

Copia `docs/decisions/template.md` a `docs/decisions/NNNN-<slug>.md` con el número siguiente. Los
ADR aceptados son inmutables: se sustituyen con uno nuevo, nunca se editan. Lista el ADR en el
índice.

## Añadir una dependencia

Una dependencia de runtime nueva o un servicio externo contradice el ADR 0001: necesita un ADR
nuevo. Si aparece un servicio externo, crea `docs/context/system.md` con qué es, su fuente de
verdad, dónde se configura (nunca el valor de un secreto), cuándo leerlo y cómo verificarlo.

## Cuándo actualizar la fecha de verificación

Solo tras comprobar las afirmaciones del documento contra el código. Si el código que describe
cambió y el documento sigue siendo correcto, actualiza la fecha en el índice. Si ya no lo es,
corrige el documento o informa del conflicto.

## Conflictos entre documento y código

Detente, registra ambos lados con `ruta:línea`, di cuál crees correcto y por qué, y espera una
decisión humana antes de cambiar ninguno. Los agentes en modo `auto` registran el conflicto y
nunca lo resuelven.

## Cerrar una tarea

Antes de dar una tarea por terminada: *¿qué necesita saber la próxima tarea que aún no esté en el
brain?* Actualiza el documento existente o añade un ADR. Si no hay nada duradero, no escribas
nada.

## Retirar un documento

Márcalo `historical` en el índice (y añade una línea de estado al principio del documento) en
lugar de borrarlo sin avisar. Los documentos históricos se buscan, nunca se leen enteros.
