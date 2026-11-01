import { describe, expect, it } from 'vitest';
import { isOnTopic } from './ask';

describe('preguntas solo sobre la charla', () => {
  it.each([
    '¿Puedo usar WebMCP con Angular?',
    '¿Cómo marco una tool como irreversible?',
    '¿Qué diferencia hay entre MCP y una API REST?',
    '¿Gemini Nano funciona en el celular?',
    '¿Cómo evito el prompt injection en las reseñas?',
    '¿El agente puede usar mi formulario de login?',
  ])('acepta: %s', (q) => expect(isOnTopic(q)).toBe(true));

  it.each(['¿Qué comiste hoy?', '¿Dónde compraste tu blusa?', 'hola', '¿Cuál es tu equipo de fútbol?', 'qué puta charla de MCP'])('rechaza: %s', (q) =>
    expect(isOnTopic(q)).toBe(false),
  );
});
