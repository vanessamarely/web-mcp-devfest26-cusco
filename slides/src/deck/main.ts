// Controlador del deck: pie de página, tema, contraste, proporción de pantalla, menú,
// decoraciones (chasquis, checklist, código) y la conexión en vivo con el público y la consola.
import {
  Accessibility,
  Bot,
  Check,
  Hand,
  MessageSquareWarning,
  User,
  ArrowUpRight,
  Bug,
  Cable,
  Camera,
  CirclePlay,
  Code,
  Cpu,
  Database,
  Download,
  Eye,
  FileCode,
  Flag,
  FlaskConical,
  GitBranch,
  Globe,
  Layers,
  Map as MapIcon,
  MessageSquareText,
  Mic,
  MousePointerClick,
  NotebookPen,
  ScanEye,
  ShieldCheck,
  Trophy,
  Users,
  Wrench,
  createIcons,
} from 'lucide';
import { CHECKLIST, CODE_DECLARATIVE, CODE_IMPERATIVE, CODE_MCP, CODE_SAFE, SLIDE_BY_ID } from '../shared/content';
import { DEMO_URL, NS, PUBLIC_DEMO_URL, REPO_URL, prettyUrl, publicLiveUrl, withSessionParams } from '../shared/config';
import { chasquiSVG, type ChasquiOptions } from '../shared/chasqui';
import { QUESTIONS, type QuestionId } from '../shared/questions';
import { esc } from '../shared/esc';
import { animateNotchLogos } from './gdg-logo';
import { initLive } from './live';
import { MODES, RATIOS, initRatio, type RatioMode } from './ratio';
import { initCodeFocus } from './code-focus';
import { highlight } from './highlight';
import { LANDMARKS } from './landmarks';

type DeckStage = HTMLElement & { goTo(i: number): void; next(): void; prev(): void };

void animateNotchLogos().then(() => dispatchEvent(new Event('tweakchange')));

const stage = document.querySelector('deck-stage') as DeckStage;
const sections = [...stage.querySelectorAll<HTMLElement>(':scope > section')];
const total = sections.length;
const pad = (n: number) => String(n).padStart(2, '0');
const save = (k: string, v: string) => {
  try {
    localStorage.setItem(`${NS}.deck.${k}`, v);
  } catch {
    /* noop */
  }
};

// Cada slide del HTML debe existir en content.ts (fuente del celular, la consola y la memoria).
sections.forEach((s) => {
  if (!SLIDE_BY_ID.has(s.dataset.id ?? '')) console.warn('[deck] slide sin contenido en content.ts:', s.dataset.id);
});

// ── Pie de página con contador ───────────────────────────────────────
sections.forEach((s, i) => {
  if (i === 0 || s.classList.contains('section-slide') || s.classList.contains('cover')) return;
  s.insertAdjacentHTML(
    'beforeend',
    `<div class="footer"><span class="handles">Instagram <b>@vanessamarelycode</b> · GitHub <b>vanessamarely</b> · <b>vanessamarely.dev</b></span><span>${pad(i + 1)} / ${total}</span></div>`,
  );
});

// ── Código: una sola fuente (content.ts) para el deck, el celular y la memoria ──
const CODE: Record<string, string> = { mcp: CODE_MCP, imperative: CODE_IMPERATIVE, declarative: CODE_DECLARATIVE, safe: CODE_SAFE };
document.querySelectorAll<HTMLElement>('[data-code]').forEach((el) => {
  const src = CODE[el.dataset.code!];
  const pre = el.querySelector('pre')!;
  pre.innerHTML = highlight(src, el.dataset.code === 'declarative' ? 'html' : 'js');
});

// ── Preguntas: texto en el deck (las respuestas NO están en el bundle) ──
document.querySelectorAll<HTMLElement>('[data-q-text]').forEach((el) => (el.textContent = QUESTIONS[el.dataset.qText as QuestionId].text));

// ── Decoraciones: chasquis de ejemplo y checklist ────────────────────
// Semilla fija por posición: los mismos chasquis en cada ensayo (y en las miniaturas).
const DECOR: ChasquiOptions[] = [
  { poncho: 0, pallay: 0, tocado: 0, piel: 2, accesorio: 1, expresion: 0 },
  { poncho: 2, pallay: 1, tocado: 1, piel: 3, accesorio: 3, expresion: 1 },
  { poncho: 3, pallay: 3, tocado: 3, piel: 1, accesorio: 5, expresion: 0 },
  { poncho: 1, pallay: 2, tocado: 2, piel: 4, accesorio: 2, expresion: 2 },
  { poncho: 4, pallay: 4, tocado: 4, piel: 0, accesorio: 4, expresion: 3 },
  { poncho: 5, pallay: 1, tocado: 5, piel: 2, accesorio: 6, expresion: 1 },
];
// Paisajes de Cusco detrás de los chasquis (capítulos, portada y cierre).
document.querySelectorAll<HTMLElement>('[data-landmark]').forEach((el) => {
  el.innerHTML = LANDMARKS[el.dataset.landmark!]?.() ?? '';
});
// Chasquis que corren por el Qhapaq Ñan en cada capítulo, en la receta y sobre el tejido.
document.querySelectorAll<HTMLElement>('[data-runner]').forEach((el) => {
  el.innerHTML = chasquiSVG(DECOR[Number(el.dataset.runner) % DECOR.length], 'Chasqui');
});
document.querySelectorAll<HTMLElement>('[data-chasquis]').forEach((el, k) => {
  const n = Number(el.dataset.chasquis) || 3;
  el.innerHTML = Array.from({ length: n }, (_, i) => chasquiSVG(DECOR[(i + k * 3) % DECOR.length], 'Chasqui').replace('<svg ', `<svg style="--i:${i}" `)).join('');
});
const checklist = document.querySelector('[data-checklist]');
if (checklist) checklist.innerHTML = CHECKLIST.map(([h, p]) => `<li><span><b>${esc(h)}:</b> ${esc(p)}</span></li>`).join('');

