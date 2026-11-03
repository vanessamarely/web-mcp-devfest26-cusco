# Qué cambió en WebMCP (borrador W3C 27-oct-2026 y docs de Chrome)

| Charlas anteriores | Ahora |
|---|---|
| `navigator.modelContext` | `document.modelContext` (navigator obsoleto desde Chrome 150) |
| `provideContext()`, `clearContext()`, `unregisterTool()` | `registerTool(tool, { signal })` y `controller.abort()`; nombre repetido → error |
| `execute(input, client)` + `client.requestUserInteraction()` | `execute(input, { signal })` + `annotations.consequentialHint` |
| solo `readOnlyHint` | `readOnlyHint`, `untrustedContentHint`, `consequentialHint`, `debugging` (Chrome 156) |
| `executeTool(tool, '"json"')` | `executeTool(tool, {…})` (texto JSON obsoleto en Chrome 155), `getTools({ fromOrigins })`, `exposedTo` |
| Canary + flag | Origin Trial desde Chrome 149 · flag `chrome://flags/#enable-webmcp-testing` · eventos `toolchange`, `toolactivated`, `toolcancel` en `document.modelContext` |

Repos revisados: webmcp-action (ya usaba `document.modelContext`), webmcp-debugging-pre y web-mcp-debugging (usaban `navigator.modelContext`, `provideContext`, `clearContext`, `requestUserInteraction`), presentacin-interact.

Fuentes: developer.chrome.com/docs/ai/webmcp (imperative-api, declarative-api, best-practices) y webmachinelearning.github.io/webmcp.

## Herramientas nuevas (verificado en Chrome 156)
- **DevTools → Application → WebMCP**: tools disponibles, actividad (estado, entrada, salida), filtros por tipo/estado y **Run tool** para ejecutarlas a mano.
- **Chrome DevTools MCP** con `--categoryExperimentalWebmcp`: `list_webmcp_tools` y `execute_webmcp_tool` para agentes de código.
- **Formularios declarativos**: sin `toolautosubmit` el navegador rellena el formulario y espera a que la persona lo envíe; la demo lo usa en la búsqueda.
- Con `chrome://flags/#enable-webmcp-testing` no hace falta token: el Origin Trial solo sirve para que visitantes sin el flag usen la API nativa.
