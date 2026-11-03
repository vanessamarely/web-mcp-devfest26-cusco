# WebMCP en acción

Charla técnica para **DevFest Cusco 2026** (30 min) de [Vanessa Aristizabal](https://github.com/vanessamarely). Qué es MCP, qué es WebMCP y cómo hacer, de verdad, una web agéntica.

## En vivo

| Qué | URL |
|---|---|
| Deck (proyector) | https://webmcp-cusco-slides.web.app/?presenter=1 |
| App de asistentes (QR) | https://webmcp-cusco-slides.web.app/live/ |
| Consola de la presentadora | https://webmcp-cusco-slides.web.app/presenter/ |
| Demo Ruta Chasqui | https://webmcp-cusco-demo.web.app |

Proyecto Firebase: `webmcp-cusco` (Hosting x2 + Firestore con [reglas](firestore.rules)). Para que los celulares se sincronicen hay que activar en la consola **Authentication → Anónimo** y, para presentar, **GitHub** (redirect `https://webmcp-cusco.firebaseapp.com/__/auth/handler`).

| Carpeta | Qué es |
|---|---|
| [`slides/`](slides) | Deck (32 slides) con proporciones **4:3 · 16:10 · 16:9 · 21:9 · extendida** (tecla **A**/**E**), claro/oscuro (**L**), alto contraste (**H**). Consola en `/presenter/` (**P**). App de asistentes en `/live/`: apodos únicos para 300+ personas (con numeración si se repiten), 3 preguntas por el podio, **crea tu chasqui** (PNG), notas y memoria en **PDF / HTML / Markdown**. |
| [`demo/`](demo) | **Ruta Chasqui**: marketplace de experiencias en Cusco (precios ficticios) con 8 tools de WebMCP (1 declarativa). Agente con WebMCP (Gemini Nano o simulado) vs. agente de clics, botón **Rediseñar** y seguridad (`untrustedContentHint`, `consequentialHint`). |
| [`scripts/record-clips.mjs`](scripts/record-clips.mjs) | Graba los clips de la demo que se muestran en los slides. |
| [`docs/`](docs) | Cambios de WebMCP respecto a charlas anteriores. |
| [`skills/webmcp-agentic-web/`](skills/webmcp-agentic-web) | **Skill para tu agente de código**: vuelve agéntica tu web con WebMCP (intenciones → tools, las 10 reglas, seguridad, migración desde la API vieja). |

## Interacción con el público

| Qué | Cómo funciona |
|---|---|
| **Unirse** | QR grande en el slide 2 y un QR pequeño “Únete” abajo a la izquierda en cada slide (tecla **J** lo oculta). Apodo cusqueño único; si se repite, se numera. |
| **Podio** | 3 preguntas: 500 por acierto + hasta 500 por rapidez (hora del servidor). Bonos con tope (máx. 400): +100 por entrar antes del capítulo 01, +100 por publicar tu chasqui, +100 por una pregunta sobre el tema, +10 por reacción (máx. +100). Para entrar al podio hay que acertar al menos una. Los 3 primeros ven “¡Entraste al podio!” con su lugar y un código para reclamar el premio. |
| **Muro de chasquis** | Tarjetas grandes con pocos chasquis; mosaico que cabe completo + chasqui destacado que rota con la sala llena (probado con 300). |
| **Reacciones con efecto** | Si la sala manda muchas iguales en pocos segundos: 🔥 un chasqui cruza corriendo, 🤯 vuela el cóndor, ❤️ aparece el Inti. Ensayo: `deckBurst('fire')` en la consola del deck. |
| **Preguntas** | Solo sobre el tema (se elige un tema y un filtro revisa el texto antes de enviarlo). No se proyectan; la presentadora las ve con **Q**. |
| **Memoria** | En el último slide cada persona descarga PDF, HTML o Markdown con el resumen, sus notas y su chasqui (las notas nunca salen del celular). |

### Antes de la charla
1. Abre el deck con `?presenter=1` → menú → **Presentar en vivo (GitHub)** → aparece **EN VIVO**.
2. Menú → **Vaciar sesión en vivo…** si quedaron datos de ensayo → **Cargar respuestas del podio…** (`slides/answers.json`, no versionado).
3. Para ensayar usa `?session=ensayo1`: no toca la sesión real. No avances al capítulo 01 en la sesión real antes de empezar (cierra el bono “llegar a tiempo”).
4. Demo con WebMCP nativo: registra un token de [Origin Trial](https://developer.chrome.com/origintrials) para `webmcp-cusco-demo.web.app` y pégalo en `demo/index.html`. Sin token, la demo usa un polyfill fiel a la API actual.

## Skill para tu agente de código

La skill [`webmcp-agentic-web`](skills/webmcp-agentic-web/SKILL.md) convierte la charla en una guía que tu agente (Claude Code, Gemini CLI, Antigravity, Cursor…) aplica en tu proyecto: identifica las intenciones de tu app, crea las tools (formularios declarativos y `registerTool`), aplica las 10 reglas (validación en código, `consequentialHint`, `untrustedContentHint`) y migra código que use `navigator.modelContext`, `provideContext` o `requestUserInteraction`.

- [`SKILL.md`](skills/webmcp-agentic-web/SKILL.md): flujo de trabajo, 10 reglas, antipatrones y formato de reporte.
- [`references/api.md`](skills/webmcp-agentic-web/references/api.md): API actual con código, agente in-page con Gemini Nano y cómo probar.
- [`references/migration.md`](skills/webmcp-agentic-web/references/migration.md): de la API vieja a la actual.

Instalación en Claude Code (para todos tus proyectos):

```bash
git clone --depth 1 https://github.com/vanessamarely/web-mcp-devfest26-cusco /tmp/wmcp && mkdir -p ~/.claude/skills && cp -R /tmp/wmcp/skills/webmcp-agentic-web ~/.claude/skills/
```

Para un solo proyecto, copia la carpeta en `.claude/skills/` del proyecto.

```bash
npm install
npm run dev:slides   # http://localhost:5173/?presenter&local  ·  /live/?local
npm run dev:demo     # http://localhost:5174
npm run clips        # regraba los videos (con la demo corriendo)
npm test
```

Las respuestas del podio viven en `slides/answers.json` (no versionado). En ensayo local se cargan solas; en vivo: menú → **Cargar respuestas del podio**.

Firebase (opcional): copia `.env.example` a `slides/.env.local`, habilita Auth anónima + GitHub y despliega con `npm run deploy`.
