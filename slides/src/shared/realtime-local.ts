import { NS } from './config';
import { nameKey } from './names';
import type { AnswerKey, QuestionId } from './questions';
import { emptySlide, type AudienceQuestion, type ChasquiData, type Player, type Reaction, type Realtime, type SlideState, type VoteRecord, type Votes } from './realtime';

interface LocalDb {
  slide: SlideState;
  players: Record<string, string>;
  /** nameKey → uid */
  names: Record<string, string>;
  votes: Record<string, VoteRecord>;
  chasquis: Record<string, ChasquiData>;
  questions: Record<string, AudienceQuestion>;
  answers: AnswerKey | null;
}

const KEY = `${NS}.local.db`;
const empty = (): LocalDb => ({ slide: emptySlide(), players: {}, names: {}, votes: {}, chasquis: {}, questions: {}, answers: null });

function read(): LocalDb {
  try {
    const db = { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || '{}') } as LocalDb;
    db.slide = { ...emptySlide(), ...db.slide };
    return db;
  } catch {
    return empty();
  }
}

/** Modo ensayo: sin red. Cada pestaña es un asistente distinto. */
export function createLocalRealtime(): Realtime {
  const channel = new BroadcastChannel(`${NS}-live`);
  const listeners = new Set<(db: LocalDb) => void>();
  const reactionListeners = new Set<(r: Reaction) => void>();

  let uid: string | null;
  try {
    uid = sessionStorage.getItem(`${NS}.uid`);
    if (!uid) sessionStorage.setItem(`${NS}.uid`, (uid = 'local-' + crypto.randomUUID().slice(0, 8)));
  } catch {
    uid = 'local-' + Math.random().toString(36).slice(2, 10);
  }
  const me = uid;

  const emit = () => {
    const db = read();
    listeners.forEach((l) => l(db));
  };
  const write = (fn: (db: LocalDb) => void) => {
    const db = read();
    fn(db);
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* cuota llena */
    }
    channel.postMessage({ type: 'db' });
    emit();
  };
  channel.onmessage = (e) => {
    if (e.data?.type === 'db') emit();
    if (e.data?.type === 'reaction') reactionListeners.forEach((l) => l(e.data.r));
  };
  const sub = (fn: (db: LocalDb) => void) => {
    listeners.add(fn);
    queueMicrotask(() => fn(read()));
    return () => {
      listeners.delete(fn);
    };
  };
  // En ensayo local "presentadora" = quien abre el deck con ?presenter.
  const isPresenter = () => new URLSearchParams(location.search).has('presenter');

  return {
    mode: 'local',
    uid: () => me,

    async patchSlide(s) {
      write((db) => (db.slide = { ...db.slide, ...s }));
    },
    async openQuestion(q: QuestionId) {
      write((db) => (db.slide.openedAt = { ...db.slide.openedAt, [q]: Date.now() }));
    },
    onSlide: (cb) => sub((db) => cb(db.slide)),

    async reserveName(name) {
      const k = nameKey(name);
      let ok = false;
      write((db) => {
        const owner = db.names[k];
        if (!owner || owner === me) {
          db.names[k] = me;
          ok = true;
        }
      });
      return ok;
    },
    async takenNames(names) {
      const db = read();
      return new Set(names.filter((n) => db.names[nameKey(n)] && db.names[nameKey(n)] !== me));
    },
    async join(name) {
      write((db) => (db.players[me] = name));
    },
    async vote(q, option) {
      write((db) => {
        const rec = db.votes[me] ?? { uid: me, votes: {}, at: {} };
        if (rec.votes[q]) return; // una respuesta por pregunta
        rec.votes[q] = option;
        rec.at[q] = Date.now();
        db.votes[me] = rec;
      });
    },
    onMyVotes: (cb) => sub((db) => cb((db.votes[me]?.votes ?? {}) as Votes)),
    async react(r) {
      channel.postMessage({ type: 'reaction', r });
      reactionListeners.forEach((l) => l(r));
    },
    async ask(q) {
      const id = crypto.randomUUID().slice(0, 8);
      write((db) => (db.questions[id] = { ...q, id, uid: me, at: Date.now() }));
    },
    async publishChasqui(d) {
      write((db) => (db.chasquis[me] = { ...d, id: me, createdAt: db.chasquis[me]?.createdAt ?? Date.now(), hidden: db.chasquis[me]?.hidden ?? false }));
    },

    onPlayers: (cb) => sub((db) => cb(Object.entries(db.players).map(([id, name]): Player => ({ id, name })))),
    onVotes: (cb) => sub((db) => cb(Object.values(db.votes))),
    onReaction(cb) {
      reactionListeners.add(cb);
      return () => {
        reactionListeners.delete(cb);
      };
    },
    onChasquis: (cb) => sub((db) => cb(Object.values(db.chasquis).sort((a, b) => b.createdAt - a.createdAt))),
    onQuestions: (cb) => sub((db) => cb(Object.values(db.questions).sort((a, b) => a.at - b.at))),
    async removeQuestion(id) {
      write((db) => delete db.questions[id]);
    },
    async setChasquiHidden(id, hidden) {
      write((db) => {
        if (db.chasquis[id]) db.chasquis[id].hidden = hidden;
      });
    },
    async resetSession() {
      const db = read();
      const n = Object.keys(db.players).length + Object.keys(db.chasquis).length + Object.keys(db.questions).length + Object.keys(db.votes).length;
      write((d) => Object.assign(d, { ...empty(), answers: d.answers }));
      return n;
    },

    async loadAnswers() {
      return isPresenter() ? read().answers : null;
    },
    async saveAnswers(a) {
      write((db) => (db.answers = a));
    },

    async signInPresenter() {
      return true;
    },
    isPresenterSession: isPresenter,
  };
}
