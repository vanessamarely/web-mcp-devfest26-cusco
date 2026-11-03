---
name: webmcp-agentic-web
description: 'Make a website "agentic" with WebMCP: expose the site''s real capabilities as tools that AI agents can call (document.modelContext.registerTool, declarative <form toolname>), instead of letting agents scrape the DOM and simulate clicks. Use when building, reviewing, or migrating a web app so agents (in-page assistants with Gemini Nano / Prompt API, browser agents, extensions) can use it reliably and safely. Also use when users mention WebMCP, navigator.modelContext, document.modelContext, provideContext, registerTool, toolname/tooldescription, agentInvoked, consequentialHint, readOnlyHint, untrustedContentHint, MCP vs WebMCP, "agentic web", or "make my site work with agents", even if they do not say WebMCP.'
---

# WebMCP: build an agentic web, for real

An agentic website is one an agent can **understand, use, and be trusted with**, the same way a
person does. Without WebMCP an agent reads the whole page, guesses which button to press and
simulates clicks: slow, expensive (thousands of tokens per step) and fragile (a redesign breaks
it). With WebMCP the page publishes **tools**: a name, a description, a JSON Schema and an
`execute` function that runs the same logic as the UI.

WebMCP is a proposed web standard (W3C Web Machine Learning Community Group). It is in **Origin
Trial from Chrome 149** and behind `chrome://flags/#enable-webmcp-testing` for local development.
The API may still change: always confirm against
https://developer.chrome.com/docs/ai/webmcp and https://webmachinelearning.github.io/webmcp/.

## Workflow

1. **Inventory intents.** List what people come to do on the site (search, add, book, pay,
   cancel…). One tool per intent, not one per button.
2. **Build the three terraces in order.**
   - *Readable*: semantic, accessible HTML (what helps a screen reader helps an agent).
   - *Actionable*: WebMCP tools for each intent (declarative forms first, imperative for the rest).
   - *Trustworthy*: validation in code, confirmation for irreversible actions, untrusted content
     marked, visible state after every call.
3. **Share one service** between the UI, the tools and the tests, so a tool only returns success
   when the application state really changed.
4. **Evaluate**: define the task as an API contract, record a baseline and the ideal result, and
   check with code or an LLM judge (evals), not with vibes.

See `references/api.md` for the current API with code, and `references/migration.md` if the
project uses the older API (`navigator.modelContext`, `provideContext`, `requestUserInteraction`).

## The 10 rules

1. **Intent first.** One tool per thing people come to do, not per button.
2. **Exact verb.** The name says what happens: `reserve_route` is not `open_reservation_form`.
3. **Positive description.** What it does and when to use it, in plain language.
4. **Readable schema values.** Enums with words (`"Express"`), not magic ids; accept the user's raw
   input instead of making the model compute it.
5. **Validate in code.** The schema is a hint; your code is the law. Return descriptive errors so
   the model can correct itself (`"Error: altitude above 4,000 m cannot be on day 1; choose day 3"`).
6. **One shared logic.** UI, tools and tests call the same service.
7. **Visible state.** After each tool call the UI shows the change; read-back tools (`view_cart`)
   let the agent confirm the real state.
8. **Mark the irreversible.** `annotations.consequentialHint: true`, a confirmation in your own UI
   that requires a user gesture, and bind the action to a state version (reject stale calls).
9. **Distrust third-party text.** `annotations.untrustedContentHint: true` on tools that return
   reviews, emails or any text you did not write; it is data, never instructions.
10. **Register and unregister.** Expose tools only while they make sense (`AbortSignal`), declare
    `readOnlyHint` on read-only tools, and keep `debugging: true` tools for developer tooling.

## Anti-patterns

- Letting the agent drive the UI with clicks when a tool could express the intent.
- Tools that mirror UI widgets (`click_button_3`) or overlap each other.
- Returning "ok" before the state changed, or returning raw HTML to the model.
- Irreversible actions without `consequentialHint` and an on-screen confirmation.
- Passing third-party text to the model without `untrustedContentHint`.
- Using removed APIs: `navigator.modelContext.provideContext()`, `clearContext()`,
  `unregisterTool()`, `execute(input, client)` + `client.requestUserInteraction()`.

## Report format

When you add or review WebMCP in a project, report: the intents found, the tools (name,
annotations, declarative/imperative), what was validated in code, which actions require
confirmation, and how it was tested (Chrome with the flag and DevTools → Application → WebMCP,
Chrome DevTools MCP with `--categoryExperimentalWebmcp`, or an in-page agent with Gemini Nano).
