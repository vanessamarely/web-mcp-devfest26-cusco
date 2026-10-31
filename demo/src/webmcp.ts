// WebMCP: usa document.modelContext NATIVO si el navegador lo trae (Origin Trial en Chrome 149+
// o chrome://flags/#enable-webmcp-testing). Si no, instala un polyfill fiel a la API actual
// (borrador W3C del 27-oct-2026):
//   registerTool(tool, { signal, exposedTo }) · getTools() · executeTool(tool, input, { signal })
//   eventos toolchange · toolactivated · toolcancel · formularios con toolname/tooldescription.
// Lo que YA NO existe y por eso no se implementa: provideContext(), clearContext(),
// unregisterTool() y execute(input, client) con client.requestUserInteraction().

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
  consequentialHint?: boolean;
  debugging?: boolean;
}
export type JSONSchema = { type?: string; properties?: Record<string, JSONSchema & { description?: string; enum?: unknown[] }>; required?: string[]; description?: string; enum?: unknown[]; minimum?: number; maximum?: number };
export interface ModelContextTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: JSONSchema;
  annotations?: ToolAnnotations;
  execute: (input: Record<string, unknown>, opts: { signal?: AbortSignal }) => unknown | Promise<unknown>;
}
export interface RegisteredTool {
  name: string;
  title: string;
  description: string;
  inputSchema?: JSONSchema;
  annotations?: ToolAnnotations;
  origin: string;
}
export interface ModelContext extends EventTarget {
  registerTool(tool: ModelContextTool, opts?: { signal?: AbortSignal; exposedTo?: string[] }): Promise<void>;
  getTools(opts?: { fromOrigins?: string[] }): Promise<RegisteredTool[]>;
  executeTool(tool: RegisteredTool, input?: Record<string, unknown>, opts?: { signal?: AbortSignal }): Promise<unknown>;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
  interface SubmitEvent {
    agentInvoked?: boolean;
    respondWith?: (p: Promise<unknown>) => void;
  }
}

/** Validación ligera del schema (el navegador real también valida; nuestro código valida de nuevo). */
export function validate(schema: JSONSchema | undefined, input: Record<string, unknown>): string | null {
  if (!schema || schema.type !== 'object') return null;
  for (const k of schema.required ?? []) if (input[k] === undefined || input[k] === '') return `Falta el parámetro obligatorio "${k}".`;
  for (const [k, v] of Object.entries(input)) {
    const p = schema.properties?.[k];
    if (!p) continue;
    if (p.type === 'integer' && !Number.isInteger(v)) return `"${k}" debe ser un número entero.`;
    if (p.type === 'number' && typeof v !== 'number') return `"${k}" debe ser un número.`;
    if (p.type === 'string' && typeof v !== 'string') return `"${k}" debe ser texto.`;
    if (p.enum && !p.enum.includes(v)) return `"${k}" debe ser uno de: ${p.enum.join(', ')}.`;
  }
  return null;
}

class ModelContextPolyfill extends EventTarget implements ModelContext {
  readonly polyfill = true;
  private tools = new Map<string, ModelContextTool>();

  async registerTool(tool: ModelContextTool, opts: { signal?: AbortSignal; exposedTo?: string[] } = {}) {
    if (!tool?.name || !tool.description || typeof tool.execute !== 'function') throw new TypeError('registerTool: name, description y execute son obligatorios');
    if (this.tools.has(tool.name)) throw new DOMException(`Ya existe una tool llamada "${tool.name}"`, 'InvalidStateError');
    if (opts.signal?.aborted) return;
    this.tools.set(tool.name, tool);
    opts.signal?.addEventListener('abort', () => {
      if (this.tools.get(tool.name) === tool) {
        this.tools.delete(tool.name);
        this.dispatchEvent(new Event('toolchange'));
      }
    });
    this.dispatchEvent(new Event('toolchange'));
  }

  async getTools() {
    return [...this.tools.values()]
      .map((t) => ({ name: t.name, title: t.title ?? '', description: t.description, inputSchema: t.inputSchema, annotations: t.annotations ?? {}, origin: location.origin }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async executeTool(tool: RegisteredTool, input: Record<string, unknown> = {}, opts: { signal?: AbortSignal } = {}) {
    if (typeof input === 'string') throw new TypeError('executeTool: el input debe ser un objeto (el texto JSON está obsoleto)');
    const t = this.tools.get(tool.name);
    if (!t) throw new DOMException(`No existe la tool "${tool.name}"`, 'NotFoundError');
    const err = validate(t.inputSchema, input);
    if (err) return `Error: ${err}`;
    const ev = Object.assign(new Event('toolactivated'), { toolName: t.name });
    this.dispatchEvent(ev);
    try {
      return await t.execute(input, { signal: opts.signal });
    } catch (e) {
      if (opts.signal?.aborted) this.dispatchEvent(Object.assign(new Event('toolcancel'), { toolName: t.name }));
      throw e;
    }
  }
}

/** Formularios declarativos en el polyfill: toolname + tooldescription → tool. */
function registerDeclarativeForms(mc: ModelContextPolyfill) {
  document.querySelectorAll<HTMLFormElement>('form[toolname][tooldescription]').forEach((form) => {
    const properties: NonNullable<JSONSchema['properties']> = {};
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[name]').forEach((el) => {
      const description = el.getAttribute('toolparamdescription') ?? undefined;
      if (el instanceof HTMLSelectElement) properties[el.name] = { type: 'string', enum: [...el.options].map((o) => o.value), description };
      else properties[el.name] = { type: el.type === 'number' ? 'number' : 'string', description };
    });
    void mc.registerTool({
      name: form.getAttribute('toolname')!,
      description: form.getAttribute('tooldescription')!,
      inputSchema: { type: 'object', properties },
      annotations: { readOnlyHint: true },
      execute: (input) =>
        new Promise((resolve) => {
          for (const [k, v] of Object.entries(input)) {
            const field = form.elements.namedItem(k) as HTMLInputElement | null;
            if (field) field.value = String(v);
          }
          form.classList.add('tool-form-active');
          let responded = false;
          const ev = new SubmitEvent('submit', { cancelable: true, bubbles: true });
          Object.assign(ev, {
            agentInvoked: true,
            respondWith: (p: Promise<unknown>) => {
              responded = true;
              void p.then(resolve, (e) => resolve(`Error: ${e}`));
            },
          });
          form.dispatchEvent(ev);
          setTimeout(() => form.classList.remove('tool-form-active'), 900);
          if (!responded) resolve('Formulario enviado.');
        }),
    });
  });
}

export function getModelContext(): { mc: ModelContext; native: boolean } {
  if (document.modelContext && !(document.modelContext as unknown as { polyfill?: boolean }).polyfill) return { mc: document.modelContext, native: true };
  if (!document.modelContext) {
    const mc = new ModelContextPolyfill();
    Object.defineProperty(document, 'modelContext', { value: mc, configurable: true });
    registerDeclarativeForms(mc);
  }
  return { mc: document.modelContext!, native: false };
}
