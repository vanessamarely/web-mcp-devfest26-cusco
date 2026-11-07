// App de asistentes (celular). Sigue al deck en vivo:
//  · Escucha UN solo documento (índice + id del slide + pregunta abierta): el contenido ya viene en el bundle.
//  · Apodo ÚNICO por sesión: si alguien ya lo tiene, se le agrega una numeración ("Cóndor Veloz 2").
//  · Las pantallas se construyen una vez por slide y se actualizan por partes (sin recrear todo).
//  · Notas con RETENCIÓN: si estás escribiendo, tu pantalla no cambia de slide hasta que guardes.
//  · 3 preguntas por el podio; la respuesta correcta solo llega cuando la presentadora revela.
//  · Chasqui y memoria se generan EN EL DISPOSITIVO: tus notas nunca salen del teléfono.
import { Brain, Check, Circle, Diamond, Download, FileText, Flame, GitBranch, Heart, MessageCircleQuestion, Moon, NotebookPen, Radio, Send, Shuffle, Sparkles, Square, Sun, SunMoon, Triangle, Trophy, Map as MapIcon, X, createElement, createIcons, type IconNode } from 'lucide';
import { SLIDES, SLIDE_BY_ID, type SlideContent } from '../shared/content';
import { EVENT, NS, PUBLIC_DEMO_URL, REPO_URL, SKILL_URL, TALK_TITLE } from "../shared/config";
import { downloadFile, keepsakeHTML, keepsakeMarkdown, type SavedNote } from '../shared/keepsake';
import { ACCESORIOS, DEFAULT_CHASQUI, ENCARGOS, EXPRESIONES, LEYENDA, PALLAYS, PIELES, PONCHOS, TOCADOS, chasquiPNG, chasquiSilhouette, chasquiSVG, normalizeChasqui, randomChasqui, type ChasquiOptions } from '../shared/chasqui';
import { claimUniqueName, cleanName, randomName, TOTAL_COMBINATIONS } from '../shared/names';
import { QUESTIONS, type QuestionId } from '../shared/questions';
import { REACTIONS, correctCount, getRealtime, podiumKey, winnerCode, type Reaction, type Realtime, type SlideState, type Votes } from '../shared/realtime';
import { esc } from '../shared/esc';
import { isOnTopic } from '../shared/ask';
import { answerFromTalk, answerWithNano, nanoReady } from '../shared/ask-ai';

const ICONS = { Brain, Check, Download, FileText, Flame, GitBranch, Heart, MessageCircleQuestion, NotebookPen, Radio, Send, Shuffle, Sparkles, SunMoon, Trophy, Map: MapIcon, X };
const REACTION_ICONS: Record<Reaction, IconNode> = { fire: Flame, heart: Heart, mind: Brain, ask: MessageCircleQuestion };
const REACTION_SHORT: Record<Reaction, string> = { fire: 'Fuego', heart: 'Me gusta', mind: '¡Wow!', ask: 'Pregunta' };
const SHAPES: IconNode[] = [Triangle, Diamond, Circle, Square];

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const icon = (node: IconNode, size = 20) => {
  const el = createElement(node);
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  el.setAttribute('aria-hidden', 'true');
  return el.outerHTML;
};
const store = {
  get<T>(k: string, fallback: T): T {
    try {
      return JSON.parse(localStorage.getItem(`${NS}.live.${k}`) ?? 'null') ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(`${NS}.live.${k}`, JSON.stringify(v));
    } catch {
      /* modo privado o cuota llena: seguimos en memoria */
    }
  },
};

