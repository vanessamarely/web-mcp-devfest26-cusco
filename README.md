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

```bash
npm install
npm run dev:slides   # http://localhost:5173/?presenter&local  ·  /live/?local
npm run dev:demo     # http://localhost:5174
npm run clips        # regraba los videos (con la demo corriendo)
npm test
```

Las respuestas del podio viven en `slides/answers.json` (no versionado). En ensayo local se cargan solas; en vivo: menú → **Cargar respuestas del podio**.

Firebase (opcional): copia `.env.example` a `slides/.env.local`, habilita Auth anónima + GitHub y despliega con `npm run deploy`.
