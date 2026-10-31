// Las 3 preguntas del podio (estilo Kahoot), una al final de cada bloque de la charla.
// Aquí solo van el texto y las opciones: las respuestas correctas NO viven en el código
// (el bundle es público). Están en Firestore en un documento que solo la presentadora
// puede leer; al revelar, el deck publica únicamente la respuesta de esa pregunta.

export type QuestionId = 'q1' | 'q2' | 'q3';
export type OptionId = 'a' | 'b' | 'c' | 'd';
export const QUESTION_IDS: QuestionId[] = ['q1', 'q2', 'q3'];

export interface Question {
  id: QuestionId;
  /** bloque de la charla que evalúa */
  topic: string;
  text: string;
  options: { id: OptionId; label: string }[];
}

export type AnswerKey = Partial<Record<QuestionId, { correct: OptionId; explain: string }>>;

export function parseAnswerKey(raw: unknown): AnswerKey {
  const out: AnswerKey = {};
  if (!raw || typeof raw !== 'object') throw new Error('El archivo no es un JSON de respuestas');
  for (const q of QUESTION_IDS) {
    const a = (raw as Record<string, { correct?: string; explain?: string }>)[q];
    if (!a) continue;
    if (!['a', 'b', 'c', 'd'].includes(a.correct ?? '')) throw new Error(`${q}: "correct" debe ser a, b, c o d`);
    out[q] = { correct: a.correct as OptionId, explain: String(a.explain ?? '').slice(0, 400) };
  }
  if (!Object.keys(out).length) throw new Error('No encontré q1, q2 ni q3');
  return out;
}

export const QUESTIONS: Record<QuestionId, Question> = {
  q1: {
    id: 'q1',
    topic: 'MCP',
    text: 'En MCP, ¿qué hace un servidor MCP?',
    options: [
      { id: 'a', label: 'Es el modelo de IA que genera las respuestas' },
      { id: 'b', label: 'Expone tools, recursos y prompts que un cliente MCP descubre e invoca' },
      { id: 'c', label: 'Es la pestaña del navegador donde corre la página' },
      { id: 'd', label: 'Guarda el historial del chat del usuario' },
    ],
  },
  q2: {
    id: 'q2',
    topic: 'La API de WebMCP',
    text: 'Con la API actual de WebMCP, ¿cómo dejas de exponer una tool registrada con registerTool()?',
    options: [
      { id: 'a', label: 'Llamando a navigator.modelContext.clearContext()' },
      { id: 'b', label: 'Llamando a provideContext({ tools: [] })' },
      { id: 'c', label: 'Abortando el AbortSignal que pasaste en las opciones de registerTool()' },
      { id: 'd', label: 'Recargando el modelo de Gemini Nano' },
    ],
  },
  q3: {
    id: 'q3',
    topic: 'Web agéntica',
    text: '¿Qué gana un agente con WebMCP frente a leer la pantalla y simular clics?',
    options: [
      { id: 'a', label: 'Que la página ya no necesita JavaScript' },
      { id: 'b', label: 'Llama funciones con nombre y JSON Schema que la página define, sin depender del diseño visual' },
      { id: 'c', label: 'Que el sitio carga más rápido para todos los usuarios' },
      { id: 'd', label: 'Que ya no hace falta pedir confirmación al usuario' },
    ],
  },
};