// ── Tema (sistema / claro / oscuro) ─────────────────────────────────────
type Theme = 'system' | 'light' | 'dark';
function applyTheme(t: Theme) {
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  store.set('theme', t);
  document.querySelectorAll<HTMLElement>('[data-theme-pick]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themePick === t)));
}

// ── Estado ──────────────────────────────────────────────────────────────
type View = 'live' | 'chasqui' | 'notes';
let rt: Realtime;
let live: SlideState | null = null;
let view: View = 'live';
let name: string | null = store.get('name', null);
let myVotes: Votes = {};
/** Notas GUARDADAS por slide (lo que va a la memoria). */
const notes: Record<string, SavedNote> = store.get('notes', {});
/** Borradores sin guardar: sobreviven a recargas, pero no cuentan como guardados. */
const drafts: Record<string, string> = store.get('drafts', {});
/** Slides que esta persona vio (para "Mis notas"). */
const seen: string[] = store.get('seen', []);
interface ChasquiState {
  name: string;
  encargo: number;
  opts: ChasquiOptions;
  saved: boolean;
  published: boolean;
}
const chasqui: ChasquiState = store.get('chasqui', { name: '', encargo: 0, opts: { ...DEFAULT_CHASQUI }, saved: false, published: false });
chasqui.opts = normalizeChasqui(chasqui.opts);

/** Slide que se muestra en "En vivo" (puede ir detrás del en vivo si hay una nota sin guardar). */
let shownId: string | null = null;

const savedText = (id: string) => notes[id]?.text ?? '';
const draftText = (id: string) => drafts[id] ?? savedText(id);
const isDirty = (id: string | null) => Boolean(id) && draftText(id!) !== savedText(id!);
/** ¿Estamos reteniendo un slide porque hay una nota a medio escribir? (Las preguntas NO se retienen.) */
const holding = () => view === 'live' && isDirty(shownId) && Boolean(live?.id) && live!.id !== shownId && live!.kind !== 'poll';

function setDraft(id: string, text: string) {
  if (text === savedText(id)) delete drafts[id];
  else drafts[id] = text;
  store.set('drafts', drafts);
}
function saveNote(id: string) {
  const text = draftText(id).trim();
  if (text) notes[id] = { text, savedAt: Date.now() };
  else delete notes[id];
  delete drafts[id];
  store.set('notes', notes);
  store.set('drafts', drafts);
}
function discardDraft(id: string) {
  delete drafts[id];
  store.set('drafts', drafts);
}
function markSeen(id: string) {
  if (id && !seen.includes(id)) {
    seen.push(id);
    store.set('seen', seen);
  }
}

async function boot() {
  applyTheme(store.get<Theme>('theme', 'system'));
  createIcons({ icons: ICONS, attrs: { 'stroke-width': 1.75, 'aria-hidden': 'true' } });
  setupMenu();
  setupReactions();
  rt = await getRealtime();
  const forcedLocal = new URLSearchParams(location.search).has('local');
  if (rt.mode === 'local' && !forcedLocal && import.meta.env.VITE_FIREBASE_API_KEY) {
    $('[data-status]').innerHTML = 'Sin conexión en vivo con la pantalla. Reintentando… <button class="link" type="button" onclick="location.reload()">Reintentar</button>';
    setTimeout(() => location.reload(), 20000);
  } else $('[data-status]').textContent = rt.mode === 'local' ? 'Modo ensayo (local) · esperando el deck…' : 'Conectado · esperando el deck…';

  rt.onSlide((s) => {
    const prev = live;
    live = s;
    if (s.id) markSeen(s.id);
    $('[data-status]').textContent = s.total ? `En vivo · ${s.label} · ${s.index + 1}/${s.total}` : 'Conectado · esperando a que empiece la charla…';
    // Cambios dentro del mismo slide (revelar, podio publicado) actualizan por partes.
    const sameSlide = prev?.id === s.id;
    if (view === 'live') renderLive(!sameSlide);
    renderHold();
  });
  rt.onMyVotes((v) => {
    myVotes = v;
    if (view === 'live' && live?.kind === 'poll') updatePoll($('#screen'));
    renderScore();
  });
  renderMe();
  if (name) void rt.join(name).catch(() => undefined);
  render();
}

function renderMe() {
  const el = $('[data-me]');
  el.hidden = !name;
  el.textContent = name ?? '';
}
function renderScore() {
  const el = $('[data-score]');
  const n = correctCount(myVotes, live?.answers ?? {});
  const answered = Object.keys(myVotes).length;
  el.hidden = !answered;
  el.textContent = `${n}/${answered} ✓`;
}

// ── Pantallas ───────────────────────────────────────────────────────────
function render() {
  const screen = $('#screen');
  renderHold();
  if (view === 'chasqui') return renderChasqui(screen);
  if (view === 'notes') return renderNotes(screen);
  if (!name) return renderJoin(screen);
  renderLive(true);
}

/** Propone 3 apodos LIBRES: genera candidatos distintos y descarta los ya reservados. */
async function freshOptions(): Promise<string[]> {
  const pool = new Set<string>();
  while (pool.size < 10) pool.add(randomName());
  rt ??= await getRealtime(); // el menú puede abrirse antes de que termine de conectar
  const taken = await rt.takenNames([...pool]).catch(() => new Set<string>());
  const free = [...pool].filter((n) => !taken.has(n));
  return (free.length >= 3 ? free : [...pool]).slice(0, 3);
}

function renderJoin(screen: HTMLElement, msg = '') {
  screen.dataset.screen = 'join';
  let options: string[] = [];
  const draw = () => {
    screen.innerHTML = `<section class="card-sheet">
      <div class="weave-strip" aria-hidden="true"></div>
      <p class="kicker">¡Allillanchu! · ${esc(EVENT)}</p>
      <h1>Elige tu apodo</h1>
      <p class="muted">Es único en la sala: si alguien ya lo tiene, te damos el mismo con un número. Aparece en el podio y en el muro. Sin correo, sin contraseña.</p>
      <div class="name-options" role="radiogroup" aria-label="Apodos">${
        options.length ? options.map((o, i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-name="${esc(o)}">${esc(o)}</button>`).join('') : '<p class="muted">Buscando apodos libres…</p>'
      }</div>
      <p class="fine" data-join-msg role="status">${esc(msg)}</p>
      <div class="row"><button class="btn ghost" type="button" data-shuffle>${icon(Shuffle, 18)} Otros apodos</button>
      <button class="btn primary" type="button" data-join ${options.length ? '' : 'disabled'}>Entrar</button></div>
      <p class="fine">${TOTAL_COMBINATIONS.toLocaleString('es-PE')} apodos posibles · tus notas se guardan solo en este celular.</p>
    </section>`;
    screen.querySelectorAll<HTMLButtonElement>('[data-name]').forEach((b) =>
      b.addEventListener('click', () => screen.querySelectorAll('[data-name]').forEach((x) => x.setAttribute('aria-checked', String(x === b)))),
    );
    $('[data-shuffle]', screen).addEventListener('click', () => void load());
    $('[data-join]', screen).addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      const pick = screen.querySelector<HTMLElement>('[aria-checked="true"]')?.dataset.name ?? options[0];
      btn.disabled = true;
      $('[data-join-msg]', screen).textContent = 'Reservando tu apodo…';
      try {
        // Reserva atómica: si alguien lo tomó un segundo antes, recibes el mismo con numeración.
        name = await claimUniqueName(pick, (n) => rt.reserveName(n));
        store.set('name', name);
        if (!chasqui.name) chasqui.name = name.slice(0, 18);
        await rt.join(name);
        renderMe();
        render();
      } catch (err) {
        console.error('[live] entrar', err);
        btn.disabled = false;
        $('[data-join-msg]', screen).textContent = 'No se pudo entrar. Revisa tu conexión e inténtalo de nuevo.';
      }
    });
  };
  const load = async () => {
    options = [];
    draw();
    options = await freshOptions();
    if (screen.dataset.screen === 'join') draw();
  };
  void load();
}

/** "En vivo": construye la pantalla una vez por slide; el resto son actualizaciones puntuales. */
function renderLive(force = false) {
  if (!name) return renderJoin($('#screen'));
  const screen = $('#screen');
  if (!holding()) shownId = live?.id || shownId;
  const c = shownId ? SLIDE_BY_ID.get(shownId) : undefined;
  const key = `live:${shownId ?? 'wait'}`;
  if (!force && screen.dataset.screen === key) {
    if (c?.kind === 'poll') updatePoll(screen);
    if (c?.kind === 'podium') renderPodium(screen);
    renderScore();
    return void updateProgress(screen);
  }
  screen.dataset.screen = key;

  if (!c) {
    screen.innerHTML = `<section class="card-sheet"><p class="kicker">Hola, ${esc(name)}</p><h1>La charla está por empezar</h1>
      <p class="muted">Cuando la presentadora avance, aquí verás cada slide con sus ideas clave, las preguntas del podio y podrás tomar notas.</p>
      <button class="btn wide" type="button" data-go-chasqui>${icon(Sparkles, 18)} Crear mi chasqui mientras espero</button></section>`;
    $('[data-go-chasqui]', screen).addEventListener('click', () => go('chasqui'));
    return;
  }
  if (c.kind === 'join') return renderLobby(screen);
  if (c.kind === 'poll' && c.qid) return renderPoll(screen, c.qid);
  if (c.kind === 'podium') return renderPodium(screen);
  if (c.kind === 'wall') return renderWallCta(screen);
  if (c.kind === 'end') return renderEnd(screen);
  renderMirror(screen, c);
}

function updateProgress(screen: HTMLElement) {
  const p = screen.querySelector<HTMLElement>('[data-progress]');
  const label = screen.querySelector<HTMLElement>('[data-on-screen]');
  if (!live?.total || !p || !label) return;
  const idx = SLIDES.findIndex((s) => s.id === shownId);
  p.style.width = `${Math.round(((idx + 1) / live.total) * 100)}%`;
  label.textContent = live.id === shownId ? `En pantalla · ${live.index + 1}/${live.total}` : `Tu nota · slide ${idx + 1}/${live.total}`;
}

function renderMirror(screen: HTMLElement, c: SlideContent) {
  const idx = SLIDES.indexOf(c);
  screen.innerHTML = `<section class="mirror" data-tone="${idx % 4}">
    <div class="mirror-top">
      <span class="live-dot" aria-hidden="true"></span>
      <span data-on-screen>En pantalla</span>
      <span class="mirror-progress" aria-hidden="true"><i data-progress></i></span>
    </div>
    ${c.section ? `<p class="kicker">${esc(c.section)}</p>` : ''}
    <h1>${esc(c.title)}</h1>
    <ul class="mirror-points">${c.summary.map((p, i) => `<li data-tone="${['blue', 'green', 'yellow', 'red'][i % 4]}"><span>${esc(p)}</span></li>`).join('')}</ul>
    ${c.code ? `<figure class="mirror-code"><figcaption>${esc(c.code.file)}</figcaption><pre><code>${esc(c.code.text)}</code></pre></figure>` : ''}
  </section>
  <section class="card-sheet">
    ${noteBoxHTML(c.id, 'Mi nota sobre este slide')}
    ${c.kind === 'demo' ? `<a class="btn wide primary" href="${PUBLIC_DEMO_URL}" target="_blank" rel="noreferrer">${icon(MapIcon, 18)} Abrir Ruta Chasqui (mejor en laptop con Chrome)</a>` : ''}
    <p class="muted small">Mientras escribes, tu pantalla <b>se queda en este slide</b>. Al guardar vuelves al en vivo.</p>
  </section>`;
  bindNoteBox(screen, c.id, { followLiveOnSave: true });
  updateProgress(screen);
}

function noteBoxHTML(id: string, label: string) {
  const saved = notes[id];
  return `<div class="note-box" data-note="${esc(id)}" ${isDirty(id) ? 'data-dirty' : ''}>
    <label><span>${esc(label)}</span><textarea rows="3" maxlength="1200" data-note-text placeholder="Algo que quiero probar, una duda, un enlace…">${esc(draftText(id))}</textarea></label>
    <div class="note-meta">
      <p class="fine" data-note-state role="status">${saved ? `<span class="saved-chip">${icon(Check, 12)} Guardada</span>` : 'Sin guardar · Ctrl/⌘ + Enter guarda'}</p>
      <button class="btn primary" type="button" data-note-save ${isDirty(id) ? '' : 'disabled'}>Guardar nota</button>
    </div>
  </div>`;
}

function bindNoteBox(root: ParentNode, id: string, { followLiveOnSave }: { followLiveOnSave: boolean }) {
  const box = $<HTMLElement>(`[data-note="${CSS.escape(id)}"]`, root);
  const area = $<HTMLTextAreaElement>('[data-note-text]', box);
  const btn = $<HTMLButtonElement>('[data-note-save]', box);
  const state = $('[data-note-state]', box);
  const sync = () => {
    const dirty = isDirty(id);
    box.toggleAttribute('data-dirty', dirty);
    btn.disabled = !dirty;
    state.innerHTML = dirty ? 'Sin guardar · tu pantalla espera' : notes[id] ? `<span class="saved-chip">${icon(Check, 12)} Guardada</span>` : 'Sin guardar · Ctrl/⌘ + Enter guarda';
    renderHold();
  };
  area.addEventListener('input', () => {
    setDraft(id, area.value);
    sync();
  });
  const doSave = () => {
    saveNote(id);
    sync();
    state.innerHTML = `<span class="saved-chip">${icon(Check, 12)} Guardada</span>`;
    if (followLiveOnSave && live?.id && live.id !== id) renderLive();
  };
  btn.addEventListener('click', doSave);
  area.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      doSave();
    }
  });
}

/** Banner fijo: la presentadora avanzó mientras escribías (o ya guardaste y vas detrás). */
function renderHold() {
  const el = $('[data-hold]');
  const behind = view === 'live' && Boolean(live?.id) && Boolean(shownId) && live!.id !== shownId;
  if (!behind) {
    if (!el.hidden) el.hidden = true;
    return;
  }
  const dirty = isDirty(shownId);
  const sig = `${live!.id}:${dirty}`;
  if (el.dataset.for !== sig || el.hidden) {
    el.dataset.for = sig;
    const next = SLIDE_BY_ID.get(live!.id);
    const where = `“${esc(next?.title ?? live!.label)}” (${live!.index + 1}/${live!.total})`;
    el.innerHTML = dirty
      ? `<p><span class="pulse" aria-hidden="true"></span><b>La charla avanzó</b> a ${where}. Tu pantalla te espera hasta que guardes tu nota.</p>
        <div class="row"><button class="btn" type="button" data-hold-discard>Descartar cambios</button><button class="btn primary" type="button" data-hold-save>Guardar y seguir en vivo</button></div>`
      : `<p><span class="pulse" aria-hidden="true"></span>La charla va en ${where}.</p>
        <div class="row"><button class="btn primary" type="button" data-hold-go>Ir al en vivo</button></div>`;
    const jump = () => {
      el.hidden = true;
      shownId = live!.id;
      renderLive(true);
    };
    el.querySelector('[data-hold-save]')?.addEventListener('click', () => (shownId && saveNote(shownId), jump()));
    el.querySelector('[data-hold-discard]')?.addEventListener('click', () => (shownId && discardDraft(shownId), jump()));
    el.querySelector('[data-hold-go]')?.addEventListener('click', jump);
  }
  el.hidden = false;
}

function renderLobby(screen: HTMLElement) {
  screen.innerHTML = `<section class="card-sheet">
    <div class="weave-strip" aria-hidden="true"></div>
    <p class="kicker">Hola, ${esc(name)}</p>
    <h1>¡Estás dentro!</h1>
    <div class="lobby-dolls" aria-hidden="true">${[0, 1, 2, 3].map((i) => chasquiSVG({ poncho: i, pallay: i % 5, tocado: (i * 2) % 6, piel: (i + 1) % 5, accesorio: (i + 1) % 7, expresion: i % 4 })).join('')}</div>
    <p class="muted">En cada slide verás las ideas clave y podrás escribir tus notas. Hay <b>3 preguntas</b> por el podio: responde rápido. Si estás escribiendo, <b>la app no te cambia de slide</b> hasta que guardes.</p>
    <p class="legend">${esc(LEYENDA)}</p>
    <button class="btn wide primary" type="button" data-go-chasqui>${icon(Sparkles, 18)} Crear mi chasqui</button>
  </section>`;
  $('[data-go-chasqui]', screen).addEventListener('click', () => go('chasqui'));
}

// ── Preguntas del podio ─────────────────────────────────────────────────
const closed = (qid: QuestionId) => Boolean(live?.revealed?.[qid]);
function renderPoll(screen: HTMLElement, qid: QuestionId) {
  const q = QUESTIONS[qid];
  screen.innerHTML = `<section class="poll" data-q="${qid}">
    <div class="poll-head"><p class="kicker">Pregunta ${qid.slice(1)} de 3 · ${esc(q.topic)}</p><span class="score-chip" data-poll-score></span></div>
    <h1>${esc(q.text)}</h1>
    <div class="answers">${q.options.map((o, i) => `<button type="button" class="answer" data-opt="${o.id}"><span class="shape">${icon(SHAPES[i], 22)}</span><span>${esc(o.label)}</span></button>`).join('')}</div>
    <p class="poll-msg" data-msg role="status"></p>
    <p class="fine">Acertar: 500 puntos + hasta 500 por rapidez. Una sola respuesta por pregunta.</p>
  </section>`;
  screen.querySelectorAll<HTMLButtonElement>('.answer').forEach((b) =>
    b.addEventListener('click', async () => {
      if (myVotes[qid] || closed(qid) || b.classList.contains('pending')) return;
      b.classList.add('pending');
      const msg = $('[data-msg]', screen);
      msg.className = 'poll-msg';
      msg.textContent = 'Enviando…';
      navigator.vibrate?.(20);
      try {
        await rt.vote(qid, b.dataset.opt!);
        if (!myVotes[qid]) myVotes = { ...myVotes, [qid]: b.dataset.opt! };
        updatePoll(screen);
      } catch (err) {
        console.error('[live] voto', err);
        b.classList.remove('pending');
        msg.className = 'poll-msg bad';
        msg.textContent = closed(qid) ? 'La pregunta ya se cerró.' : 'No se pudo enviar tu respuesta. Revisa tu conexión y toca otra vez.';
      }
    }),
  );
  updatePoll(screen);
}
function updatePoll(screen: HTMLElement) {
  const qid = screen.querySelector<HTMLElement>('.poll')?.dataset.q as QuestionId | undefined;
  if (!qid) return;
  const mine = myVotes[qid];
  // La respuesta correcta solo existe en el celular cuando la presentadora revela.
  const answer = live?.revealed?.[qid] ? live?.answers?.[qid] : undefined;
  screen.querySelectorAll<HTMLButtonElement>('.answer').forEach((b) => {
    const opt = b.dataset.opt;
    b.disabled = Boolean(mine) || closed(qid);
    b.classList.remove('pending');
    b.toggleAttribute('data-mine', opt === mine);
    b.toggleAttribute('data-correct', Boolean(answer) && opt === answer!.correct);
    b.toggleAttribute('data-wrong', Boolean(answer) && opt === mine && mine !== answer!.correct);
  });
  const msg = $('[data-msg]', screen);
  if (answer) {
    const ok = mine === answer.correct;
    msg.className = `poll-msg ${ok ? 'ok' : mine ? 'bad' : ''}`;
    msg.innerHTML = `${mine ? (ok ? `${icon(Check, 18)} <b>¡Correcto!</b>` : '<b>Casi.</b>') : '<b>No respondiste a tiempo.</b>'} ${esc(answer.explain)}`;
  } else if (mine) {
    msg.className = 'poll-msg';
    msg.innerHTML = `${icon(Send, 18)} Respuesta enviada. Mira la pantalla para el resultado.`;
  } else msg.textContent = '';
  const chip = screen.querySelector<HTMLElement>('[data-poll-score]');
  if (chip) chip.textContent = `${correctCount(myVotes, live?.answers ?? {})} aciertos`;
}

const PLACES = ['Primer lugar', 'Segundo lugar', 'Tercer lugar'];
const MEDALS = ['🥇', '🥈', '🥉'];
let celebratedPos = -1;
function renderPodium(screen: HTMLElement) {
  screen.dataset.screen = `live:${shownId}`;
  const myKey = podiumKey(rt.uid());
  const podium = live?.podium ?? [];
  // Cada celular se reconoce por su clave larga (no por el código corto, que podría repetirse).
  const pos = podium.findIndex((p) => (p.key ? p.key === myKey : p.code === winnerCode(rt.uid())));
  const myCode = pos >= 0 ? podium[pos].code : winnerCode(rt.uid());
  const onPodium = pos >= 0 && pos < 3;
  const me = pos >= 0 ? podium[pos] : null;
  const myAvatar = chasqui.saved ? chasquiSVG(chasqui.opts, chasqui.name) : me?.opts ? chasquiSVG(me.opts, me.name) : '';
  screen.innerHTML = `<section class="card-sheet podium-card ${onPodium ? `winner place-${pos + 1}` : ''}">
    ${onPodium ? '<div class="confetti" aria-hidden="true">' + Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join('') + '</div>' : ''}
    <p class="kicker">${icon(Trophy, 16)} Podio</p>
    ${
      onPodium
        ? `<p class="medal-big" aria-hidden="true">${MEDALS[pos]}</p>
           <h1>¡Entraste al podio, ${esc(name)}!</h1>
           <p class="place-chip">${PLACES[pos]} · ${me!.score.toLocaleString('es-PE')} puntos</p>
           ${myAvatar ? `<div class="winner-avatar">${myAvatar}</div>` : ''}
           <p>Acércate al escenario y muestra este código:</p><p class="code">${myCode}</p>`
        : pos >= 3
          ? `<h1>¡Quedaste en el puesto ${pos + 1}!</h1><p class="muted">Estás en el top 10 con ${me!.score.toLocaleString('es-PE')} puntos. ¡Gran carrera, chasqui!</p>`
          : `<h1>¡Gracias por jugar!</h1><p class="muted">Acertaste ${correctCount(myVotes, live?.answers ?? {})} de 3. Para entrar al podio hay que acertar al menos una; los bonos suben posiciones. El podio está en la pantalla.</p>`
    }
    ${podium.length ? `<ol class="podium-list">${podium.slice(0, 5).map((p, i) => `<li ${i === pos ? 'data-me' : ''}><span class="pl-avatar">${p.opts ? chasquiSVG(p.opts, p.name) : chasquiSilhouette()}</span><span class="pl-name">${i + 1}. ${esc(p.name)}</span><b>${p.score.toLocaleString('es-PE')}</b></li>`).join('')}</ol>` : '<p class="muted">Esperando el podio…</p>'}
    <p class="fine">Tu código: <b>${myCode}</b></p>
  </section>`;
  // Vibra una sola vez cuando entras al podio.
  if (onPodium && celebratedPos !== pos) {
    celebratedPos = pos;
    navigator.vibrate?.([120, 60, 120, 60, 240]);
  }
}

function renderWallCta(screen: HTMLElement) {
  screen.innerHTML = `<section class="card-sheet">
    <p class="kicker">Muro de chasquis</p>
    <h1>${chasqui.published ? '¡Tu chasqui está en la pantalla!' : '¿Ya creaste tu chasqui?'}</h1>
    ${chasqui.saved ? `<div class="end-doll">${chasquiSVG(chasqui.opts, chasqui.name)}<div><b>${esc(chasqui.name)}</b><span>“${esc(ENCARGOS[chasqui.encargo])}”</span></div></div>` : ''}
    <p class="muted">Se dibuja en tu celular; al muro solo viajan las opciones que elegiste. Publicarlo suma <b>+100</b> al podio.</p>
    <button class="btn wide primary" type="button" data-go-chasqui>${icon(Sparkles, 18)} ${chasqui.saved ? 'Editar mi chasqui' : 'Crear mi chasqui'}</button>
  </section>`;
  $('[data-go-chasqui]', screen).addEventListener('click', () => go('chasqui'));
}

// ── Memoria ─────────────────────────────────────────────────────────────
function keepsakeInput() {
  return { nickname: name, notes, chasqui: chasqui.saved ? { name: chasqui.name, encargo: chasqui.encargo, opts: chasqui.opts } : null };
}
const slug = () => `memoria-webmcp-en-accion-devfest-cusco${name ? '-' + name.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase() : ''}`;

function keepsakeButtons() {
  return `<button class="btn wide primary" type="button" data-dl-pdf>${icon(Download, 18)} Descargar memoria (PDF)</button>
    <div class="row">
      <button class="btn" type="button" data-dl-html>${icon(FileText, 18)} HTML</button>
      <button class="btn" type="button" data-dl-md>${icon(FileText, 18)} Markdown</button>
    </div>
    <p class="fine" data-pdf-msg role="status"></p>
    ${chasqui.saved ? `<button class="btn wide" type="button" data-dl-chasqui>${icon(Download, 18)} Descargar mi chasqui (PNG)</button>` : ''}
    <button class="btn wide ghost" type="button" data-share>${icon(Send, 18)} Compartir</button>`;
}
/** PDF con pdf-lib: se carga al pulsar (import dinámico) y se genera en el celular. */
async function makePDF(): Promise<Blob> {
  const { keepsakePDF } = await import('../shared/keepsake-pdf');
  return keepsakePDF(keepsakeInput());
}
function bindKeepsake(root: ParentNode) {
  root.querySelector('[data-dl-pdf]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const msg = root.querySelector<HTMLElement>('[data-pdf-msg]');
    btn.disabled = true;
    if (msg) msg.textContent = 'Generando tu PDF en el celular…';
    try {
      downloadFile(`${slug()}.pdf`, await makePDF());
      if (msg) msg.textContent = 'Listo: revisa tus descargas.';
    } catch (err) {
      console.error('[memoria] PDF', err);
      if (msg) msg.textContent = `No se pudo generar el PDF (${(err as Error)?.message ?? err}). Prueba con HTML.`;
    } finally {
      btn.disabled = false;
    }
  });
  root.querySelector('[data-dl-html]')?.addEventListener('click', () => downloadFile(`${slug()}.html`, keepsakeHTML(keepsakeInput()), 'text/html;charset=utf-8'));
  root.querySelector('[data-dl-md]')?.addEventListener('click', () => downloadFile(`${slug()}.md`, keepsakeMarkdown(keepsakeInput()), 'text/markdown;charset=utf-8'));
  root.querySelector('[data-dl-chasqui]')?.addEventListener('click', async () => downloadFile(`chasqui-${slug()}.png`, await chasquiPNG(chasqui)));
  root.querySelector('[data-share]')?.addEventListener('click', async () => {
    try {
      const file = new File([await makePDF()], `${slug()}.pdf`, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ title: `Memoria · ${TALK_TITLE}`, files: [file] });
      else if (navigator.share) await navigator.share({ title: `Memoria · ${TALK_TITLE}`, text: keepsakeMarkdown(keepsakeInput()) });
      else {
        await navigator.clipboard.writeText(keepsakeMarkdown(keepsakeInput()));
        alert('Memoria copiada al portapapeles (Markdown).');
      }
    } catch {
      /* la persona canceló */
    }
  });
}

function renderEnd(screen: HTMLElement) {
  const n = Object.keys(notes).length;
  screen.innerHTML = `<section class="card-sheet keepsake">
    <div class="weave-strip" aria-hidden="true"></div>
    <p class="kicker">¡Sulpayki! (gracias en quechua)</p>
    <h1>Tu memoria de la charla</h1>
    <p class="muted">Un resumen con lo más importante de cada slide, tus notas${chasqui.saved ? ' y tu chasqui' : ''}. Se genera en tu celular; ábrelo sin internet o imprímelo.</p>
    <div class="stats"><span>${SLIDES.filter((s) => s.inSummary).length} ideas clave</span><span>${n} ${n === 1 ? 'nota' : 'notas'}</span><span>${chasqui.saved ? '1 chasqui' : 'sin chasqui'}</span></div>
    ${chasqui.saved ? `<div class="end-doll">${chasquiSVG(chasqui.opts, chasqui.name)}<div><b>${esc(chasqui.name)}</b><span>“${esc(ENCARGOS[chasqui.encargo])}”</span></div></div>` : `<button class="btn wide" type="button" data-go-chasqui>${icon(Sparkles, 18)} Crear mi chasqui para la memoria</button>`}
    ${keepsakeButtons()}
    <a class="btn wide" href="${SKILL_URL}" target="_blank" rel="noreferrer">${icon(Sparkles, 18)} Guía WebMCP para tu agente de código</a>
    <p class="fine">Instálala en Claude Code, Gemini CLI o Cursor y pídele: <i>“agrega WebMCP a mi web”</i>. Aplica las 10 reglas de la charla en tu proyecto.</p>
    <a class="btn wide ghost" href="${REPO_URL}" target="_blank" rel="noreferrer">${icon(GitBranch, 18)} Ver el repositorio</a>
  </section>`;
  screen.querySelector('[data-go-chasqui]')?.addEventListener('click', () => go('chasqui'));
  bindKeepsake(screen);
}

// ── Mis notas (todas) + memoria ─────────────────────────────────────────
function renderNotes(screen: HTMLElement) {
  screen.dataset.screen = 'notes';
  const list = SLIDES.filter((s) => seen.includes(s.id) || notes[s.id] || drafts[s.id]).filter((s) => s.kind === 'content' || s.kind === 'demo');
  let section = '';
  screen.innerHTML = `<section class="card-sheet">
    <div class="creator-head"><p class="kicker">Mis notas</p><button class="icon-btn" type="button" data-close aria-label="Volver al en vivo">${icon(X, 20)}</button></div>
    <h1>Lo que me llevo</h1>
    <p class="muted small">Edita cualquier nota y guárdala. La memoria incluye el resumen de <b>todos</b> los slides, aunque hayas llegado tarde.</p>
    ${keepsakeButtons()}
    ${
      list.length
        ? `<ol class="notes-list">${list
            .map((s) => {
              const head = s.section && s.section !== section ? `<p class="section-label">${esc((section = s.section))}</p>` : '';
              return `${head}<li><h3>${esc(s.title)}</h3><ul class="pts">${s.summary.slice(0, 2).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>${noteBoxHTML(s.id, 'Mi nota')}</li>`;
            })
            .join('')}</ol>`
        : '<p class="muted">Se irán llenando mientras avanza la charla.</p>'
    }
    <button class="btn wide ghost" type="button" data-back>Volver al en vivo</button>
  </section>`;
  list.forEach((s) => bindNoteBox(screen, s.id, { followLiveOnSave: false }));
  bindKeepsake(screen);
  $('[data-back]', screen).addEventListener('click', () => go('live'));
  $('[data-close]', screen).addEventListener('click', () => go('live'));
}

// ── Crea tu chasqui (todo en el dispositivo) ───────────────────────────
function renderChasqui(screen: HTMLElement) {
  screen.dataset.screen = 'chasqui';
  chasqui.name ||= (name ?? '').slice(0, 18);
  screen.innerHTML = `<section class="card-sheet creator">
    <div class="creator-head"><p class="kicker">Crea tu chasqui</p><button class="icon-btn" type="button" data-close aria-label="Cerrar">${icon(X, 20)}</button></div>
    <div class="doll-preview" data-preview></div>
    <p class="legend">${esc(LEYENDA)}</p>
    <label class="field"><span>Nombre de tu chasqui</span><input data-f="name" maxlength="18" value="${esc(chasqui.name)}" autocomplete="off" /></label>
    <fieldset class="field"><legend>El encargo que lleva tu quipu</legend><div class="chips penas" role="radiogroup">${ENCARGOS.map(
      (p, i) => `<button type="button" role="radio" aria-checked="${chasqui.encargo === i}" data-encargo="${i}">${esc(p)}</button>`,
    ).join('')}</div></fieldset>
    <fieldset class="field"><legend>Poncho</legend><div class="palettes" role="radiogroup">${PONCHOS.map(
      (t, i) => `<button type="button" role="radio" aria-checked="${chasqui.opts.poncho === i}" data-opt="poncho" data-v="${i}"><i>${t.c.map((c) => `<b style="background:${c}"></b>`).join('')}</i>${esc(t.label)}</button>`,
    ).join('')}</div></fieldset>
    <div data-opts></div>
    <button class="btn ghost" type="button" data-random>${icon(Shuffle, 16)} Sorpréndeme</button>
    <p class="fine">Se dibuja <b>en tu celular</b> (SVG). Si lo publicas, al muro solo viajan tus elecciones.</p>
    <div class="row">
      <button class="btn" type="button" data-download>${icon(Download, 18)} Descargar PNG</button>
      <button class="btn primary" type="button" data-save>${icon(Check, 18)} ${chasqui.saved ? 'Guardado' : 'Guardar en mi memoria'}</button>
    </div>
    <button class="btn wide" type="button" data-publish>${icon(Send, 18)} ${chasqui.published ? 'Actualizar en el muro' : 'Publicar en el muro (+100)'}</button>
    <p class="fine" data-msg role="status"></p>
  </section>`;

  const persist = () => store.set('chasqui', chasqui);
  const preview = () => {
    $('[data-preview]', screen).innerHTML = `${chasquiSVG(chasqui.opts, `Chasqui ${chasqui.name}`)}<span class="pena-bubble">“${esc(ENCARGOS[chasqui.encargo])}”</span>`;
  };
  const chips = (key: keyof ChasquiOptions, label: string, labels: readonly string[]) =>
    `<p class="mini">${label}</p><div class="chips" role="radiogroup" aria-label="${label}">${labels
      .map((l, i) => `<button type="button" role="radio" aria-checked="${chasqui.opts[key] === i}" data-opt="${key}" data-v="${i}">${esc(l)}</button>`)
      .join('')}</div>`;
  $('[data-opts]', screen).innerHTML = `${chips('pallay', 'Pallay (diseño tejido)', PALLAYS)}${chips('tocado', 'Tocado', TOCADOS)}
    <p class="mini">Piel</p><div class="swatches" role="radiogroup" aria-label="Piel">${PIELES.map(
      (c, i) => `<button type="button" class="swatch" role="radio" aria-label="Tono de piel ${i + 1}" aria-checked="${chasqui.opts.piel === i}" data-opt="piel" data-v="${i}" style="--swatch:${c}"></button>`,
    ).join('')}</div>
    ${chips('accesorio', 'Lo que lleva', ACCESORIOS)}${chips('expresion', 'Expresión', EXPRESIONES)}`;
  const changed = () => {
    persist();
    preview();
  };
  $('.creator', screen).addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-opt],[data-encargo]');
    if (!b) return;
    if (b.dataset.encargo) chasqui.encargo = Number(b.dataset.encargo);
    else chasqui.opts = { ...chasqui.opts, [b.dataset.opt as keyof ChasquiOptions]: Number(b.dataset.v) };
    b.parentElement!.querySelectorAll('[role="radio"]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    changed();
  });
  $('[data-f="name"]', screen).addEventListener('input', (e) => {
    chasqui.name = (e.target as HTMLInputElement).value;
    changed();
  });
  $('[data-random]', screen).addEventListener('click', () => {
    chasqui.opts = randomChasqui();
    chasqui.encargo = Math.floor(Math.random() * ENCARGOS.length);
    persist();
    renderChasqui(screen);
  });
  $('[data-close]', screen).addEventListener('click', () => go('live'));
  $('[data-download]', screen).addEventListener('click', async () => {
    chasqui.name = cleanName(chasqui.name || name || '');
    downloadFile(`chasqui-${slug()}.png`, await chasquiPNG(chasqui));
  });
  $('[data-save]', screen).addEventListener('click', (e) => {
    chasqui.name = cleanName(chasqui.name || name || '');
    chasqui.saved = true;
    persist();
    (e.currentTarget as HTMLElement).innerHTML = `${icon(Check, 18)} Guardado`;
    $('[data-msg]', screen).textContent = 'Listo: tu chasqui estará en tu memoria de la charla.';
  });
  $('[data-publish]', screen).addEventListener('click', async () => {
    const msg = $('[data-msg]', screen);
    chasqui.name = cleanName(chasqui.name || name || '');
    msg.textContent = 'Publicando…';
    try {
      await rt.publishChasqui({ name: chasqui.name, encargo: chasqui.encargo, opts: chasqui.opts });
      chasqui.published = true;
      chasqui.saved = true;
      persist();
      msg.textContent = '¡Listo! Tu chasqui está en el muro y en tu memoria.';
    } catch (err) {
      console.error(err);
      msg.textContent = 'No se pudo publicar. Revisa tu conexión e inténtalo de nuevo.';
    }
  });
  preview();
}

// ── Menú y reacciones ───────────────────────────────────────────────────
function go(v: View) {
  view = v;
  closeMenu();
  render();
  scrollTo({ top: 0 });
}

const menuBtn = () => $<HTMLButtonElement>('.menu-btn');
const menuPanel = () => $('.menu-panel');
function closeMenu() {
  menuPanel().hidden = true;
  menuBtn().setAttribute('aria-expanded', 'false');
  menuBtn().setAttribute('aria-label', 'Abrir menú');
}
function setupMenu() {
  menuBtn().addEventListener('click', () => {
    const open = menuPanel().hidden;
    menuPanel().hidden = !open;
    menuBtn().setAttribute('aria-expanded', String(open));
    menuBtn().setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    if (open) menuPanel().querySelector<HTMLElement>('button, a')?.focus();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go as View)));
  const row = $('[data-theme-row]');
  row.innerHTML = `<button type="button" data-theme-pick="system">${icon(SunMoon, 16)} Auto</button><button type="button" data-theme-pick="light">${icon(Sun, 16)} Claro</button><button type="button" data-theme-pick="dark">${icon(Moon, 16)} Oscuro</button>`;
  row.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-theme-pick]')?.dataset.themePick as Theme | undefined;
    if (t) applyTheme(t);
  });
  applyTheme(store.get<Theme>('theme', 'system'));
  addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu());
  addEventListener('pointerdown', (e) => {
    if (!menuPanel().hidden && !menuPanel().contains(e.target as Node) && !menuBtn().contains(e.target as Node)) closeMenu();
  });
}

function setupReactions() {
  const bar = $('[data-reactions]');
  bar.innerHTML = (Object.keys(REACTIONS) as Reaction[])
    .map((r) => `<button type="button" data-r="${r}" title="${REACTIONS[r].label}" style="--c:${REACTIONS[r].color}">${icon(REACTION_ICONS[r], 24)}<span>${REACTION_SHORT[r]}</span></button>`)
    .join('');
  let last = 0;
  bar.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-r]');
    if (!b || !rt) return;
    const r = b.dataset.r as Reaction;
    if (r === 'ask') return openAsk();
    if (Date.now() - last < 900) return; // las reglas también lo limitan
    last = Date.now();
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
    navigator.vibrate?.(15);
    await rt.react(r).catch(() => undefined);
  });
}

// Preguntas para la presentadora: texto libre, por eso NO se proyecta (solo ella las lee).
// Solo sobre el tema de la charla: se elige el tema y el texto debe mencionar algo relacionado.
const ASK_TOPICS = ['MCP', 'WebMCP', 'Web agéntica', 'La demo', 'Seguridad', 'Gemini Nano / IA en el navegador'] as const;
let lastAsk = 0;
function openAsk() {
  const dlg = document.createElement('dialog');
  dlg.className = 'ask-sheet';
  dlg.innerHTML = `<form>
    <h2>${icon(MessageCircleQuestion, 22)} ¿Tienes una pregunta sobre la charla?</h2>
    <p class="fine">Solo preguntas sobre <b>MCP, WebMCP y la web agéntica</b>. Le llegan a Vanessa con tu apodo${name ? ` <b>${esc(name)}</b>` : ''}; no se proyectan. Al enviar, la IA te da una primera respuesta en tu dispositivo y Vanessa responde al final.</p>
    <fieldset class="field"><legend>Tema</legend><div class="chips" role="radiogroup" aria-label="Tema">${ASK_TOPICS.map((tp, i) => `<button type="button" role="radio" aria-checked="${i === 1}" data-topic="${esc(tp)}">${esc(tp)}</button>`).join('')}</div></fieldset>
    <textarea name="q" rows="4" maxlength="280" required placeholder="Ej.: ¿Cómo marco una tool como irreversible en WebMCP?"></textarea>
    <p class="fine" data-ask-msg role="status"></p>
    <div class="row"><button class="btn ghost" type="button" data-cancel>Cancelar</button><button class="btn primary" type="submit">${icon(Send, 18)} Enviar</button></div>
  </form>`;
  document.body.append(dlg);
  const close = () => {
    dlg.close();
    dlg.remove();
  };
  dlg.addEventListener('cancel', () => dlg.remove());
  dlg.querySelectorAll<HTMLButtonElement>('[data-topic]').forEach((b) =>
    b.addEventListener('click', () => dlg.querySelectorAll('[data-topic]').forEach((x) => x.setAttribute('aria-checked', String(x === b)))),
  );
  $('[data-cancel]', dlg).addEventListener('click', close);
  dlg.querySelector('form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = dlg.querySelector('textarea')!.value.trim();
    const topic = dlg.querySelector<HTMLElement>('[data-topic][aria-checked="true"]')?.dataset.topic ?? 'WebMCP';
    const msg = $('[data-ask-msg]', dlg);
    if (!text) return;
    if (!isOnTopic(text)) {
      msg.textContent = 'Tu pregunta no parece ser sobre la charla. Escríbela sobre MCP, WebMCP, agentes, la demo o la seguridad de las tools.';
      return;
    }
    if (Date.now() - lastAsk < 15000) return void (msg.textContent = 'Espera unos segundos antes de enviar otra.');
    const sendBtn = dlg.querySelector<HTMLButtonElement>('[type="submit"]')!;
    sendBtn.disabled = true;
    msg.textContent = 'Enviando…';
    try {
      await rt.ask({ name: name ?? 'Anónimo', text: `[${topic}] ${text}`.slice(0, 280), slide: (live?.label ?? '').slice(0, 80) });
      void rt.react('ask').catch(() => undefined);
      lastAsk = Date.now();
      msg.textContent = '';
      void showAnswer(dlg, text, close);
    } catch (err) {
      console.error('[live] pregunta', err);
      sendBtn.disabled = false;
      msg.textContent = 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.';
    }
  });
  dlg.showModal();
  dlg.querySelector('textarea')!.focus();
}

// Markdown mínimo de la respuesta de Nano: bloques ```código```, `código` y **negritas** (todo escapado).
function miniMarkdown(md: string) {
  return md
    .split(/```[a-zA-Z]*\n?/)
    .map((part, i) => (i % 2 ? `<pre><code>${esc(part.replace(/\n$/, ''))}</code></pre>` : esc(part).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')))
    .join('');
}

// Respuesta inmediata en el dispositivo del asistente: Gemini Nano si está listo; si no, la charla.
async function showAnswer(dlg: HTMLDialogElement, question: string, close: () => void) {
  const form = dlg.querySelector('form')!;
  const pollOpen = live?.kind === 'poll' && live.qid && !live.revealed?.[live.qid];
  const nano = !pollOpen && (await nanoReady());
  form.innerHTML = `<h2>${icon(Sparkles, 22)} Tu pregunta</h2>
    <p class="ask-q">${esc(question)}</p>
    <section class="ask-answer" aria-live="polite">
      <p class="ask-src" data-src></p>
      <div class="ask-text" data-text><span class="ask-dots" aria-label="Pensando"><i></i><i></i><i></i></span></div>
    </section>
    <p class="fine">✓ Vanessa también recibió tu pregunta${name ? ` como <b>${esc(name)}</b>` : ''} y la responderá al final.</p>
    <div class="row"><button class="btn primary" type="button" data-done>Listo</button></div>`;
  const src = $('[data-src]', form);
  const out = $('[data-text]', form);
  const ctrl = new AbortController();
  const done = () => (ctrl.abort(), close());
  $('[data-done]', form).addEventListener('click', done);
  dlg.addEventListener('close', () => ctrl.abort(), { once: true });
  const fallback = (why = '') => {
    const a = answerFromTalk(question);
    src.textContent = `Según la charla${why}`;
    out.textContent = a || 'Esta no la cubre la charla tal cual: Vanessa la responde al final.';
  };
  if (pollOpen) {
    src.textContent = 'Pregunta del podio en curso';
    out.textContent = 'Te respondo cuando termine la pregunta del podio: así nadie juega con ventaja. Vanessa ya tiene tu pregunta.';
    return;
  }
  if (!nano) return fallback();
  src.textContent = 'Gemini Nano · en tu dispositivo, sin servidor';
  try {
    const a = await answerWithNano(question, (t) => (out.innerHTML = miniMarkdown(t)), ctrl.signal);
    if (!a) fallback(' (Nano no respondió)');
  } catch (err) {
    if (ctrl.signal.aborted) return;
    console.warn('[live] Gemini Nano', err);
    fallback(' (Gemini Nano no pudo responder)');
  }
}

void boot();
