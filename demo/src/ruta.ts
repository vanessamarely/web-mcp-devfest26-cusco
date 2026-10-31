// Servicio ÚNICO de la ruta: lo usan los botones de la UI, las tools de WebMCP y los tests.
// Así una tool nunca "miente": solo responde éxito si el estado de la app cambió de verdad.
// Las reglas se validan AQUÍ, en código (el JSON Schema es solo una pista para el modelo).
import { BY_ID, CATALOGO, soles, type Experiencia, type Tipo, type Zona } from './catalog';

export const MAX_DIAS = 5;
export const ALTURA_ACLIMATACION = 4000;

export interface ItemRuta {
  id: string;
  dia: number;
  personas: number;
}

export interface Reserva {
  codigo: string;
  titular: string;
  total: number;
}

export type Resultado<T = undefined> = { ok: true; value: T; mensaje: string } | { ok: false; error: string };

type Listener = () => void;

export class Ruta {
  items: ItemRuta[] = [];
  /** Sube con cada cambio: las acciones con consecuencias se atan a una versión. */
  version = 1;
  reserva: Reserva | null = null;
  private listeners = new Set<Listener>();

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private changed() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  buscar(f: { zona?: Zona | 'Todas'; max?: number; tipo?: Tipo | 'cualquiera' }): Experiencia[] {
    return CATALOGO.filter((e) => (!f.zona || f.zona === 'Todas' || e.zona === f.zona) && (!f.max || e.precio <= f.max) && (!f.tipo || f.tipo === 'cualquiera' || e.tipo === f.tipo));
  }

  agregar(id: string, dia: number, personas = 1): Resultado<Experiencia> {
    const e = BY_ID.get(id);
    if (this.reserva) return { ok: false, error: 'La ruta ya está reservada. Empieza una nueva para cambiarla.' };
    if (!e) return { ok: false, error: `No existe la experiencia "${id}". Usa un id que devuelva buscar_experiencias.` };
    if (!Number.isInteger(dia) || dia < 1 || dia > MAX_DIAS) return { ok: false, error: `El día debe ser un entero entre 1 y ${MAX_DIAS}.` };
    if (!Number.isInteger(personas) || personas < 1 || personas > 10) return { ok: false, error: 'Las personas deben ser entre 1 y 10.' };
    if (personas > e.cupos) return { ok: false, error: `Solo quedan ${e.cupos} cupos para "${e.nombre}".` };
    if (dia === 1 && e.altitud > ALTURA_ACLIMATACION)
      return { ok: false, error: `Aclimatación: "${e.nombre}" llega a ${e.altitud} m. No se programa el día 1; elige el día 3 o después.` };
    const delDia = this.items.filter((i) => i.dia === dia && i.id !== id).map((i) => BY_ID.get(i.id)!);
    const carga = delDia.reduce((s, x) => s + (x.jornada === 'completa' ? 2 : 1), 0) + (e.jornada === 'completa' ? 2 : 1);
    if (carga > 2) return { ok: false, error: `El día ${dia} ya está lleno (${delDia.map((x) => x.nombre).join(', ')}). Elige otro día.` };
    this.items = [...this.items.filter((i) => i.id !== id), { id, dia, personas }].sort((a, b) => a.dia - b.dia);
    this.changed();
    return { ok: true, value: e, mensaje: `Agregada: ${e.nombre}, día ${dia}, ${personas} ${personas === 1 ? 'persona' : 'personas'}.` };
  }

  quitar(id: string): Resultado {
    if (this.reserva) return { ok: false, error: 'La ruta ya está reservada.' };
    if (!this.items.some((i) => i.id === id)) return { ok: false, error: `"${id}" no está en la ruta.` };
    this.items = this.items.filter((i) => i.id !== id);
    this.changed();
    return { ok: true, value: undefined, mensaje: `Quitada: ${BY_ID.get(id)?.nombre ?? id}.` };
  }

  total() {
    return this.items.reduce((s, i) => s + BY_ID.get(i.id)!.precio * i.personas, 0);
  }

  avisos(): string[] {
    const out: string[] = [];
    const dias = new Set(this.items.map((i) => i.dia));
    if (this.items.some((i) => BY_ID.get(i.id)!.altitud > ALTURA_ACLIMATACION) && !dias.has(1)) out.push('Tip: pasa el día 1 en la ciudad para aclimatarte (mate de muña, poca actividad).');
    return out;
  }

  /** Lo que ve el agente de la ruta (también lo muestra la UI). */
  resumen() {
    return {
      version: this.version,
      reservada: Boolean(this.reserva),
      items: this.items.map((i) => {
        const e = BY_ID.get(i.id)!;
        return { id: i.id, nombre: e.nombre, dia: i.dia, personas: i.personas, subtotal: e.precio * i.personas };
      }),
      total: this.total(),
      total_texto: soles(this.total()),
      avisos: this.avisos(),
    };
  }

  /** Reserva: se ata a la versión que el agente leyó y exige la confirmación de una persona. */
  async reservar(version: number, titular: string, confirmar: (r: Ruta) => Promise<boolean>): Promise<Resultado<Reserva>> {
    if (this.reserva) return { ok: false, error: `Ya está reservada (código ${this.reserva.codigo}).` };
    if (!this.items.length) return { ok: false, error: 'La ruta está vacía.' };
    if (version !== this.version) return { ok: false, error: `La ruta cambió (versión ${this.version}, recibí ${version}). Vuelve a leerla con ver_ruta.` };
    const nombre = String(titular ?? '').trim().slice(0, 60);
    if (!nombre) return { ok: false, error: 'Falta el nombre del titular.' };
    const ok = await confirmar(this);
    if (!ok) return { ok: false, error: 'La persona canceló la reserva en pantalla. No se cobró nada.' };
    if (version !== this.version) return { ok: false, error: 'La ruta cambió mientras se confirmaba. No se reservó.' };
    this.reserva = { codigo: 'CHQ-' + Math.random().toString(36).slice(2, 7).toUpperCase(), titular: nombre, total: this.total() };
    this.changed();
    return { ok: true, value: this.reserva, mensaje: `Reserva confirmada: ${this.reserva.codigo} a nombre de ${nombre}, ${soles(this.reserva.total)} (ficticio).` };
  }

  reset() {
    this.items = [];
    this.reserva = null;
    this.changed();
  }
}

export const ruta = new Ruta();
