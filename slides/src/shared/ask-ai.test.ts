import { describe, expect, it } from 'vitest';
import { answerFromTalk, FACTS } from './ask-ai';

describe('answerFromTalk', () => {
  it('responde con el contenido de la charla', () => {
    expect(answerFromTalk('¿Cómo quito una tool registrada con registerTool?')).toMatch(/AbortSignal|abort/);
    expect(answerFromTalk('¿Cómo quito una tool de WebMCP cuando ya no sirve?')).toMatch(/AbortSignal|abort/);
    expect(answerFromTalk('¿Cómo protejo una acción irreversible?')).toMatch(/consequentialHint/);
    expect(answerFromTalk('¿WebMCP funciona en Firefox?')).toMatch(/Firefox|Chrome/);
    expect(answerFromTalk('¿Dónde veo las tools en DevTools?')).toMatch(/Application/);
    expect(answerFromTalk('¿Gemini Nano necesita API key?')).toMatch(/API key/);
  });
  it('no inventa: sin coincidencias devuelve vacío', () => {
    expect(answerFromTalk('¿Qué hora es?')).toBe('');
  });
  it('no usa la API vieja', () => {
    expect(FACTS.join(' ')).not.toMatch(/navigator\.modelContext|provideContext|clearContext|requestUserInteraction/);
  });
});
