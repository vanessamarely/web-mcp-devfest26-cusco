// Respuesta inmediata a las preguntas del público, en el propio dispositivo del asistente.
//  · Gemini Nano (Prompt API) cuando el navegador lo tiene listo: responde SOLO con el
//    contenido de la charla (slides, reglas y código) como contexto.
//  · Sin Nano (la mayoría de celulares): respuesta de la charla buscada por palabras clave.
// La pregunta igual le llega a Vanessa; esto es una primera respuesta, no la última palabra.
import { CHECKLIST, CODE_DECLARATIVE, CODE_IMPERATIVE, SLIDES } from './content';

interface LMSession {
  promptStreaming(input: string, opts?: { signal?: AbortSignal }): ReadableStream<string>;
  destroy(): void;
}
interface LMStatic {
  availability(opts?: unknown): Promise<string>;
  create(opts?: unknown): Promise<LMSession>;
}
const LM = () => (globalThis as unknown as { LanguageModel?: LMStatic }).LanguageModel;
const LANG = { expectedInputs: [{ type: 'text', languages: ['es'] }], expectedOutputs: [{ type: 'text', languages: ['es'] }] };

const SKIP = new Set(['portada', 'unete', 'bio', 'q1', 'q2', 'q3', 'muro', 'podio']);

/** Lo que la charla dice, en frases cortas: el único contexto que usa la IA. [tema, frase] */
const PAIRS: [string, string][] = [
  ...SLIDES.filter((s) => !SKIP.has(s.id)).flatMap((s) => s.summary.map((t): [string, string] => [s.title, t])),
  ...CHECKLIST.map(([k, v]): [string, string] => [`Regla «${k}»`, v]),
  ...([
  'WebMCP es una propuesta web (W3C Web Machine Learning Community Group) impulsada por Google y Microsoft; en Chrome se prueba activando chrome://flags/#enable-webmcp-testing.',
  'En Chrome DevTools, el panel Application → WebMCP lista las tools disponibles, su actividad, y permite ejecutarlas a mano (Run tool).',
  'Gemini Nano corre dentro de Chrome con la Prompt API (LanguageModel.create y session.prompt): sin servidor, sin API key, los datos no salen del equipo.',
  'MCP conecta agentes con sistemas por un servidor (stdio o HTTP); WebMCP pone las tools en la página que el usuario ya tiene abierta, con su sesión y su estado.',
  'Hoy WebMCP se prueba en Chrome con el flag; como es una propuesta de estándar, el soporte en otros navegadores (Firefox, Safari) todavía está por llegar.',
  ].map((t): [string, string] => ['Dato', t])),
];
export const FACTS: string[] = PAIRS.map(([k, t]) => `${k}: ${t}`);

const CONTEXT = `${FACTS.map((f) => `- ${f}`).join('\n')}

Código de la charla (API imperativa):
${CODE_IMPERATIVE}

Código de la charla (API declarativa):
${CODE_DECLARATIVE}`;

const SYSTEM = `Eres el asistente de la charla "WebMCP en acción" de Vanessa Aristizabal en DevFest Cusco 2026.
Respondes preguntas del público SOLO con la información del contexto. Reglas:
1. Español claro, máximo 4 frases. Puedes incluir un fragmento de código corto si ayuda.
2. Usa la API actual de WebMCP del contexto: document.modelContext.registerTool(tool, { signal }), AbortSignal para quitar tools, formularios con toolname. No inventes métodos ni nombres.
3. Si el contexto no alcanza para responder, dilo en una frase y explica que Vanessa responderá al final.
4. No respondas nada fuera de MCP, WebMCP, la web agéntica, la demo o la IA en el navegador.

Contexto:
${CONTEXT}`;

export type AiEngine = 'nano' | 'charla';

/** ¿Hay Gemini Nano listo en este dispositivo? (no descargamos el modelo en el celular de nadie) */
export async function nanoReady(): Promise<boolean> {
  try {
    return LM() ? (await LM()!.availability(LANG)) === 'available' : false;
  } catch {
    return false;
  }
}

/** Gemini Nano responde en streaming; onText recibe el texto acumulado. */
export async function answerWithNano(question: string, onText: (text: string) => void, signal?: AbortSignal): Promise<string> {
  const session = await LM()!.create({ ...LANG, initialPrompts: [{ role: 'system', content: SYSTEM }], signal });
  try {
    let text = '';
    const stream = session.promptStreaming(question, { signal });
    const reader = stream.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      // Chrome entrega fragmentos nuevos (versiones antiguas entregaban el texto acumulado).
      text = value.startsWith(text) && text ? value : text + value;
      onText(text);
    }
    return text.trim();
  } finally {
    session.destroy();
  }
}

// ── Sin Nano: busco las frases de la charla que más se parecen a la pregunta ──
const STOP = new Set('que qué como cómo para por con una uno los las del de la el en es se y o a mi mis tu tus su sus lo le al si sí no puedo puede hay cual cuál cuales cuáles donde dónde cuando cuándo esto esta este eso esa ese son ser hacer hace usar uso sobre entre más mas muy ya'.split(' '));
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const words = (s: string) => norm(s).split(/[^a-z0-9#._]+/).filter((w) => w.length > 2 && !STOP.has(w));

// Raíz corta (quito/quitar/quita → "quit") y sinónimos de lo que la gente pregunta.
const stem = (w: string) => w.replace(/s$/, '').slice(0, 5);
const SYN: [RegExp, string][] = [
  [/\b(quit|elimin|borr|remov|desregist|dejar? de exponer|ya no sirv|deshabilit)/, 'quita abortsignal abort'],
  [/\b(registr|crear? una tool|exponer|defin)/, 'registertool'],
  [/\b(formulario|form\b|html|declarativ)/, 'declarativa formulario toolname'],
  [/\b(segur|peligr|irreversib|confirm|proteg|ataque|injection|inyecci)/, 'consequentialhint untrustedcontenthint confirmacion'],
  [/\b(depur|debug|devtools|prob|inspecc|ver las tools)/, 'devtools application panel'],
  [/\b(navegador|firefox|safari|edge|soporte|flag|activ)/, 'chrome flag navegadores'],
  [/\b(nano|prompt api|ia local|on.?device|api key)/, 'gemini nano prompt'],
  [/\b(diferenci|vs\b|compar|complement)/, 'complementan'],
  [/(web agentica|agentic|que es un agente)/, 'entender usar confiar intencion'],
];

/** Respuesta de la charla (sin IA): hasta 3 frases del contenido que más se parecen (palabras raras pesan más). */
export function answerFromTalk(question: string): string {
  const qn = norm(question);
  const extra = SYN.filter(([re]) => re.test(qn)).map(([, w]) => w).join(' ');
  const q = new Set(words(`${question} ${extra}`).map(stem));
  if (!q.size) return '';
  const docs = PAIRS.map(([k, f]) => new Set(words(`${k} ${f}`).map(stem)));
  const df = new Map<string, number>();
  for (const d of docs) for (const w of d) df.set(w, (df.get(w) ?? 0) + 1);
  const scored = PAIRS.map(([, f], i) => {
    let score = 0;
    for (const w of q) if (docs[i].has(w)) score += Math.log(PAIRS.length / df.get(w)!);
    return { f, i, score };
  })
    .filter((x) => x.score >= 2.5)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, 2);
  return scored.map((x) => x.f).join(' ');
}
