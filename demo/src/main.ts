// Ruta Chasqui: el sitio (para personas) + dos agentes que intentan el MISMO encargo:
//  · Con WebMCP: llama tools con nombre y JSON Schema (document.modelContext).
//  · Con clics: lee el DOM, adivina botones por su texto y simula clics.
// "Rediseñar página" cambia textos y dónde están los botones: solo uno de los dos sigue en pie.
import './styles.css';
import { BY_ID, soles } from './catalog';
import { ruta, type Ruta } from './ruta';
import { getModelContext } from './webmcp';
import { bindSearchForm, registerTools } from './tools';
import { nanoAvailability, runWebMCPAgent, type AgentRun, type AgentStep, type Engine } from './agent';
import { runClickerAgent } from './clicker';

const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)!;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const params = new URLSearchParams(location.search);
const speed = Number(params.get('speed')) || 1;

// ── Tema ─────────────────────────────────────────────────────────────
$('[data-theme]').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark' && !(document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try {
    localStorage.setItem('chasqui.theme', dark ? 'dark' : 'light');
  } catch {
    /* noop */
  }
});

// ── Toast ────────────────────────────────────────────────────────────
const toast = $('.toast');
let toastTimer = 0;
function say(text: string, error = false) {
  toast.textContent = text;
  toast.classList.toggle('error', error);
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.hidden = true), 3200);
}

// ── Rediseño: mismos datos, otros textos y otra estructura ───────────
let redesigned = params.has('redesign');
function applyRedesign() {
  document.body.classList.toggle('redesigned', redesigned);
  $('[data-redesign]').setAttribute('aria-pressed', String(redesigned));
  $('[data-redesign]').textContent = redesigned ? 'Volver al diseño original' : 'Rediseñar página';
  $('[data-hero-title]').textContent = redesigned ? 'Descubre Cusco' : 'Experiencias en Cusco';
  renderResults(lastIds);
}
$('[data-redesign]').addEventListener('click', () => {
  redesigned = !redesigned;
  applyRedesign();
  say(redesigned ? 'Nuevo diseño: otros textos y los botones dentro del menú “⋯”.' : 'Diseño original.');
});

// ── Resultados ───────────────────────────────────────────────────────
let lastIds: string[] = [];
let focused = '';
function renderResults(ids: string[]) {
  lastIds = ids;
  $('[data-results-head]').textContent = `${ids.length} ${ids.length === 1 ? 'experiencia' : 'experiencias'} · ordenadas por recomendación`;
  const list = redesigned ? [...ids].reverse() : ids;
  $('#results').innerHTML = list.length
    ? list
        .map((id) => {
          const e = BY_ID.get(id)!;
          const action = redesigned
            ? `<details class="more"><summary aria-label="Más opciones">⋯</summary><button type="button" class="btn small" data-add="${e.id}" aria-label="Sumar al viaje">＋ Sumar</button></details>`
            : `<button type="button" class="btn small primary" data-add="${e.id}">Agregar a mi ruta</button>`;
          const stars = '★'.repeat(Math.round(e.rating)).padEnd(5, '☆');
          return `<article class="card ${focused === e.id ? 'focused' : ''}" data-id="${e.id}" style="--c:${e.color}">
            <div class="card-body">
              <p class="tag"><span class="pin">${esc(e.zona)}</span> · ${esc(e.tipo)} · ${esc(e.duracion)} · ${e.altitud.toLocaleString('es-PE')} m</p>
              <h3>${esc(redesigned ? e.nombre.toUpperCase() : e.nombre)}</h3>
              <p class="rating"><span class="stars" aria-label="${e.rating} de 5">${stars}</span> <b>${e.rating.toFixed(1)}</b> <span class="muted">(${e.opiniones.toLocaleString('es-PE')})</span></p>
              <p class="perk">✓ Cancelación gratuita · ${e.cupos <= 3 ? `<span class="hot">¡Quedan ${e.cupos} cupos!</span>` : `${e.cupos} cupos`}</p>
              <div class="card-foot"><span class="price">desde <b>${soles(e.precio)}</b><small>por persona</small></span>${action}</div>
            </div>
          </article>`;
        })
        .join('')
    : '<p class="empty">No hay experiencias con esos filtros.</p>';
}

