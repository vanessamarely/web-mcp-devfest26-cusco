# WebMCP API (current W3C draft · Chrome docs)

Entry point: **`document.modelContext`** (secure contexts only).

## Imperative: registerTool

```js
const controller = new AbortController();

await document.modelContext.registerTool(
  {
    name: 'add_to_route',
    description: 'Adds a catalog experience to the user route on a given day.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id returned by search_experiences' },
        day: { type: 'integer', minimum: 1, maximum: 7 },
      },
      required: ['id', 'day'],
    },
    annotations: { readOnlyHint: false },
    async execute({ id, day }, { signal }) {
      const r = route.add(id, day); // same service the button uses
      return r.ok ? `Added ${r.name} on day ${day}` : `Error: ${r.error}`;
    },
  },
  { signal: controller.signal /*, exposedTo: ['https://partner.example'] */ },
);

controller.abort(); // unregisters the tool (in-flight executions are not cancelled)
```

- `registerTool` throws if the name already exists.
- `execute(input, { signal })` receives validated input; use `signal` to cancel long work.
- Annotations: `readOnlyHint`, `untrustedContentHint`, `consequentialHint`, `debugging` (Chrome 156).
- `exposedTo` (secure origins) shares a tool with other origins; cross-origin iframes need `allow="tools"` (Permissions Policy `tools`, default `self`).

## Declarative: forms

```html
<form toolname="search_experiences"
      tooldescription="Searches experiences in Cusco by zone and max price per person">
  <select name="zone" toolparamdescription="Cusco zone">
    <option>Machu Picchu</option><option>Sacred Valley</option>
  </select>
  <input name="max" type="number" toolparamdescription="Max price per person (PEN)">
  <button>Search</button>
</form>
<script>
  form.addEventListener('submit', (e) => {
    if (!e.agentInvoked) return;             // submitted by an agent
    e.preventDefault();
    e.respondWith(search(new FormData(form))); // value returned to the model
  });
</script>
```

- Removing `toolname` or `tooldescription` unregisters the tool.
- `toolautosubmit` submits without waiting for the user; without it the browser fills the form and waits for a human submit.
- CSS: `form:tool-form-active`, `:tool-submit-active` (put them in their own rules: unknown pseudo-classes invalidate a whole selector list).

## Discovery and events (in-page agents, tooling)

```js
const tools = await document.modelContext.getTools(/* { fromOrigins: [...] } */);
const result = await document.modelContext.executeTool(tools[0], { id: 'x', day: 2 }); // input is an object
document.modelContext.addEventListener('toolchange', render);
document.modelContext.addEventListener('toolactivated', (e) => log(e.toolName));
document.modelContext.addEventListener('toolcancel', (e) => log(e.toolName));
```

## In-page agent with Gemini Nano (Prompt API)

Ask the model for a JSON decision with `responseConstraint` and loop: call the tool, feed the
result back (wrap untrusted results as data), stop when it answers. Provide a deterministic
fallback when `LanguageModel.availability()` is not `"available"`.

```js
const session = await LanguageModel.create({
  expectedInputs: [{ type: 'text', languages: ['es'] }],
  expectedOutputs: [{ type: 'text', languages: ['es'] }],
  initialPrompts: [{ role: 'system', content: systemPromptWithTools }],
});
const raw = await session.prompt(userMessage, {
  responseConstraint: { type: 'object', properties: { action: { enum: ['call', 'answer'] }, tool: { type: 'string' }, args: { type: 'object' }, message: { type: 'string' } }, required: ['action'] },
});
```

## Testing

- **Chrome DevTools → Application → WebMCP** (Chrome 149+, with `chrome://flags/#enable-webmcp-testing`): *Available Tools* (what the agent sees, declarative/imperative, invocation counters), *Tool Activity* (status Completed/Canceled/In progress/Error, input and output, filters by tool type and status) and **Run tool** to execute a tool manually; schema mismatches show up in the output.
- **Chrome DevTools MCP** for coding agents: start it with `--categoryExperimentalWebmcp` (`"args": ["chrome-devtools-mcp@latest", "--categoryExperimentalWebmcp"]`) to get `list_webmcp_tools` and `execute_webmcp_tool`.
- **Declarative forms**: without `toolautosubmit`, Chrome fills the form and waits for the user to submit it (the agent's call stays pending until then). Add `toolautosubmit` for safe actions such as search; leave it off when a human should review before submitting.
- **Automated tests**: launch Chrome with `--enable-features=WebMCPTesting` (same as the flag) to test the native API headlessly.

- Model Context Tool Inspector extension (Chrome Web Store, needs a Gemini API key).
- DevTools to debug tools and check how the JSON Schema is parsed.
- A polyfill for browsers without `document.modelContext` must follow the current API (see the demo in this repo: `demo/src/webmcp.ts`).
