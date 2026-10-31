// Proporciones de pantalla: en un DevFest nunca sabes qué proyector te toca.
//  · auto  → elige la proporción más cercana a la ventana (sin franjas negras).
//  · 4:3   → 960×720   (proyectores viejos de 1024×768 / 800×600)
//  · 16:10 → 1152×720  (1280×800, 1920×1200, muchas laptops)
//  · 16:9  → 1280×720  (1920×1080, la mayoría de TVs)
//  · 21:9  → 1680×720  (pantallas ultra anchas: el contenido se reparte en más columnas)
//  · event → pantalla EXTENDIDA del evento (por defecto 1680×672, 2,5:1): el slide 16:9 al
//            centro y franjas tejidas a los lados con el QR para unirse y el progreso.
// El lienzo siempre mide 720 de alto: el texto se diseña para 4:3 (lo más estrecho) y las
// proporciones más anchas solo agregan aire o columnas. Así una pantalla de baja resolución
// escala el mismo diseño sin cortar nada.
// Teclas: A cambia de proporción · E pantalla extendida. También ?ratio=4:3 y ?screen=event.
import QRCode from 'qrcode';
import { EVENT, NS, prettyUrl, publicLiveUrl } from '../shared/config';
import { SLIDE_BY_ID } from '../shared/content';

export type Ratio = '4:3' | '16:10' | '16:9' | '21:9';
export type RatioMode = 'auto' | Ratio | 'event';

export const DESIGN_H = 720;
export const RATIOS: Record<Ratio, { w: number; label: string; hint: string }> = {
  '4:3': { w: 960, label: '4:3', hint: '1024×768 · proyector clásico' },
  '16:10': { w: 1152, label: '16:10', hint: '1280×800 · laptops' },
  '16:9': { w: 1280, label: '16:9', hint: '1920×1080 · TV / HD' },
  '21:9': { w: 1680, label: '21:9', hint: 'ultra ancha' },
};
export const MODES: RatioMode[] = ['auto', '4:3', '16:10', '16:9', '21:9', 'event'];
const KEY = `${NS}.deck.ratio`;

/** Proporción más cercana a la ventana (en escala logarítmica: 4:3 y 21:9 pesan igual). */
export function nearestRatio(w: number, h: number): Ratio {
  const a = Math.log(w / h);
  return (Object.keys(RATIOS) as Ratio[]).reduce((best, r) => (Math.abs(Math.log(RATIOS[r].w / DESIGN_H) - a) < Math.abs(Math.log(RATIOS[best].w / DESIGN_H) - a) ? r : best), '16:9');
}

/** "1680x672" → { w, h } (pantalla extendida a medida: ?screen=event&size=1920x640). */
function parseSize(s: string | null) {
  const m = /^(\d{3,5})x(\d{3,5})$/.exec(s ?? '');
  return m ? { w: Number(m[1]), h: Number(m[2]) } : { w: 1680, h: 672 };
}