// Agregar desde la UI (personas y agente de clics): diálogo para elegir día y personas.
const addDlg = $<HTMLDialogElement>('#add-dialog');
let adding = '';
$('#results').addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-add]');
  if (!b) return;
  adding = b.dataset.add!;
  $('[data-add-title]').textContent = `Agregar: ${BY_ID.get(adding)!.nombre}`;
  addDlg.showModal();
});
addDlg.addEventListener('close', () => {
  if (addDlg.returnValue !== 'ok' || !adding) return;
  const f = $<HTMLFormElement>('[data-add-form]');
  const r = ruta.agregar(adding, Number((f.elements.namedItem('dia') as HTMLSelectElement).value), Number((f.elements.namedItem('personas') as HTMLInputElement).value));
  say(r.ok ? r.mensaje : r.error, !r.ok);
});

// ── Mi ruta ──────────────────────────────────────────────────────────
function renderRuta() {
  const s = ruta.resumen();
  const dias = [...new Set(s.items.map((i) => i.dia))];
  $('#mi-ruta').innerHTML = `<h2>Mi ruta <small>v${s.version}</small></h2>
    ${
      s.items.length
        ? dias
            .map(
              (d) => `<div class="day"><p class="day-label">Día ${d}</p>${s.items
                .filter((i) => i.dia === d)
                .map((i) => `<div class="leg" style="--c:${BY_ID.get(i.id)!.color}"><span>${esc(i.nombre)}<small>${i.personas} ${i.personas === 1 ? 'persona' : 'personas'} · ${soles(i.subtotal)}</small></span>${s.reservada ? '' : `<button type="button" class="x" data-del="${i.id}" aria-label="Quitar">✕</button>`}</div>`)
                .join('')}</div>`,
            )
            .join('')
        : '<p class="muted small">Vacía. Agrega experiencias o pídeselo a un agente.</p>'
    }
    ${s.avisos.map((a) => `<p class="aviso">${esc(a)}</p>`).join('')}
    <p class="total">Total <b>${s.total_texto}</b></p>
    ${ruta.reserva ? `<p class="reservada">✓ Reservada · ${esc(ruta.reserva.codigo)}</p>` : s.items.length ? '<button type="button" class="btn primary wide" data-book>Reservar</button>' : ''}`;
}
$('#mi-ruta').addEventListener('click', async (e) => {
  const t = e.target as HTMLElement;
  const del = t.closest<HTMLElement>('[data-del]')?.dataset.del;
  if (del) ruta.quitar(del);
  if (t.closest('[data-book]')) {
    const r = await ruta.reservar(ruta.version, 'Tú', confirmar);
    say(r.ok ? r.mensaje : r.error, !r.ok);
  }
});
ruta.subscribe(renderRuta);

// ── Confirmación humana (consequentialHint) ──────────────────────────
const confirmDlg = $<HTMLDialogElement>('#confirm-dialog');
function confirmar(r: Ruta): Promise<boolean> {
  const s = r.resumen();
  $('[data-confirm-body]').innerHTML = `<ul class="confirm-list">${s.items.map((i) => `<li>Día ${i.dia} · ${esc(i.nombre)} × ${i.personas} <b>${soles(i.subtotal)}</b></li>`).join('')}</ul><p class="total">Total <b>${s.total_texto}</b></p>`;
  confirmDlg.returnValue = '';
  confirmDlg.showModal();
  return new Promise((resolve) => confirmDlg.addEventListener('close', () => resolve(confirmDlg.returnValue === 'ok'), { once: true }));
}

