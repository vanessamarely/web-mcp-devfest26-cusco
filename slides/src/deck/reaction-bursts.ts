// Reacciones con efecto: cuando la sala reacciona EN MASA, pasa algo en la pantalla.
//  🔥 fuego        → un chasqui cruza corriendo con un letrero
//  🤯 mente volada → el cóndor atraviesa la pantalla
//  ❤️ me gusta     → el Inti aparece y sonríe
// No cuesta tiempo de charla: se dispara solo. Umbral proporcional a la sala y un enfriamiento
// por efecto para no saturar. Respeta prefers-reduced-motion.
import { chasquiSVG } from '../shared/chasqui';
import type { Reaction } from '../shared/realtime';
import { condorSVG, intiSVG } from './landmarks';

const WINDOW_MS = 6000;
const COOLDOWN_MS = 25000;

/** Cuántas reacciones iguales en 6 s disparan el efecto: 4 como mínimo, ~6 % de la sala, 18 como máximo. */
export const burstThreshold = (players: number) => Math.min(18, Math.max(4, Math.ceil(players * 0.06)));

export function createBursts(getPlayers: () => number) {
  const hits: Record<string, number[]> = {};
  const lastFired: Record<string, number> = {};
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function show(kind: Reaction) {
    const el = document.createElement('div');
    el.className = `burst burst-${kind}`;
    el.setAttribute('role', 'status');
    if (kind === 'fire')
      el.innerHTML = `<div class="burst-runner">${chasquiSVG({ poncho: 0, pallay: 1, tocado: 0, piel: 2, accesorio: 2, expresion: 2 }, 'Chasqui')}</div><p class="burst-sign">¡Cusco está en llamas! 🔥</p>`;
    if (kind === 'mind') el.innerHTML = `<div class="burst-condor">${condorSVG()}</div><p class="burst-sign">¡Mente volada! 🤯</p>`;
    if (kind === 'heart') el.innerHTML = `<div class="burst-inti">${intiSVG()}</div><p class="burst-sign">¡Sulpayki por tanto cariño! ❤️</p>`;
    document.body.append(el);
    setTimeout(() => el.remove(), reduced() ? 2500 : 5200);
  }

  return {
    /** Llamar con cada reacción recibida. Devuelve true si disparó un efecto. */
    add(r: Reaction, now = Date.now()): boolean {
      if (r === 'ask') return false;
      const list = (hits[r] = (hits[r] ?? []).filter((t) => now - t < WINDOW_MS));
      list.push(now);
      if (list.length < burstThreshold(getPlayers()) || now - (lastFired[r] ?? 0) < COOLDOWN_MS) return false;
      lastFired[r] = now;
      hits[r] = [];
      show(r);
      return true;
    },
    /** Para ensayar desde la consola: window.deckBurst('fire') */
    show,
  };
}
