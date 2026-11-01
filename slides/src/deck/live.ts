// Lado "deck" de la experiencia en vivo.
//  · La presentadora publica { index, id, kind, qid } del slide actual → los celulares cambian
//    de pantalla (salvo quien está escribiendo una nota: su celular espera a que guarde).
//  · El deck es el ÚNICO que escucha las colecciones (asistentes, votos, chasquis, reacciones)
//    y publica agregados (resultados, podio) en momentos puntuales: así 300+ celulares
//    leen un único documento.
//  · Las respuestas del podio son privadas: el deck las carga de Firestore (solo la
//    presentadora puede leerlas) y publica UNA al revelar su pregunta.
//  · La consola de la presentadora (/presenter/) controla este deck por BroadcastChannel.
import QRCode from 'qrcode';
import { Brain, Check, Circle, Diamond, Flame, Heart, MessageCircleQuestion, Square, Triangle, createElement, type IconNode } from 'lucide';
import { SLIDE_BY_ID } from '../shared/content';
import { DEMO_URL, NS, PUBLIC_SLIDES_URL, REPO_URL, SESSION_ID, prettyUrl, publicLiveUrl } from '../shared/config';
import { ENCARGOS, chasquiSVG } from '../shared/chasqui';
import { QUESTIONS, QUESTION_IDS, parseAnswerKey, type AnswerKey, type QuestionId } from '../shared/questions';
import { REACTIONS, getRealtime, scoreFor, tally, winnerCode, type AudienceQuestion, type ChasquiData, type Player, type Reaction, type SlideState, type VoteRecord } from '../shared/realtime';
import { esc } from '../shared/esc';

type DeckStage = HTMLElement & { goTo(i: number): void; next(): void; prev(): void };

const REACTION_ICONS: Record<Reaction, IconNode> = { fire: Flame, heart: Heart, mind: Brain, ask: MessageCircleQuestion };
export const SHAPES: IconNode[] = [Triangle, Diamond, Circle, Square];

function icon(node: IconNode, size = 28, color?: string): SVGElement {
  const el = createElement(node);
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  el.setAttribute('aria-hidden', 'true');
  if (color) el.setAttribute('color', color);
  return el;
}

/** Mensajes entre el deck y la consola de la presentadora (misma máquina, sin red). */
export type PresenterMsg =
  | { type: 'state'; index: number; total: number; id: string; players: number; chasquis: number; questions: number; votes: number; live: boolean; mode: string }
  | { type: 'goto'; index: number }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'reveal' }
  | { type: 'hello' };