// ── WebMCP ───────────────────────────────────────────────────────────
const form = $<HTMLFormElement>('#buscador');
const hooks = {
  confirmar,
  mostrarResultados: (ids: string[]) => renderResults(ids),
  enfocar: (id: string) => {
    focused = id;
    document.querySelectorAll('.card.focused').forEach((c) => c.classList.remove('focused'));
    const card = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
    card?.classList.add('focused');
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },
};
bindSearchForm(form, hooks);
const { mc, native } = getModelContext();
const toolsCtl = new AbortController();
await registerTools(mc, hooks, toolsCtl.signal);
$('[data-mc-badge]').textContent = native ? 'WebMCP nativo (document.modelContext)' : 'WebMCP · polyfill';
$('[data-mc-badge]').classList.toggle('ok', native);

async function renderTools() {
  const tools = await mc.getTools();
  $('[data-tools]').innerHTML = tools
    .map((t) => {
      const a = t.annotations ?? {};
      const badges = [a.readOnlyHint && '<i class="b ro">readOnly</i>', a.consequentialHint && '<i class="b cq">consequential</i>', a.untrustedContentHint && '<i class="b un">untrustedContent</i>', a.debugging && '<i class="b db">debugging</i>', t.name === 'buscar_experiencias' && '<i class="b dc">declarativa</i>'].filter(Boolean).join('');
      return `<li><code>${esc(t.name)}</code>${badges}<p>${esc(t.description)}</p><small>${esc(Object.keys(t.inputSchema?.properties ?? {}).join(', ') || 'sin argumentos')}</small></li>`;
    })
    .join('');
}
mc.addEventListener('toolchange', () => void renderTools());
let events = 0;
mc.addEventListener('toolactivated', (e) => ($('[data-events]').textContent = `toolactivated ×${++events} · última: ${(e as Event & { toolName?: string }).toolName}`));
await renderTools();

// ── Motor del agente ─────────────────────────────────────────────────
const avail = await nanoAvailability();
const engine: Engine = params.get('engine') === 'sim' ? 'sim' : params.get('engine') === 'nano' || avail === 'available' ? 'nano' : 'sim';
$('[data-engine-badge]').textContent = engine === 'nano' ? 'Gemini Nano (Prompt API)' : `Simulado${avail !== 'unavailable' ? ` · Nano: ${avail}` : ''}`;
$('[data-engine-badge]').classList.toggle('ok', engine === 'nano');

// ── Panel de agentes ─────────────────────────────────────────────────
type Tab = 'webmcp' | 'clicker' | 'tools';
let tab: Tab = 'webmcp';
document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
  b.addEventListener('click', () => {
    tab = b.dataset.tab as Tab;
    document.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    document.querySelectorAll<HTMLElement>('[data-body]').forEach((x) => (x.hidden = !x.dataset.body!.split(' ').includes(tab)));
    $('[data-run]').textContent = tab === 'clicker' ? 'Enviar al agente de clics' : 'Enviar al agente con WebMCP';
  }),
);

const PRESETS = ['Arma Machu Picchu el día 2 y el Valle Sagrado el día 3 para 2 personas', 'Agrega Vinicunca el día 1 para 2 personas', 'Lee las reseñas de Vinicunca', 'Reserva mi ruta a nombre de Vanessa'];
$('[data-presets]').innerHTML = PRESETS.map((p, i) => `<button type="button" class="chip" data-preset="${i}">${esc(p)}</button>`).join('');
const area = $<HTMLTextAreaElement>('[data-ask] textarea');
$('[data-presets]').addEventListener('click', (e) => {
  const i = (e.target as HTMLElement).closest<HTMLElement>('[data-preset]')?.dataset.preset;
  if (i !== undefined) area.value = PRESETS[Number(i)];
});