// ── Enlaces a la demo ────────────────────────────────────────────────
document.querySelectorAll<HTMLAnchorElement>('[data-demo-link]').forEach((a) => (a.href = new URL(a.dataset.demoLink!, DEMO_URL).toString()));
// El QR y el texto de la demo apuntan SIEMPRE a la versión publicada (los asistentes no pueden abrir localhost).
document.querySelectorAll('[data-demo-url]').forEach((el) => (el.textContent = prettyUrl(PUBLIC_DEMO_URL)));

// ── Tema (claro / oscuro) y alto contraste ───────────────────────────
const isDark = () => document.documentElement.dataset.theme === 'dark';
function setTheme(dark: boolean) {
  if (dark) document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  save('theme', dark ? 'dark' : 'light');
  dispatchEvent(new Event('tweakchange')); // deck-stage re-sincroniza las miniaturas
}
function toggleContrast() {
  const on = document.documentElement.dataset.contrast !== 'high';
  if (on) document.documentElement.dataset.contrast = 'high';
  else delete document.documentElement.dataset.contrast;
  save('contrast', on ? '1' : '0');
  dispatchEvent(new Event('tweakchange'));
}
document.fonts?.ready.then(() => dispatchEvent(new Event('tweakchange')));

// ── Pantalla completa / panel lateral ────────────────────────────────
const toggleFullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined);
let railOn = true;
try {
  railOn = localStorage.getItem('deck-stage.railVisible') !== '0';
} catch {
  /* noop */
}
const toggleRail = () => {
  railOn = !railOn;
  postMessage({ type: '__deck_rail_visible', on: railOn }, location.origin);
};

// ── Menú hamburguesa (siempre arriba a la derecha) ───────────────────
const menuBtn = document.querySelector<HTMLButtonElement>('.deck-menu-btn')!;
const menu = document.querySelector<HTMLElement>('.deck-menu-panel')!;
let current = Math.max(0, sections.findIndex((s) => s.hasAttribute('data-deck-active')));

const ratioLabel = (m: RatioMode) => (m === 'auto' ? ['Auto', 'según la ventana'] : m === 'event' ? ['Extendida', '1680×672 · bandas'] : [RATIOS[m].label, RATIOS[m].hint]);
menu.innerHTML = `
  <div class="group">Enlaces</div>
  <a href="${withSessionParams('/presenter/')}" target="_blank" rel="noreferrer">Consola de la presentadora <kbd>P</kbd></a>
  <a href="${publicLiveUrl()}" target="_blank" rel="noreferrer">App de asistentes <i data-lucide="arrow-up-right"></i></a>
  <a href="${DEMO_URL}" target="_blank" rel="noreferrer">Demo: Ruta Chasqui <i data-lucide="arrow-up-right"></i></a>
  <a href="${REPO_URL}" target="_blank" rel="noreferrer">Repositorio <i data-lucide="arrow-up-right"></i></a>
  <div class="group">Proporción de pantalla <kbd><span data-ratio-state></span> · A</kbd></div>
  <div class="ratio-row">${MODES.map((m) => {
    const [l, h] = ratioLabel(m);
    return `<button type="button" data-ratio-pick="${m}">${l}<small>${h}</small></button>`;
  }).join('')}</div>
  <div class="group">Vista</div>
  <button type="button" data-act="theme">Modo claro / oscuro <kbd>L</kbd></button>
  <button type="button" data-act="contrast">Alto contraste (proyector) <kbd>H</kbd></button>
  <button type="button" data-act="fs">Pantalla completa <kbd>F</kbd></button>
  <button type="button" data-act="rail">Panel de miniaturas <kbd>S</kbd></button>
  <button type="button" data-act="present" data-presenter-only>Presentar en vivo (GitHub)</button>
  <button type="button" data-act="answers" data-presenter-ui hidden>Cargar respuestas del podio… <kbd data-answers-status></kbd></button>
  <button type="button" data-act="questions" data-presenter-ui hidden>Preguntas del público <kbd><span data-q-count>0</span> · Q</kbd></button>
  <button type="button" data-act="wipe" data-presenter-ui hidden>Vaciar sesión en vivo…</button>
  <div class="group">Ir a</div>
  <div class="slides-list"></div>`;

