// Capa de tiempo real con dos backends intercambiables:
//  - Firestore (Auth anónima) cuando hay configuración de Firebase.
//  - Local (BroadcastChannel + localStorage) para ensayar sin internet:
//    abre el deck en una pestaña y /live/ en otras; cada pestaña es un asistente.
//
// Pensado para 300+ celulares: los celulares SOLO escuchan el documento de la sesión
// (+ su propio voto). El contenido de cada slide ya viene en el bundle (content.ts).
// Solo el deck escucha las colecciones (asistentes, votos, chasquis) y publica agregados
// (resultados, podio) en el documento de sesión en momentos puntuales.
import { hasFirebase } from './config';
import type { LiveKind } from './content';
import type { ChasquiOptions } from './chasqui';
import type { AnswerKey, QuestionId } from './questions';

export interface PollResult {
  counts: Record<string, number>;
  total: number;
}

export interface PodiumEntry {
  name: string;
  score: number;
  /** Código visible (4+ letras) para reclamar el premio: único dentro del top 10. */
  code: string;
  /** Clave interna larga para que cada celular reconozca su lugar (no se muestra). */
  key?: string;
  /** Opciones del chasqui que publicó (pocos bytes); sin chasqui → silueta. */
  opts?: ChasquiOptions | null;
}

export interface SlideState {
  index: number;
  total: number;
  id: string;
  label: string;
  kind: LiveKind;
  /** Pregunta abierta en este slide (kind 'poll') */
  qid?: QuestionId | null;
  /** epoch ms (hora del servidor) en que se abrió cada pregunta */
  openedAt: Partial<Record<QuestionId, number>>;
  revealed: Partial<Record<QuestionId, boolean>>;
  results: Partial<Record<QuestionId, PollResult>>;
  /** respuestas YA reveladas (la presentadora las publica una por una al revelar) */
  answers: AnswerKey;
  podium: PodiumEntry[];
  /** epoch ms (servidor) en que empezó el capítulo 01: quien entró antes suma "llegar a tiempo". */
  earlyUntil?: number | null;
}

export const emptySlide = (): SlideState => ({ index: 0, total: 0, id: '', label: '', kind: 'content', qid: null, openedAt: {}, revealed: {}, results: {}, answers: {}, podium: [] });

export type Reaction = 'fire' | 'heart' | 'mind' | 'ask';
export const REACTIONS: Record<Reaction, { label: string; color: string }> = {
  fire: { label: 'Fuego', color: '#ea4335' },
  heart: { label: 'Me gusta', color: '#ff7daf' },
  mind: { label: 'Mente volada', color: '#4285f4' },
  ask: { label: 'Tengo una pregunta', color: '#34a853' },
};

export interface Player {
  id: string;
  name: string;
  /** epoch ms (servidor) de la PRIMERA vez que entró: base del bono "llegar a tiempo". */
  at?: number;
}

/** El chasqui publicado en el muro: solo opciones (pocos bytes), el deck dibuja el SVG. */
export interface ChasquiData {
  id: string;
  name: string;
  encargo: number;
  opts: ChasquiOptions;
  createdAt: number;
  hidden: boolean;
}

export interface AudienceQuestion {
  id: string;
  uid: string;
  name: string;
  text: string;
  slide: string;
  at: number;
}

export type Votes = Partial<Record<QuestionId, string>>;
export interface VoteRecord {
  uid: string;
  votes: Votes;
  /** epoch ms (servidor) de cada respuesta */
  at: Partial<Record<QuestionId, number>>;
}

export type Unsub = () => void;

export interface Realtime {
  readonly mode: 'firebase' | 'local';
  uid(): string;

  // Sesión (presentadora escribe, todos leen)
  patchSlide(s: Partial<SlideState>): Promise<void>;
  /** Marca la hora (del servidor) en que se abrió la pregunta: base del bono por rapidez. */
  openQuestion(q: QuestionId): Promise<void>;
  /** Marca (una vez, con hora del servidor) el fin del bono "llegar a tiempo". */
  markEarlyEnd(): Promise<void>;
  onSlide(cb: (s: SlideState) => void): Unsub;

  // Público
  /** Reserva el apodo para este uid. false si ya es de otra persona (el primero gana). */
  reserveName(name: string): Promise<boolean>;
  /** Cuáles de estos apodos ya están reservados por otras personas. */
  takenNames(names: string[]): Promise<Set<string>>;
  join(name: string): Promise<void>;
  vote(q: QuestionId, option: string): Promise<void>;
  onMyVotes(cb: (v: Votes) => void): Unsub;
  react(r: Reaction): Promise<void>;
  /** Duda para la presentadora (texto libre: NO se proyecta). */
  ask(q: { name: string; text: string; slide: string }): Promise<void>;
  publishChasqui(d: Omit<ChasquiData, 'id' | 'createdAt' | 'hidden'>): Promise<void>;

