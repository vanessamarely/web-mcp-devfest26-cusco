import { describe, expect, it } from 'vitest';
import { Ruta } from './ruta';
import { parseEncargo } from './agent';

describe('Ruta (la lógica que comparten UI y tools)', () => {
  it('no deja programar más de 4000 m el día 1 y explica por qué', () => {
    const r = new Ruta();
    const res = r.agregar('mo-vinicunca', 1, 2);
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(/Aclimatación/);
    expect(r.agregar('mo-vinicunca', 3, 2).ok).toBe(true);
  });
  it('respeta cupos y días llenos', () => {
    const r = new Ruta();
    expect(r.agregar('mp-huayna', 2, 5).ok).toBe(false);
    expect(r.agregar('mp-clasico', 2, 2).ok).toBe(true);
    expect(r.agregar('vs-pisaq', 2, 2).ok).toBe(false);
  });
  it('la reserva exige la versión vigente y la confirmación humana', async () => {
    const r = new Ruta();
    r.agregar('cu-city', 1, 2);
    const vieja = r.version - 1;
    expect((await r.reservar(vieja, 'Ana', async () => true)).ok).toBe(false);
    expect((await r.reservar(r.version, 'Ana', async () => false)).ok).toBe(false);
    const ok = await r.reservar(r.version, 'Ana', async () => true);
    expect(ok.ok).toBe(true);
    expect(r.reserva?.total).toBe(180);
  });
});

describe('parseEncargo (planificador simulado)', () => {
  it('entiende lugares, días y personas', () => {
    const p = parseEncargo('Arma Machu Picchu el día 2 y el Valle Sagrado el día 3 para 2 personas');
    expect(p.personas).toBe(2);
    expect(p.places.map((x) => [x.id, x.dia])).toEqual([['mp-clasico', 2], ['vs-pisaq', 3]]);
  });
});
