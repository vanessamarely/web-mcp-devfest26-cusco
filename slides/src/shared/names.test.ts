// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { BONUS, podiumKey, scoreFor, uniqueCodes, winnerCode } from './realtime';
import { TOTAL_COMBINATIONS, allNames, claimUniqueName, nameKey, numbered, randomName } from './names';

describe('apodos', () => {
  it('alcanzan de sobra para 300+ asistentes sin repetir', () => {
    const names = allNames();
    expect(TOTAL_COMBINATIONS).toBeGreaterThanOrEqual(1000);
    expect(new Set(names.map(nameKey)).size).toBe(names.length);
  });

  it('respetan el género ("Llama Andina", "Cóndor Andino")', () => {
    const names = allNames();
    expect(names).toContain('Llama Andina');
    expect(names).toContain('Cóndor Andino');
    expect(names).not.toContain('Llama Andino');
  });

  it('caben en las reglas de Firestore (≤ 40 caracteres con numeración)', () => {
    for (const n of allNames()) expect(numbered(n, 999).length).toBeLessThanOrEqual(40);
  });

  it('randomName siempre produce un apodo de la lista', () => {
    const set = new Set(allNames());
    for (let i = 0; i < 200; i++) expect(set.has(randomName())).toBe(true);
  });

  it('300 personas que eligen el MISMO apodo reciben números distintos', async () => {
    const taken = new Set<string>();
    const reserve = async (n: string) => (taken.has(nameKey(n)) ? false : (taken.add(nameKey(n)), true));
    const got: string[] = [];
    for (let i = 0; i < 300; i++) got.push(await claimUniqueName('Cóndor Veloz', reserve));
    expect(new Set(got).size).toBe(300);
    expect(got[0]).toBe('Cóndor Veloz');
    expect(got[1]).toBe('Cóndor Veloz 2');
    expect(got[299]).toBe('Cóndor Veloz 300');
  });
});

describe('códigos del podio', () => {
  it('el código es estable y de 4 letras legibles', () => {
    expect(winnerCode('abc')).toBe(winnerCode('abc'));
    expect(winnerCode('abc')).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  });
  it('la clave interna no choca con 3.000 personas', () => {
    const keys = new Set(Array.from({ length: 3000 }, (_, i) => podiumKey('uid-' + i)));
    expect(keys.size).toBe(3000);
  });
  it('si dos códigos del top coinciden, se alargan hasta ser únicos', () => {
    // busca dos uid con el mismo código de 4 letras
    const seen = new Map<string, string>();
    let pair: [string, string] | null = null;
    for (let i = 0; i < 200000 && !pair; i++) {
      const u = 'u' + i;
      const c = winnerCode(u);
      if (seen.has(c)) pair = [seen.get(c)!, u];
      else seen.set(c, u);
    }
    expect(pair).not.toBeNull();
    const codes = uniqueCodes([...pair!, 'otro']);
    expect(new Set(codes).size).toBe(3);
    expect(codes[0].length).toBeGreaterThan(4);
  });
});
describe('puntos del podio', () => {
  it('los bonos tienen tope y no superan a una respuesta correcta', () => {
    const all = scoreFor(undefined, {}, { chasqui: true, early: true, asked: true, reactions: 99 }, {});
    expect(all).toBe(BONUS.chasqui + BONUS.early + BONUS.asked + BONUS.reactionMax);
    expect(all).toBe(400);
    expect(scoreFor(undefined, {}, { reactions: 3 }, {})).toBe(30);
  });
});
