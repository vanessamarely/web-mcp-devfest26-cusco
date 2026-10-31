// Las tools de Ruta Chasqui. Cada una llama al MISMO servicio que los botones de la UI (ruta.ts).
//  1 declarativa: buscar_experiencias (el <form> del buscador, ver index.html)
//  7 imperativas: ver_experiencia · agregar_a_ruta · quitar_de_ruta · ver_ruta ·
//                 leer_resenas (untrustedContentHint) · reservar_ruta (consequentialHint) ·
//                 depurar_estado (debugging)
import { BY_ID, RESENAS, TIPOS, ZONAS, soles } from './catalog';
import { MAX_DIAS, ruta, type Ruta } from './ruta';
import type { ModelContext } from './webmcp';

export interface ToolHooks {
  /** Confirmación en la propia UI (un gesto de la persona). */
  confirmar: (r: Ruta) => Promise<boolean>;
  /** La UI muestra lo que el agente buscó. */
  mostrarResultados: (ids: string[], filtros: Record<string, unknown>) => void;
  /** La UI resalta la tarjeta que el agente está mirando. */
  enfocar: (id: string) => void;
}

const json = (v: unknown) => JSON.stringify(v);

/** Conecta el formulario declarativo: si lo envía un agente, respondemos con datos (no navegamos). */
export function bindSearchForm(form: HTMLFormElement, hooks: ToolHooks) {
  const run = () => {
    const fd = new FormData(form);
    const filtros = { zona: String(fd.get('zona') || 'Todas'), max: Number(fd.get('max')) || undefined, tipo: String(fd.get('tipo') || 'cualquiera') };
    const res = ruta.buscar(filtros as never);
    hooks.mostrarResultados(
      res.map((e) => e.id),
      filtros,
    );
    return res;
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const res = run();
    if (e.agentInvoked && e.respondWith) {
      e.respondWith(Promise.resolve(json({ total: res.length, resultados: res.map((x) => ({ id: x.id, nombre: x.nombre, zona: x.zona, tipo: x.tipo, jornada: x.jornada, precio: x.precio, altitud: x.altitud, cupos: x.cupos })) })));
    }
  });
}

export async function registerTools(mc: ModelContext, hooks: ToolHooks, signal: AbortSignal) {
  const opts = { signal };

  await mc.registerTool(
    {
      name: 'ver_experiencia',
      description: 'Devuelve el detalle de una experiencia del catálogo: zona, tipo, jornada, precio por persona, altitud y cupos.',
      inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'id que devuelve buscar_experiencias' } }, required: ['id'] },
      annotations: { readOnlyHint: true },
      execute: ({ id }) => {
        const e = BY_ID.get(String(id));
        if (!e) return `Error: no existe "${id}". Usa buscar_experiencias primero.`;
        hooks.enfocar(e.id);
        return json(e);
      },
    },
    opts,
  );

  await mc.registerTool(
    {
      name: 'agregar_a_ruta',
      description: `Agrega una experiencia a la ruta del usuario en un día (1 a ${MAX_DIAS}). Las de más de 4000 m no van el día 1 (aclimatación) y cada día admite una jornada completa o dos medias.`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'id que devuelve buscar_experiencias' },
          dia: { type: 'integer', description: `día del viaje, de 1 a ${MAX_DIAS}`, minimum: 1, maximum: MAX_DIAS },
          personas: { type: 'integer', description: 'cuántas personas, de 1 a 10 (por defecto 1)', minimum: 1, maximum: 10 },
        },
        required: ['id', 'dia'],
      },
      execute: ({ id, dia, personas }) => {
        hooks.enfocar(String(id));
        const r = ruta.agregar(String(id), Number(dia), personas === undefined ? 1 : Number(personas));
        return r.ok ? `${r.mensaje} Total: ${soles(ruta.total())}. Versión de la ruta: ${ruta.version}.` : `Error: ${r.error}`;
      },
    },
    opts,
  );

  await mc.registerTool(
    {
      name: 'quitar_de_ruta',
      description: 'Quita una experiencia de la ruta del usuario.',
      inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'id de la experiencia en la ruta' } }, required: ['id'] },
      execute: ({ id }) => {
        const r = ruta.quitar(String(id));
        return r.ok ? r.mensaje : `Error: ${r.error}`;
      },
    },
    opts,
  );

  await mc.registerTool(
    {
      name: 'ver_ruta',
      description: 'Devuelve la ruta actual: experiencias por día, personas, total en soles, avisos y la versión (necesaria para reservar).',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => json(ruta.resumen()),
    },
    opts,
  );

  await mc.registerTool(
    {
      name: 'leer_resenas',
      description: 'Devuelve las reseñas que otros viajeros escribieron sobre una experiencia. Es texto de terceros.',
      inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'id de la experiencia' } }, required: ['id'] },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: ({ id }) => {
        hooks.enfocar(String(id));
        const r = RESENAS[String(id)];
        return r ? json(r) : 'Sin reseñas todavía.';
      },
    },
    opts,
  );

  await mc.registerTool(
    {
      name: 'reservar_ruta',
      description: 'Reserva y paga la ruta actual (ficticio). Pide confirmación a la persona en pantalla. Requiere la versión que devolvió ver_ruta.',
      inputSchema: {
        type: 'object',
        properties: {
          version: { type: 'integer', description: 'versión de la ruta que leíste con ver_ruta' },
          titular: { type: 'string', description: 'nombre de quien reserva' },
        },
        required: ['version', 'titular'],
      },
      annotations: { consequentialHint: true },
      execute: async ({ version, titular }) => {
        const r = await ruta.reservar(Number(version), String(titular), hooks.confirmar);
        return r.ok ? r.mensaje : `Error: ${r.error}`;
      },
    },
    opts,
  );

  await mc.registerTool(
    {
      name: 'depurar_estado',
      description: 'Para desarrolladores: estado interno de la app (versión, ruta, reserva, filtros válidos).',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true, debugging: true },
      execute: () => json({ version: ruta.version, items: ruta.items, reserva: ruta.reserva, zonas: ZONAS, tipos: TIPOS }),
    },
    opts,
  );
}