const timeline = $('[data-timeline]');
function addStep(who: 'webmcp' | 'clicker', s: AgentStep) {
  const li = document.createElement('li');
  li.className = `st ${s.kind} ${who}${s.untrusted ? ' untrusted' : ''}`;
  const label = { think: who === 'webmcp' ? 'piensa' : 'mira', call: who === 'webmcp' ? 'tool' : 'acción', result: 'resultado', answer: 'respuesta', error: 'error' }[s.kind];
  const body = s.kind === 'result' && s.text.length > 220 ? `${s.text.slice(0, 220)}…` : s.text;
  li.innerHTML = `<span class="who">${who === 'webmcp' ? 'WebMCP' : 'Clics'} · ${label}${s.untrusted ? ' · <b>no confiable</b>' : ''}${s.ms !== undefined ? ` · ${s.ms} ms` : ''}</span><p>${esc(body)}</p>`;
  timeline.append(li);
  li.scrollIntoView({ block: 'nearest' });
}

const scores: Partial<Record<'webmcp' | 'clicker', AgentRun & { redesigned: boolean }>> = {};
function renderScore() {
  const cell = (k: 'webmcp' | 'clicker', label: string) => {
    const s = scores[k];
    return `<div class="sc ${k} ${s ? (s.ok ? 'ok' : 'bad') : ''}"><p>${label}${s?.redesigned ? ' <i>rediseño</i>' : ''}</p>${
      s ? `<dl><div><dt>pasos</dt><dd>${s.steps}</dd></div><div><dt>tokens*</dt><dd>${s.tokens.toLocaleString('es-PE')}</dd></div><div><dt>tiempo</dt><dd>${(s.ms / 1000).toFixed(1)} s</dd></div></dl><b>${s.ok ? '✓ lo logró' : '✗ se perdió'}</b>` : '<span class="muted small">sin correr</span>'
    }</div>`;
  };
  $('[data-score]').innerHTML = `${cell('webmcp', 'Con WebMCP')}${cell('clicker', 'Con clics')}<p class="fine">*estimado: caracteres que lee el modelo ÷ 4</p>`;
}
renderScore();

let running: AbortController | null = null;
async function run(who: 'webmcp' | 'clicker', prompt: string) {
  running?.abort();
  running = new AbortController();
  const li = document.createElement('li');
  li.className = 'st prompt';
  li.innerHTML = `<span class="who">Encargo · ${who === 'webmcp' ? 'agente con WebMCP' : 'agente de clics'}</span><p>${esc(prompt)}</p>`;
  timeline.append(li);
  document.body.classList.add(`running-${who}`);
  try {
    const r =
      who === 'webmcp'
        ? await runWebMCPAgent(prompt, { mc, engine, onStep: (s) => addStep('webmcp', s), signal: running.signal, delay: 450 / speed })
        : await runClickerAgent(prompt, { root: $('#site'), onStep: (s) => addStep('clicker', s), signal: running.signal, speed });
    scores[who] = { ...r, redesigned };
  } catch (e) {
    addStep(who, { kind: 'error', text: (e as Error).message });
    scores[who] = { steps: 0, tokens: 0, ms: 0, ok: false, redesigned };
  } finally {
    document.body.classList.remove(`running-${who}`);
    renderScore();
  }
}
$('[data-ask]').addEventListener('submit', (e) => {
  e.preventDefault();
  void run(tab === 'clicker' ? 'clicker' : 'webmcp', area.value.trim());
});
$('[data-compare]').addEventListener('click', async () => {
  const prompt = area.value.trim();
  ruta.reset();
  await run('clicker', prompt);
  ruta.reset();
  await run('webmcp', prompt);
});
$('[data-reset]').addEventListener('click', () => {
  ruta.reset();
  timeline.innerHTML = '';
  delete scores.webmcp;
  delete scores.clicker;
  renderScore();
  form.reset();
  renderResults(ruta.buscar({}).map((x) => x.id));
});

// ── Arranque ─────────────────────────────────────────────────────────
renderResults(ruta.buscar({}).map((x) => x.id));
renderRuta();
applyRedesign();
if (params.get('tab')) document.querySelector<HTMLElement>(`[data-tab="${params.get('tab')}"]`)?.click();
// Expuesto para pruebas y para grabar los clips de la charla.
Object.assign(window, { chasqui: { ruta, mc, run, engine } });
