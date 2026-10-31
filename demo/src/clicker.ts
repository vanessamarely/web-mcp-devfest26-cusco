// Agente SIN WebMCP: hace lo que hacen hoy muchos agentes de navegador.
// En cada paso "mira" la página (lee el DOM visible: eso son tokens), adivina qué control
// sirve por su TEXTO y simula el clic con un cursor. No sabe nada de reglas ni de ids.
// Si rediseñas la página (cambian textos y botones), se pierde.
import { parseEncargo, type AgentRun, type AgentStep } from './agent';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tokens = (s: string) => Math.ceil(s.length / 4);

export async function runClickerAgent(prompt: string, { root, onStep, signal, speed = 1 }: { root: HTMLElement; onStep: (s: AgentStep) => void; signal?: AbortSignal; speed?: number }): Promise<AgentRun> {
  const t0 = performance.now();
  let steps = 0;
  let tok = tokens(prompt);
  const cursor = document.querySelector<HTMLElement>('.fake-cursor')!;
  const wait = (ms: number) => sleep(ms / speed);

  /** "Mirar" la página: el agente lee el HTML visible completo en cada paso. */
  const look = (why: string) => {
    const html = root.innerHTML;
    tok += tokens(html);
    steps++;
    onStep({ kind: 'think', text: `👁 Leo la página (${tokens(html).toLocaleString('es-PE')} tokens): ${why}` });
  };
  const moveTo = async (el: Element) => {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await wait(350);
    const r = el.getBoundingClientRect();
    cursor.hidden = false;
    cursor.style.transform = `translate(${r.left + r.width / 2}px, ${r.top + r.height / 2}px)`;
    await wait(650);
  };
  const click = async (el: HTMLElement, label: string) => {
    await moveTo(el);
    steps++;
    onStep({ kind: 'call', text: `🖱 Clic en “${label}”` });
    el.classList.add('agent-hit');
    el.click();
    await wait(450);
    el.classList.remove('agent-hit');
  };
  /** Busca un control visible por su texto (o su etiqueta accesible). */
  const findByText = (re: RegExp, scope: ParentNode = root) =>
    [...scope.querySelectorAll<HTMLElement>('button, a, [role="button"]')].find((b) => b.offsetParent !== null && re.test(`${b.textContent ?? ''} ${b.getAttribute('aria-label') ?? ''}`));

  const fail = (why: string): AgentRun => {
    cursor.hidden = true;
    onStep({ kind: 'error', text: `😵 ${why}` });
    return { steps, tokens: tok, ms: performance.now() - t0, ok: false };
  };

  const { places, personas } = parseEncargo(prompt);
  if (!places.length) return fail('No entendí qué lugar buscar en la página.');

  for (const pl of places) {
    if (signal?.aborted) break;
    look(`busco el filtro de zona para “${pl.zona}”`);
    const select = [...root.querySelectorAll<HTMLSelectElement>('select')].find((s) => [...s.options].some((o) => o.text === pl.zona));
    if (!select) return fail('No encontré un filtro de zona.');
    await moveTo(select);
    select.value = pl.zona;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    steps++;
    onStep({ kind: 'call', text: `⌨ Elijo “${pl.zona}” en un desplegable` });

    look('busco un botón que diga “Buscar”');
    const search = findByText(/^\s*buscar\s*$/i);
    if (!search) return fail('No encontré un botón que diga “Buscar”. (¿Cambió el diseño?)');
    await click(search, 'Buscar');

    // Adivinar la tarjeta: el agente no conoce ids, compara textos.
    let card: HTMLElement | undefined;
    for (let attempt = 0; attempt < 2 && !card; attempt++) {
      look(attempt ? 'no la veo… vuelvo a mirar después de hacer scroll' : 'busco la tarjeta que se parezca al lugar pedido');
      const words = pl.zona === 'Valle Sagrado' ? /pisaq|ollantay/i : pl.zona === 'Machu Picchu' ? /machu picchu/i : new RegExp(pl.zona, 'i');
      card = [...root.querySelectorAll<HTMLElement>('article')].find((a) => words.test(a.textContent ?? ''));
      if (!card) root.scrollBy({ top: 300, behavior: 'smooth' });
      await wait(400);
    }
    if (!card) return fail('No encontré la tarjeta del lugar.');

    look('busco un botón “Agregar” dentro de la tarjeta');
    const add = findByText(/agregar/i, card);
    if (!add) {
      look('reintento: quizá el botón tiene otro texto');
      const any = findByText(/agregar|añadir|reservar/i, card);
      if (!any) return fail('No hay ningún botón “Agregar” en la tarjeta. El texto cambió y no sé qué tocar.');
    }
    await click(add!, 'Agregar a mi ruta');

    look('apareció un cuadro: busco el día y las personas');
    const dlg = document.querySelector<HTMLDialogElement>('dialog[open]');
    const daySel = dlg?.querySelector<HTMLSelectElement>('select[name="dia"]');
    const pplInput = dlg?.querySelector<HTMLInputElement>('input[name="personas"]');
    if (!dlg || !daySel) return fail('No encontré dónde elegir el día.');
    await moveTo(daySel);
    daySel.value = String(Math.min(pl.dia, 5));
    if (pplInput) pplInput.value = String(personas);
    steps++;
    onStep({ kind: 'call', text: `⌨ Día ${pl.dia}, ${personas} ${personas === 1 ? 'persona' : 'personas'}` });
    const ok = findByText(/confirmar/i, dlg);
    if (!ok) return fail('No encontré el botón para confirmar.');
    await click(ok, 'Confirmar');
    look('verifico si funcionó');
    const err = document.querySelector('.toast.error:not([hidden])');
    if (err) return fail(`La página mostró un error que no sé interpretar: “${err.textContent?.trim()}”`);
  }
  cursor.hidden = true;
  onStep({ kind: 'answer', text: 'Creo que lo logré (no puedo leer el estado de la app: solo veo la pantalla).' });
  return { steps, tokens: tok, ms: performance.now() - t0, ok: true };
}