export async function initLive(stage: DeckStage, sections: HTMLElement[]) {
  // QR (no dependen de la conexión)
  const liveUrl = publicLiveUrl();
  const qr = (text: string) => QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1e1e1e', light: '#ffffff' } });
  // Slides publicados SIN modo presentadora (nunca localhost ni ?presenter): para volver a ver la charla.
  const slidesUrl = PUBLIC_SLIDES_URL.replace(/\/$/, '') + '/';
  const [qrLive, qrRepo, qrDemo, qrSlides] = await Promise.all([qr(liveUrl), qr(REPO_URL), qr(new URL('/', DEMO_URL).toString()), qr(slidesUrl)]);
  document.querySelectorAll('[data-qr="live"]').forEach((el) => (el.innerHTML = qrLive));
  document.querySelectorAll('[data-qr="repo"]').forEach((el) => (el.innerHTML = qrRepo));
  document.querySelectorAll('[data-qr="demo"]').forEach((el) => (el.innerHTML = qrDemo));
  document.querySelectorAll('[data-qr="slides"]').forEach((el) => (el.innerHTML = qrSlides));
  document.querySelectorAll('[data-slides-url]').forEach((el) => (el.textContent = prettyUrl(slidesUrl)));
  document.querySelectorAll('[data-live-url]').forEach((el) => (el.textContent = prettyUrl(liveUrl)));
  buildPolls();
  dispatchEvent(new Event('tweakchange'));

  const rt = await getRealtime();
  const presenterLink = new URLSearchParams(location.search).has('presenter');
  let presenter = rt.isPresenterSession();
  let players: Player[] = [];
  let votes: VoteRecord[] = [];
  let chasquis: ChasquiData[] = [];
  let questions: AudienceQuestion[] = [];
  let slide: SlideState | null = null;
  let answers: AnswerKey = {};
  let unsubQuestions: (() => void) | null = null;
  let qaError = '';

  const bc = new BroadcastChannel(`${NS}-presenter-${SESSION_ID}`);
  const badge = document.querySelector<HTMLElement>('.presenter-badge')!;
  const warn = document.createElement('button');
  warn.type = 'button';
  warn.className = 'broadcast-warn';
  warn.hidden = true;
  warn.textContent = 'Los celulares NO siguen el deck · toca para iniciar sesión con GitHub';
  warn.addEventListener('click', () => document.dispatchEvent(new CustomEvent('deck:present')));
  document.body.append(warn);

  const syncPresenterUi = () => {
    badge.hidden = !presenter;
    warn.hidden = presenter || !presenterLink || rt.mode !== 'firebase';
    document.querySelectorAll<HTMLElement>('[data-presenter-only]').forEach((el) => (el.hidden = presenter || !presenterLink || rt.mode === 'local'));
    document.querySelectorAll<HTMLElement>('[data-presenter-ui]').forEach((el) => (el.hidden = !presenter));
    document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((b) => (b.hidden = !presenter));
    document.querySelectorAll('[data-q-count]').forEach((el) => (el.textContent = String(questions.length)));
    const missing = QUESTION_IDS.filter((q) => !answers[q]);
    document.querySelectorAll('[data-answers-status]').forEach((el) => (el.textContent = missing.length ? `faltan ${missing.join(', ')}` : '3/3 cargadas'));
  };

  const loadAnswers = async () => {
    if (!presenter) return;
    answers = (await rt.loadAnswers().catch(() => null)) ?? {};
    // Ensayo en local: si existe slides/answers.json (no versionado, no entra al build), se carga solo.
    if (!Object.keys(answers).length && import.meta.env.DEV) {
      try {
        const res = await fetch('/answers.json', { cache: 'no-store' });
        if (res.ok) {
          answers = parseAnswerKey(await res.json());
          await rt.saveAnswers(answers);
        }
      } catch {
        /* sin archivo: se cargan desde el menú */
      }
    }
    syncPresenterUi();
  };

  // ── Publicar el slide actual (solo la presentadora) ───────────────────
  const send = (p: Promise<unknown>) =>
    p.catch((err) => {
      console.warn('[live] no se pudo publicar:', err);
      if (rt.mode === 'firebase') {
        presenter = false;
        syncPresenterUi();
      }
    });
  let lastIndex = -1;
  const active = () => sections[Math.max(0, lastIndex)];
  function publish(index: number) {
    lastIndex = index;
    const s = sections[index];
    const c = SLIDE_BY_ID.get(s.dataset.id ?? '');
    const qid = (s.dataset.q as QuestionId | undefined) ?? null;
    tellConsole();
    if (!presenter) return;
    void send(rt.patchSlide({ index, total: sections.length, id: s.dataset.id ?? '', label: s.dataset.label ?? '', kind: c?.kind ?? 'content', qid }));
    // La primera vez que se muestra una pregunta, se marca la hora de apertura (bono por rapidez).
    if (qid && !slide?.openedAt?.[qid]) void send(rt.openQuestion(qid));
    if (c?.kind === 'podium') {
      publishPodium();
      renderPodium();
    }
  }
  stage.addEventListener('slidechange', (e) => publish((e as CustomEvent).detail.index));
  {
    const first = sections.findIndex((s) => s.hasAttribute('data-deck-active'));
    publish(first >= 0 ? first : 0);
  }

  // ── Consola de la presentadora (BroadcastChannel) ─────────────────────
  function tellConsole() {
    const id = sections[lastIndex]?.dataset.id ?? '';
    const msg: PresenterMsg = { type: 'state', index: lastIndex, total: sections.length, id, players: players.length, chasquis: chasquis.filter((c) => !c.hidden).length, questions: questions.length, votes: votes.length, live: presenter, mode: rt.mode };
    bc.postMessage(msg);
  }
  bc.onmessage = (e: MessageEvent<PresenterMsg>) => {
    const m = e.data;
    if (m.type === 'goto') stage.goTo(m.index);
    if (m.type === 'next') stage.next();
    if (m.type === 'prev') stage.prev();
    if (m.type === 'reveal') {
      const q = active().dataset.q as QuestionId | undefined;
      if (q) reveal(q);
    }
    if (m.type === 'hello') tellConsole();
  };

  document.addEventListener('deck:present', async () => {
    try {
      const ok = await rt.signInPresenter();
      presenter = rt.isPresenterSession() || ok;
      if (!presenter) alert('Esta cuenta de GitHub no es la de la presentadora.');
    } catch (err) {
      console.error(err);
      alert('No se pudo iniciar sesión con GitHub.');
    }
    syncPresenterUi();
    if (presenter) {
      await loadAnswers();
      publish(lastIndex);
      listenQuestions();
    }
  });
  document.addEventListener('deck:wipe', async () => {
    if (prompt(`Esto borra asistentes, apodos, votos, chasquis, reacciones y preguntas de la sesión "${SESSION_ID}".\nEscribe VACIAR para confirmar:`) !== 'VACIAR') return;
    const n = await rt.resetSession();
    publish(lastIndex);
    alert(`Sesión vaciada (${n} documentos).`);
  });
  // Cargar respuestas desde slides/answers.json (no está en el repo ni en el bundle).
  document.addEventListener('deck:answers', () => {
    if (!presenter) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      try {
        const parsed = parseAnswerKey(JSON.parse(await input.files![0].text()));
        await rt.saveAnswers(parsed);
        answers = parsed;
        syncPresenterUi();
        alert(`Respuestas guardadas en privado: ${Object.keys(parsed).join(', ')}`);
      } catch (err) {
        alert(`No pude leer el archivo: ${(err as Error).message}`);
      }
    });
    input.click();
  });

  // ── Contadores ────────────────────────────────────────────────────────
  const setCount = (k: string, v: number) => document.querySelectorAll(`[data-count="${k}"]`).forEach((el) => (el.textContent = v.toLocaleString('es-PE')));
  rt.onPlayers((ps) => {
    players = ps;
    setCount('players', ps.length);
    tellConsole();
    renderPodium();
  });
  rt.onSlide((s) => {
    slide = s;
    renderPolls();
  });
  rt.onVotes((all) => {
    votes = all;
    renderPolls();
    renderPodium();
    tellConsole();
  });

  // ── Encuestas (tiles construidos una vez; se actualizan por partes) ───
  function buildPolls() {
    document.querySelectorAll<HTMLElement>('[data-poll]').forEach((box) => {
      const q = QUESTIONS[box.dataset.poll as QuestionId];
      box.innerHTML = '';
      q.options.forEach((opt, i) => {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.opt = opt.id;
        tile.innerHTML = `<span class="bar"></span><span class="shape"></span><span class="label"></span><span class="count">0</span>`;
        tile.querySelector('.shape')!.append(icon(SHAPES[i], 24));
        tile.querySelector('.label')!.textContent = opt.label;
        // La marca de "correcta" se activa SOLO al revelar (la respuesta no está en el DOM antes).
        const ok = document.createElement('span');
        ok.className = 'ok';
        ok.append(icon(Check, 20));
        tile.append(ok);
        box.append(tile);
      });
    });
  }
  function renderPolls() {
    document.querySelectorAll<HTMLElement>('[data-poll]').forEach((box) => {
      const q = box.dataset.poll as QuestionId;
      const section = box.closest('section')!;
      const { counts, total } = tally(votes, q);
      const revealed = Boolean(slide?.revealed?.[q]);
      const max = Math.max(1, ...Object.values(counts));
      section.toggleAttribute('data-revealed', revealed);
      section.querySelectorAll<HTMLElement>('[data-total]').forEach((el) => (el.textContent = String(total)));
      const published = revealed ? slide?.answers?.[q] : undefined;
      const explain = section.querySelector<HTMLElement>('[data-explain]');
      if (explain) {
        explain.hidden = !published;
        explain.textContent = published?.explain ?? '';
      }
      box.querySelectorAll<HTMLElement>('.tile').forEach((tile) => {
        tile.toggleAttribute('data-correct', Boolean(published && tile.dataset.opt === published.correct));
        const n = counts[tile.dataset.opt!] ?? 0;
        tile.querySelector('.count')!.textContent = String(n);
        // transform (no width): la barra crece sin provocar layout.
        (tile.querySelector('.bar') as HTMLElement).style.transform = `scaleX(${revealed ? n / max : 0})`;
      });
    });
  }
  function reveal(q: QuestionId) {
    if (!presenter || !slide) return;
    if (!answers[q]) {
      alert(`Primero carga las respuestas: menú → "Cargar respuestas del podio" (falta ${q}).`);
      return;
    }
    // Se publica SOLO la respuesta de esta pregunta, en el momento de revelar.
    void send(rt.patchSlide({ revealed: { ...slide.revealed, [q]: true }, results: { ...slide.results, [q]: tally(votes, q) }, answers: { ...slide.answers, [q]: answers[q] } }));
  }
  sections.forEach((s) => {
    const q = s.dataset.q as QuestionId | undefined;
    if (q) s.querySelector('[data-reveal]')?.addEventListener('click', () => reveal(q));
  });
  addEventListener('keydown', (e) => {
    const q = active().dataset.q as QuestionId | undefined;
    if (!q || (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
    if (e.key.toLowerCase() === 'v' && presenter && !e.metaKey && !e.ctrlKey) reveal(q);
  });

  // ── Muro de chasquis (actualización por clave) ───────────────────────
  const wall = document.querySelector<HTMLElement>('[data-chasqui-wall]');
  const top = document.querySelector<HTMLElement>('[data-encargo-top]');
  const tiles = new Map<string, { el: HTMLElement; sig: string }>();
  rt.onChasquis((list) => {
    chasquis = list;
    const visible = presenter ? list : list.filter((d) => !d.hidden);
    setCount('chasquis', list.filter((d) => !d.hidden).length);
    tellConsole();
    renderPodium();
    if (!wall) return;
    if (!visible.length && !wall.querySelector('.wall-empty')) {
      wall.innerHTML = '<div class="wall-empty">Aún no hay chasquis. Crea el tuyo en <b>Menú → Mi chasqui</b>.</div>';
      tiles.clear();
    }
    if (visible.length) wall.querySelector('.wall-empty')?.remove();
    const keep = new Set(visible.map((d) => d.id));
    for (const [id, t] of tiles) {
      if (keep.has(id)) continue;
      t.el.remove();
      tiles.delete(id);
    }
    visible.forEach((d, i) => {
      const sig = JSON.stringify([d.name, d.encargo, d.opts, d.hidden]);
      let t = tiles.get(d.id);
      if (!t) {
        const el = document.createElement('figure');
        el.className = 'chasqui-tile';
        el.addEventListener('click', () => presenter && void rt.setChasquiHidden(d.id, !el.hasAttribute('data-hidden')));
        tiles.set(d.id, (t = { el, sig: '' }));
      }
      if (t.sig !== sig) {
        t.sig = sig;
        t.el.innerHTML = `${chasquiSVG(d.opts, `Chasqui de ${d.name}`)}<b>${esc(d.name)}</b><small>${esc(ENCARGOS[d.encargo] ?? '')}</small>`;
        t.el.toggleAttribute('data-hidden', d.hidden);
        t.el.title = presenter ? 'Clic para ocultar o mostrar (moderación)' : '';
      }
      if (wall.children[i] !== t.el) wall.insertBefore(t.el, wall.children[i] ?? null);
    });
    if (top) {
      const counts = new Map<number, number>();
      visible.filter((d) => !d.hidden).forEach((d) => counts.set(d.encargo, (counts.get(d.encargo) ?? 0) + 1));
      top.innerHTML = [...counts]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([p, n]) => `<span>${esc(ENCARGOS[p] ?? '')}<b>×${n}</b></span>`)
        .join('');
    }
    dispatchEvent(new Event('tweakchange'));
  });

  // ── Podio ──────────────────────────────────────────────────────────
  function ranking() {
    const withChasqui = new Set(chasquis.filter((c) => !c.hidden).map((c) => c.id));
    const ids = new Set<string>([...players.map((p) => p.id), ...votes.map((v) => v.uid), ...withChasqui]);
    const byVote = new Map(votes.map((v) => [v.uid, v]));
    const names = new Map(players.map((p) => [p.id, p.name]));
    return [...ids]
      .map((uid) => {
        const v = byVote.get(uid);
        const speed = Object.values(v?.at ?? {}).reduce((s, t) => s + (t ?? 0), 0);
        return { uid, name: names.get(uid) ?? chasquis.find((c) => c.id === uid)?.name ?? 'Chasqui anónimo', score: scoreFor(v, slide?.openedAt ?? {}, withChasqui.has(uid), answers), speed, code: winnerCode(uid) };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.speed - b.speed); // empate: quien respondió antes
  }
  const isPodiumSlide = () => SLIDE_BY_ID.get(active().dataset.id ?? '')?.kind === 'podium';
  function renderPodium() {
    const box = document.querySelector<HTMLElement>('[data-podium]');
    if (!box) return;
    // Solo la presentadora tiene las respuestas: el resto ve el podio que ella publica.
    const list = presenter ? ranking() : (slide?.podium ?? []);
    // Solo se redibuja (y se publica) si el ranking cambió: evita bucles y reinicios de la animación.
    const sig = JSON.stringify(list.slice(0, 10).map((r) => [r.name, r.score, r.code]));
    if (sig === podiumSig && box.childElementCount) return;
    podiumSig = sig;
    if (presenter && isPodiumSlide() && sig !== publishedSig) schedulePodiumPublish();
    const medal = ['2°', '1°', '3°'];
    const order = [list[1], list[0], list[2]];
    box.innerHTML = order
      .map((r, i) =>
        r
          ? `<div class="step"><span class="medal">${medal[i]}</span><span class="name">${esc(r.name)}</span><span class="pts">${r.score.toLocaleString('es-PE')} pts</span>${i === 1 ? `<span class="code-chip">${esc(r.code)}</span>` : ''}</div>`
          : '<div class="step"><span class="pts">—</span></div>',
      )
      .join('');
    const rest = document.querySelector<HTMLElement>('[data-rest]');
    if (rest) rest.innerHTML = list.slice(3, 10).map((r, i) => `<span class="pill">${i + 4}. ${esc(r.name)} · ${r.score.toLocaleString('es-PE')}</span>`).join('');
  }
  let podiumTimer = 0;
  let podiumSig = '';
  let publishedSig = '';
  function schedulePodiumPublish() {
    clearTimeout(podiumTimer);
    podiumTimer = window.setTimeout(publishPodium, 1500);
  }
  function publishPodium() {
    if (!presenter) return;
    const top = ranking().slice(0, 10).map(({ name, score, code }) => ({ name, score, code }));
    publishedSig = JSON.stringify(top.map((r) => [r.name, r.score, r.code]));
    void send(rt.patchSlide({ podium: top }));
  }

  // ── Reacciones flotantes ──────────────────────────────────────────────
  const layer = document.querySelector<HTMLElement>('.reactions')!;
  let floating = 0;
  rt.onReaction((r) => {
    if (floating > 24 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const meta = REACTIONS[r];
    if (!meta) return;
    const span = document.createElement('span');
    span.append(icon(REACTION_ICONS[r], 40, meta.color));
    span.style.setProperty('--dx', `${Math.round(Math.random() * 60 - 30)}px`);
    span.style.left = `${Math.round(Math.random() * 60)}px`;
    floating++;
    span.addEventListener('animationend', () => (span.remove(), floating--), { once: true });
    layer.append(span);
  });

  // ── Preguntas del público (panel de la presentadora, tecla Q) ─────────
  const panel = document.createElement('aside');
  panel.className = 'qa-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Preguntas del público');
  panel.innerHTML = `<header><h2>Preguntas del público <small data-q-total></small></h2><button class="qa-download" type="button" data-q-md>.md</button><button class="qa-close" type="button" aria-label="Cerrar">✕</button></header>
    <ol class="qa-list"></ol><p class="qa-empty">Aún no hay preguntas.</p>`;
  document.body.append(panel);
  panel.querySelector('.qa-close')!.addEventListener('click', () => (panel.hidden = true));
  panel.querySelector('[data-q-md]')!.addEventListener('click', () => {
    const md = `# Preguntas del público · ${SESSION_ID}\n\n${questions.map((q) => `- **${q.name}** (${q.slide}): ${q.text}`).join('\n')}\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    a.download = `preguntas-${SESSION_ID}.md`;
    a.click();
  });
  function renderQuestions() {
    const list = panel.querySelector('.qa-list')!;
    list.innerHTML = questions.map((q) => `<li><p>${esc(q.text)}</p><small>${esc(q.name)} · ${esc(q.slide)}</small><button type="button" data-del="${esc(q.id)}">Respondida · quitar</button></li>`).join('');
    list.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) => b.addEventListener('click', () => void rt.removeQuestion(b.dataset.del!)));
    const empty = panel.querySelector<HTMLElement>('.qa-empty')!;
    empty.hidden = questions.length > 0 && !qaError;
    empty.textContent = qaError || 'Aún no hay preguntas.';
    empty.classList.toggle('error', Boolean(qaError));
    panel.querySelector('[data-q-total]')!.textContent = String(questions.length);
  }
  function listenQuestions() {
    if (!presenter || unsubQuestions) return;
    unsubQuestions = rt.onQuestions(
      (qs) => {
        questions = qs;
        qaError = '';
        renderQuestions();
        syncPresenterUi();
        tellConsole();
      },
      (msg) => {
        qaError = msg;
        renderQuestions();
      },
    );
  }
  document.addEventListener('deck:questions', () => {
    panel.hidden = !panel.hidden;
    renderQuestions();
  });
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key.toLowerCase() === 'q' && presenter && !e.metaKey && !e.ctrlKey) document.dispatchEvent(new CustomEvent('deck:questions'));
    if (e.key === 'Escape') panel.hidden = true;
  });

  syncPresenterUi();
  await loadAnswers();
  listenQuestions();
  if (presenter) publish(lastIndex);
}