function renderMenuList() {
  const list = menu.querySelector('.slides-list')!;
  if (!list.childElementCount) {
    sections.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${pad(i + 1)} · ${s.dataset.label ?? 'Slide'}`;
      b.addEventListener('click', () => {
        stage.goTo(i);
        closeMenu();
      });
      list.append(b);
    });
  }
  [...list.children].forEach((b, i) => (i === current ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
}

const openMenu = () => {
  menu.hidden = false;
  menuBtn.setAttribute('aria-expanded', 'true');
  menuBtn.setAttribute('aria-label', 'Cerrar menú');
  menu.querySelector<HTMLElement>('a, button')?.focus();
};
const closeMenu = () => {
  menu.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.setAttribute('aria-label', 'Abrir menú');
};
menuBtn.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
addEventListener('pointerdown', (e) => {
  if (!menu.hidden && !menu.contains(e.target as Node) && !menuBtn.contains(e.target as Node)) closeMenu();
});
menu.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const pickRatio = t.closest<HTMLElement>('[data-ratio-pick]')?.dataset.ratioPick as RatioMode | undefined;
  if (pickRatio) return ratio.set(pickRatio);
  const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
  if (act === 'theme') setTheme(!isDark());
  if (act === 'contrast') toggleContrast();
  if (act === 'fs') toggleFullscreen();
  if (act === 'rail') toggleRail();
  if (act === 'present') document.dispatchEvent(new CustomEvent('deck:present'));
  if (act === 'answers') document.dispatchEvent(new CustomEvent('deck:answers'));
  if (act === 'wipe') {
    closeMenu();
    document.dispatchEvent(new CustomEvent('deck:wipe'));
  }
  if (act === 'questions') {
    closeMenu();
    document.dispatchEvent(new CustomEvent('deck:questions'));
  }
});

// ── Clips de la demo: se cargan perezosamente y solo se reproducen en el slide activo ──
function playClips(slide: HTMLElement) {
  document.querySelectorAll<HTMLVideoElement>('video[data-src]').forEach((v) => {
    if (slide.contains(v)) {
      if (!v.src) v.src = v.dataset.src!;
      v.currentTime = 0;
      v.play().catch(() => undefined);
    } else v.pause();
  });
}
stage.addEventListener('slidechange', (e) => {
  const { index, slide } = (e as CustomEvent).detail as { index: number; slide: HTMLElement };
  current = index;
  renderMenuList();
  playClips(slide);
});
setTimeout(() => {
  const first = sections.find((s) => s.hasAttribute('data-deck-active'));
  if (first) playClips(first);
});
renderMenuList();

createIcons({
  icons: { Accessibility, Bot, Check, Hand, MessageSquareWarning, User, ArrowUpRight, Bug, Cable, Camera, CirclePlay, Code, Cpu, Database, Download, Eye, FileCode, Flag, FlaskConical, GitBranch, Globe, Layers, Map: MapIcon, MessageSquareText, Mic, MousePointerClick, NotebookPen, ScanEye, ShieldCheck, Trophy, Users, Wrench },
  attrs: { 'stroke-width': 1.75, 'aria-hidden': 'true' },
});
dispatchEvent(new Event('tweakchange'));

// ── Atajos (sin chocar con deck-stage: ←/→, espacio, R, números) ─────
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'escape' && !menu.hidden) closeMenu();
  if (k === 'l') setTheme(!isDark());
  if (k === 'h') toggleContrast();
  if (k === 'f') toggleFullscreen();
  if (k === 's') toggleRail();
  if (k === 'a') ratio.cycle();
  if (k === 'e') ratio.toggleEvent();
  if (k === 'm') (menu.hidden ? openMenu : closeMenu)();
  if (k === 'p') open(withSessionParams('/presenter/'), `${NS}-presenter`);
});

// ── Proporción de pantalla (4:3 · 16:10 · 16:9 · 21:9 · extendida) ───
const ratio = initRatio(stage, sections);

// ── Modo foco en el código: una idea a la vez (↓/↑ o clic) ──
initCodeFocus(stage, sections);

// ── El código siempre cabe: ajusta el tamaño de letra al ancho Y al alto disponibles ──
// (en 4:3 la columna es más angosta; en 21:9 hay más espacio). Mínimo legible: 12 px.
function fitCode() {
  document.querySelectorAll<HTMLElement>('.code pre').forEach((pre) => {
    const frame = pre.closest<HTMLElement>('.card-frame');
    let size = 17;
    pre.style.fontSize = `${size}px`;
    const tooBig = () => pre.scrollWidth > pre.clientWidth + 1 || (frame ? frame.scrollHeight > frame.clientHeight + 1 : false);
    while (size > 12 && tooBig()) pre.style.fontSize = `${(size -= 0.5)}px`;
  });
}
let fitRaf = 0;
addEventListener('resize', () => {
  cancelAnimationFrame(fitRaf);
  fitRaf = requestAnimationFrame(fitCode);
});
document.fonts?.ready.then(fitCode);
fitCode();

initLive(stage, sections).catch((err) => console.error('[live]', err));