  // Solo el deck agrega
  onPlayers(cb: (players: Player[]) => void): Unsub;
  onVotes(cb: (all: VoteRecord[]) => void): Unsub;
  /** Cada reacción nueva con el uid de quien la envió (para el bono por participar). */
  onReaction(cb: (r: Reaction, uid: string) => void): Unsub;
  onChasquis(cb: (list: ChasquiData[]) => void): Unsub;
  /** Solo presentadora (las reglas no dejan leerlas a nadie más). */
  onQuestions(cb: (qs: AudienceQuestion[]) => void, onError?: (msg: string) => void): Unsub;
  removeQuestion(id: string): Promise<void>;
  setChasquiHidden(id: string, hidden: boolean): Promise<void>;
  /** Solo presentadora: borra asistentes, apodos, votos, reacciones, preguntas y chasquis de ESTA sesión. */
  resetSession(): Promise<number>;

  /** Respuestas privadas: solo la presentadora puede leerlas o escribirlas. */
  loadAnswers(): Promise<AnswerKey | null>;
  saveAnswers(a: AnswerKey): Promise<void>;

  /** Solo presentadora: login con GitHub para poder escribir la sesión. */
  signInPresenter(): Promise<boolean>;
  isPresenterSession(): boolean;
}

let instance: Promise<Realtime> | null = null;

export function getRealtime(): Promise<Realtime> {
  if (!instance) {
    const local = () => import('./realtime-local').then((m) => m.createLocalRealtime());
    instance = hasFirebase
      ? import('./realtime-firebase')
          .then((m) => m.createFirebaseRealtime())
          .catch((err) => {
            // Si Firebase falla (sin red, Auth sin habilitar…), seguimos en modo local para no romper el deck.
            console.warn('[live] Firebase no disponible, modo local:', err);
            return local();
          })
      : local();
  }
  return instance;
}

export function tally(all: VoteRecord[], q: QuestionId): PollResult {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const v of all) {
    const opt = v.votes[q];
    if (!opt) continue;
    counts[opt] = (counts[opt] ?? 0) + 1;
    total++;
  }
  return { counts, total };
}

/** Segundos para el bono por rapidez: máximo al instante, 0 a los 60 s. */
export const SPEED_WINDOW_S = 60;

/** Bonos fuera de las preguntas (todos con tope: el podio lo deciden sobre todo los aciertos). */
export const BONUS = { chasqui: 100, early: 100, asked: 100, reactionEach: 10, reactionMax: 100 } as const;

export interface Extras {
  chasqui?: boolean;
  /** entró antes de empezar el capítulo 01 */
  early?: boolean;
  /** envió al menos una pregunta sobre el tema */
  asked?: boolean;
  /** reacciones enviadas */
  reactions?: number;
}

/** Puntos: acertar 500 + bono por rapidez (hasta 500) por pregunta, más los bonos con tope. */
export function scoreFor(vote: VoteRecord | undefined, openedAt: SlideState['openedAt'], extras: Extras, answers: AnswerKey): number {
  let score = (extras.chasqui ? BONUS.chasqui : 0) + (extras.early ? BONUS.early : 0) + (extras.asked ? BONUS.asked : 0) + Math.min(BONUS.reactionMax, (extras.reactions ?? 0) * BONUS.reactionEach);
  if (!vote) return score;
  for (const q of Object.keys(vote.votes) as QuestionId[]) {
    if (!answers[q] || vote.votes[q] !== answers[q]!.correct) continue;
    score += 500;
    const opened = openedAt[q];
    const at = vote.at[q];
    if (opened && at) {
      const ratio = 1 - (at - opened) / (SPEED_WINDOW_S * 1000);
      score += Math.round(500 * Math.min(1, Math.max(0, ratio)));
    }
  }
  return score;
}

/** Aciertos según las respuestas ya reveladas. */
export const correctCount = (votes: Votes, answers: AnswerKey) => (Object.keys(votes) as QuestionId[]).filter((q) => answers[q] && votes[q] === answers[q]!.correct).length;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I: fáciles de leer en voz alta

/** Código estable por persona derivado de su uid (FNV-1a con dos semillas → hasta 12 letras). */
export function winnerCode(uid: string, length = 4): string {
  const hash = (seed: number) => {
    let h = seed >>> 0;
    for (const c of uid) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    return h;
  };
  const words = [hash(2166136261), hash(0x9e3779b9), hash(0x85ebca6b)];
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[(words[Math.floor(i / 6)] >>> ((i % 6) * 5)) & 31];
  return out;
}

/** Clave interna (12 letras ≈ 60 bits): con 300 personas la probabilidad de choque es despreciable. */
export const podiumKey = (uid: string) => winnerCode(uid, 12);

/**
 * Códigos visibles únicos dentro del top: si dos coinciden, se alargan (4 → 5 → 6 letras)
 * hasta que todos son distintos.
 */
export function uniqueCodes(uids: string[]): string[] {
  for (let len = 4; len <= 12; len++) {
    const codes = uids.map((u) => winnerCode(u, len));
    if (new Set(codes).size === codes.length) return codes;
  }
  return uids.map((u) => winnerCode(u, 12));
}
