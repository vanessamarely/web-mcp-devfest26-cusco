# Migrating from the early WebMCP API

| Old (early 2026 talks, demos and polyfills) | Current |
|---|---|
| `navigator.modelContext` | `document.modelContext` |
| `provideContext({ tools })` (replaced the whole list) | `registerTool(tool, { signal })` per tool |
| `clearContext()` / `unregisterTool(name)` | `controller.abort()` on the signal passed at registration |
| `execute(input, client)` + `client.requestUserInteraction(cb)` | `execute(input, { signal })` + `annotations.consequentialHint` + your own confirmation UI |
| only `readOnlyHint` | `readOnlyHint`, `untrustedContentHint`, `consequentialHint`, `debugging` |
| `executeTool(tool, '{"json": "text"}')` | `executeTool(tool, { ... })` with an object |
| `window.ontoolactivated` / `ontoolcancel` | listeners on `document.modelContext` (`toolactivated`, `toolcancel`, `toolchange`) |
| Canary + flag only | Origin Trial from Chrome 149, flag `#enable-webmcp-testing` for local dev |

Steps:
1. Replace every `navigator.modelContext` reference.
2. Turn each `provideContext` list into individual `registerTool` calls sharing one `AbortController`
   per group; abort to remove them.
3. Move confirmation out of `requestUserInteraction`: mark the tool `consequentialHint: true`,
   show a dialog in your UI, and verify a state version before committing.
4. Pass objects (not JSON strings) to `executeTool`.
5. Re-test with the flag or the Origin Trial and with the Model Context Tool Inspector.
