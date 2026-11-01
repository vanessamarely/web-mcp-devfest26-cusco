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
  code: string;
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
  onReaction(cb: (r: Reaction) => void): Unsub;
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

/** Puntos estilo Kahoot: acertar 500 + bono por rapidez (hasta 500); publicar tu chasqui +200. */
export function scoreFor(vote: VoteRecord | undefined, openedAt: SlideState['openedAt'], hasChasqui: boolean, answers: AnswerKey): number {
  let score = hasChasqui ? 200 : 0;
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

/** Código corto y estable por persona (para reclamar el premio en el escenario). */
export function winnerCode(uid: string): string {
  let h = 2166136261;
  for (const c of uid) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i++) out += alphabet[(h >>> (i * 5)) & 31];
  return out;
}
