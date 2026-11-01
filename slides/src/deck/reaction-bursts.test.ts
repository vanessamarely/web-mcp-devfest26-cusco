// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { burstThreshold, createBursts } from './reaction-bursts';

describe('reacciones con efecto', () => {
  it('el umbral escala con la sala (4 mínimo, 18 máximo)', () => {
    expect(burstThreshold(0)).toBe(4);
    expect(burstThreshold(100)).toBe(6);
    expect(burstThreshold(300)).toBe(18);
    expect(burstThreshold(1000)).toBe(18);
  });

  it('dispara con una oleada, no con reacciones sueltas, y respeta el enfriamiento', () => {
    const b = createBursts(() => 50); // umbral 4
    const t = 1_000_000;
    expect(b.add('fire', t)).toBe(false);
    expect(b.add('fire', t + 10_000)).toBe(false); // la primera ya salió de la ventana de 6 s
    expect(b.add('fire', t + 10_500)).toBe(false);
    expect(b.add('fire', t + 11_000)).toBe(false);
    expect(b.add('fire', t + 11_500)).toBe(true); // 4 en 6 s → efecto
    for (let i = 0; i < 4; i++) expect(b.add('fire', t + 12_000 + i * 100)).toBe(false); // enfriamiento
    expect(b.add('ask', t)).toBe(false); // las preguntas nunca disparan efectos
  });
});
