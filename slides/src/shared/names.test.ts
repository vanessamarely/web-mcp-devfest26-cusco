import { describe, expect, it } from 'vitest';
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
