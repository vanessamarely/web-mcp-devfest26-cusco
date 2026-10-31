// Apodos generados (sin texto libre: nada inapropiado llega al proyector).
//  · Sabor cusqueño + vocabulario de la charla, con concordancia de género ("Llama Andina", "Cóndor Andino").
//  · 48 sustantivos × 36 adjetivos ≈ 1.700 combinaciones: de sobra para 300+ asistentes.
//  · Aun así, si dos personas eligen el mismo apodo, la segunda recibe una numeración
//    ("Cóndor Veloz 2"): ver claimUniqueName. Firestore (o el modo local) garantiza la reserva.

type G = 'm' | 'f';

/** [sustantivo, género] */
export const NOUNS: readonly (readonly [string, G])[] = [
  // Cusco y los Andes
  ['Cóndor', 'm'], ['Puma', 'm'], ['Colibrí', 'm'], ['Chasqui', 'm'], ['Quipu', 'm'], ['Inti', 'm'],
  ['Apu', 'm'], ['Tambo', 'm'], ['Andén', 'm'], ['Pututu', 'm'], ['Charango', 'm'], ['Choclo', 'm'],
  ['Poncho', 'm'], ['Chullo', 'm'], ['Ukuku', 'm'], ['Qhapaq', 'm'], ['Mate de Muña', 'm'], ['Tejido', 'm'],
  ['Llama', 'f'], ['Alpaca', 'f'], ['Vicuña', 'f'], ['Chakana', 'f'], ['Quena', 'f'], ['Killa', 'f'],
  ['Montera', 'f'], ['Kantuta', 'f'], ['Lliclla', 'f'], ['Vizcacha', 'f'], ['Taruka', 'f'], ['Zampoña', 'f'],
  // La charla
  ['Token', 'm'], ['Prompt', 'm'], ['Agente', 'm'], ['Schema', 'm'], ['Kernel', 'm'], ['Pixel', 'm'],
  ['Hook', 'm'], ['Byte', 'm'], ['Router', 'm'], ['Parser', 'm'], ['Endpoint', 'm'], ['Navegador', 'm'],
  ['Tool', 'f'], ['API', 'f'], ['Promesa', 'f'], ['Señal', 'f'], ['Consola', 'f'], ['Web', 'f'],
];

/** [masculino, femenino] (iguales si el adjetivo no cambia) */
export const ADJS: readonly (readonly [string, string])[] = [
  ['Veloz', 'Veloz'], ['Andino', 'Andina'], ['Valiente', 'Valiente'], ['Curioso', 'Curiosa'], ['Brillante', 'Brillante'],
  ['Sereno', 'Serena'], ['Épico', 'Épica'], ['Ninja', 'Ninja'], ['Cósmico', 'Cósmica'], ['Ágil', 'Ágil'],
  ['Sabio', 'Sabia'], ['Audaz', 'Audaz'], ['Feliz', 'Feliz'], ['Turbo', 'Turbo'], ['Estelar', 'Estelar'],
  ['Asíncrono', 'Asíncrona'], ['Reactivo', 'Reactiva'], ['Eléctrico', 'Eléctrica'], ['Dorado', 'Dorada'], ['Zen', 'Zen'],
  ['Pro', 'Pro'], ['Galáctico', 'Galáctica'], ['Atómico', 'Atómica'], ['Legendario', 'Legendaria'], ['Imparable', 'Imparable'],
  ['Solar', 'Solar'], ['Cusqueño', 'Cusqueña'], ['Imperial', 'Imperial'], ['Agéntico', 'Agéntica'], ['Declarativo', 'Declarativa'],
  ['Imperativo', 'Imperativa'], ['Tejedor', 'Tejedora'], ['Viajero', 'Viajera'], ['Mágico', 'Mágica'], ['Altiplánico', 'Altiplánica'],
  ['Arcoíris', 'Arcoíris'],
];

export const TOTAL_COMBINATIONS = NOUNS.length * ADJS.length;

const pick = <T>(a: readonly T[], r = Math.random) => a[Math.floor(r() * a.length)];

export function randomName(r: () => number = Math.random): string {
  const [noun, g] = pick(NOUNS, r);
  const [m, f] = pick(ADJS, r);
  return `${noun} ${g === 'f' ? f : m}`;
}

/** Todas las combinaciones (para tests y para el contador de "apodos disponibles"). */
export function allNames(): string[] {
  return NOUNS.flatMap(([noun, g]) => ADJS.map(([m, f]) => `${noun} ${g === 'f' ? f : m}`));
}

const BANNED = /(put[ao]|mierd|cul[oa]|pend[ae]j|verga|coñ|carajo|fuck|shit|sex|nazi|cojud|huev[oó]n|conchatu)/i;
/** Limpia un nombre escrito a mano (avatar): si es ofensivo o está vacío, propone uno generado. */
export const cleanName = (s: string) => (BANNED.test(s) ? randomName() : s.trim().slice(0, 18)) || randomName();

/** Clave de un apodo: sin tildes ni mayúsculas ("Cóndor Ágil 2" → "condor-agil-2"). */
export const nameKey = (n: string) =>
  n
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

/** "Cóndor Veloz" → "Cóndor Veloz", "Cóndor Veloz 2", "Cóndor Veloz 3"… */
export const numbered = (base: string, n: number) => (n <= 1 ? base : `${base} ${n}`);

/**
 * Reserva un apodo único. Intenta el apodo base y, si alguien ya lo tiene, le agrega una
 * numeración (2, 3, …). `tryReserve` debe ser atómico (Firestore: create sin overwrite).
 * Devuelve el apodo que quedó reservado para esta persona.
 */
export async function claimUniqueName(base: string, tryReserve: (name: string) => Promise<boolean>, max = 999): Promise<string> {
  for (let n = 1; n <= max; n++) {
    const candidate = numbered(base, n);
    if (await tryReserve(candidate)) return candidate;
  }
  throw new Error('No hay apodos libres');
}
