// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { ACCESORIOS, EXPRESIONES, PALLAYS, PIELES, PONCHOS, TOCADOS, chasquiSVG, normalizeChasqui } from './chasqui';

describe('chasqui', () => {
  it('dibuja todas las combinaciones de tocado y accesorio como SVG válido', () => {
    for (let t = 0; t < TOCADOS.length; t++)
      for (let a = 0; a < ACCESORIOS.length; a++) {
        const svg = chasquiSVG({ poncho: t % PONCHOS.length, pallay: a % PALLAYS.length, tocado: t, piel: a % PIELES.length, accesorio: a, expresion: t % EXPRESIONES.length });
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        expect(doc.querySelector('parsererror')).toBeNull();
        expect(svg).toContain('<title>');
      }
  });

  it('normaliza opciones fuera de rango (datos del muro)', () => {
    expect(normalizeChasqui({ poncho: 99, tocado: -1, accesorio: 2.5 } as never)).toEqual({ poncho: 0, pallay: 0, tocado: 0, piel: 2, accesorio: 0, expresion: 0 });
  });

  it('escapa el título', () => {
    expect(chasquiSVG(normalizeChasqui({}), '<script>')).not.toContain('<script>');
  });
});

describe('silueta del podio', () => {
  it('es un SVG válido y escapa el título', async () => {
    const { chasquiSilhouette } = await import('./chasqui');
    const svg = chasquiSilhouette('<b>Ana</b> no publicó');
    expect(new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror')).toBeNull();
    expect(svg).not.toContain('<b>Ana</b>');
  });
});