export function initRatio(stage: HTMLElement, sections: HTMLElement[]) {
  const params = new URLSearchParams(location.search);
  const EVENT_SCREEN = parseSize(params.get('size'));
  const pad = (n: number) => String(n).padStart(2, '0');
  let mode: RatioMode = 'auto';

  // ── Franjas laterales de la pantalla extendida ───────────────────────
  const frame = document.createElement('div');
  frame.className = 'event-screen';
  frame.hidden = true;
  frame.setAttribute('aria-hidden', 'true');
  frame.innerHTML = `
    <aside class="screen-band left">
      <div class="band-qr" data-band-qr></div>
      <p class="band-title">Únete</p>
      <p class="band-text">Notas, tu chasqui, el podio y tu memoria de la charla</p>
      <p class="band-url" data-band-url></p>
    </aside>
    <aside class="screen-band right">
      <img class="band-logo" src="/brand/logo-gdg-stacked.svg" alt="" />
      <p class="band-section" data-band-section></p>
      <p class="band-count" data-band-count></p>
      <div class="band-progress"><i data-band-progress></i></div>
      <p class="band-text">${EVENT}</p>
    </aside>`;
  document.body.append(frame);
  const liveUrl = publicLiveUrl();
  void QRCode.toString(liveUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1e1e1e', light: '#ffffff' } }).then((svg) => {
    frame.querySelector('[data-band-qr]')!.innerHTML = svg;
  });
  frame.querySelector('[data-band-url]')!.textContent = prettyUrl(liveUrl);

  function layoutEvent() {
    if (mode !== 'event') return;
    const k = Math.min(innerWidth / EVENT_SCREEN.w, innerHeight / EVENT_SCREEN.h);
    const fw = EVENT_SCREEN.w * k;
    const fh = EVENT_SCREEN.h * k;
    const fx = (innerWidth - fw) / 2;
    const fy = (innerHeight - fh) / 2;
    const sw = Math.min(fw, (fh * 16) / 9);
    const root = document.documentElement.style;
    root.setProperty('--scr-x', `${fx}px`);
    root.setProperty('--scr-y', `${fy}px`);
    root.setProperty('--scr-w', `${fw}px`);
    root.setProperty('--scr-h', `${fh}px`);
    root.setProperty('--scr-k', String(k));
    root.setProperty('--slide-x', `${fx + (fw - sw) / 2}px`);
    root.setProperty('--slide-w', `${sw}px`);
    root.setProperty('--band-w', `${(fw - sw) / 2}px`);
  }

  function updateBand(index: number) {
    const s = sections[index];
    const c = SLIDE_BY_ID.get(s?.dataset.id ?? '');
    frame.querySelector('[data-band-section]')!.textContent = c?.section ?? c?.label ?? '';
    frame.querySelector('[data-band-count]')!.textContent = `${pad(index + 1)} / ${pad(sections.length)}`;
    (frame.querySelector('[data-band-progress]') as HTMLElement).style.width = `${((index + 1) / sections.length) * 100}%`;
  }
  stage.addEventListener('slidechange', (e) => updateBand((e as CustomEvent).detail.index));
  updateBand(Math.max(0, sections.findIndex((s) => s.hasAttribute('data-deck-active'))));

  // Las miniaturas no caben en la pantalla extendida: se ocultan mientras dure el modo.
  let addedNoRail = false;
  const effective = (): Ratio => (mode === 'event' ? '16:9' : mode === 'auto' ? nearestRatio(innerWidth, innerHeight) : mode);

  function apply() {
    const r = effective();
    const w = String(RATIOS[r].w);
    if (stage.getAttribute('width') !== w) stage.setAttribute('width', w);
    if (stage.getAttribute('height') !== String(DESIGN_H)) stage.setAttribute('height', String(DESIGN_H));
    const root = document.documentElement;
    root.dataset.ratio = r.replace(':', '-');
    root.toggleAttribute('data-event-screen', mode === 'event');
    frame.hidden = mode !== 'event';
    if (mode === 'event' && !stage.hasAttribute('no-rail')) {
      stage.setAttribute('no-rail', '');
      addedNoRail = true;
    } else if (mode !== 'event' && addedNoRail) {
      stage.removeAttribute('no-rail');
      addedNoRail = false;
    }
    layoutEvent();
    document.querySelectorAll('[data-ratio-state]').forEach((el) => (el.textContent = mode === 'auto' ? `auto · ${r}` : mode === 'event' ? 'extendida' : r));
    document.querySelectorAll<HTMLElement>('[data-ratio-pick]').forEach((b) => b.toggleAttribute('aria-current', b.dataset.ratioPick === mode));
    // deck-stage recalcula su escala; las miniaturas se re-sincronizan.
    dispatchEvent(new Event('resize'));
    dispatchEvent(new Event('tweakchange'));
  }

  function set(next: RatioMode, remember = true) {
    mode = next;
    if (remember) {
      try {
        localStorage.setItem(KEY, mode);
      } catch {
        /* noop */
      }
    }
    apply();
  }

  let raf = 0;
  addEventListener('resize', (e) => {
    if (!e.isTrusted) return; // el resize que disparamos nosotros
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => (mode === 'auto' && stage.getAttribute('width') !== String(RATIOS[effective()].w) ? apply() : layoutEvent()));
  });

  // ?ratio=4:3 · ?screen=event · o lo último que usaste en este navegador.
  const fromParam = params.get('screen') === 'event' ? 'event' : (params.get('ratio') as RatioMode | null);
  let saved: RatioMode | null = null;
  try {
    saved = localStorage.getItem(KEY) as RatioMode | null;
  } catch {
    /* noop */
  }
  const initial = [fromParam, saved].find((m): m is RatioMode => Boolean(m && MODES.includes(m))) ?? 'auto';
  set(initial, !fromParam);

  return {
    set,
    cycle: () => set(MODES[(MODES.indexOf(mode) + 1) % MODES.length]),
    toggleEvent: () => set(mode === 'event' ? 'auto' : 'event'),
    mode: () => mode,
  };
}
