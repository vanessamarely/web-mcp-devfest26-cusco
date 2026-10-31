// Graba los clips de la demo para los slides (plan B y para MOSTRAR la demo en la charla).
// Usa Playwright con el Google Chrome instalado (no descarga navegadores).
//   npm run dev:demo            (en otra terminal)
//   node scripts/record-clips.mjs            → todos
//   node scripts/record-clips.mjs webmcp     → solo uno: webmcp | clics | redisenio | seguridad
// Salida: slides/public/clips/<nombre>.webm + <nombre>.png (póster = último cuadro).
import { chromium } from 'playwright-core';
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'slides/public/clips');
const TMP = join(ROOT, '.clips-tmp');
const DEMO = process.env.DEMO_URL ?? 'http://localhost:5174';
const SIZE = { width: 1280, height: 760 };
const PROMPT = 'Arma Machu Picchu el día 2 y el Valle Sagrado el día 3 para 2 personas';
mkdirSync(OUT, { recursive: true });

const answered = (p) => p.waitForFunction(() => document.querySelectorAll('.st.answer, .st.error').length > 0 && !document.body.className.includes('running-'), null, { timeout: 90000 });
const lastAnswered = (p, n) => p.waitForFunction((n) => document.querySelectorAll('.st.answer').length >= n && !document.body.className.includes('running-'), n, { timeout: 90000 });

async function typeAndRun(p, text, tab = 'webmcp') {
  await p.click(`[data-tab="${tab}"]`);
  await p.fill('[data-ask] textarea', '');
  await p.type('[data-ask] textarea', text, { delay: 18 });
  await p.waitForTimeout(400);
  await p.click('[data-run]');
}

const SCENES = {
  // 1 · El agente con WebMCP: 5 llamadas a tools, el formulario declarativo se marca al usarse.
  async webmcp(p) {
    await typeAndRun(p, PROMPT, 'webmcp');
    await answered(p);
    await p.waitForTimeout(2500);
  },
  // 2 · El mismo encargo con un agente que lee el DOM y hace clic.
  async clics(p) {
    await typeAndRun(p, PROMPT, 'clicker');
    await answered(p);
    await p.waitForTimeout(2500);
  },
  // 3 · Rediseño: el de clics se pierde; el de WebMCP sigue funcionando.
  async redisenio(p) {
    await p.click('[data-redesign]');
    await p.waitForTimeout(1500);
    await typeAndRun(p, PROMPT, 'clicker');
    await answered(p);
    await p.waitForTimeout(1200);
    await typeAndRun(p, PROMPT, 'webmcp');
    await lastAnswered(p, 1);
    await p.waitForTimeout(2500);
  },
  // 4 · Seguridad: autocorrección con errores descriptivos, reseña con prompt injection y reserva con confirmación.
  async seguridad(p) {
    await typeAndRun(p, 'Agrega Vinicunca el día 1 para 2 personas', 'webmcp');
    await lastAnswered(p, 1);
    await p.waitForTimeout(1200);
    await typeAndRun(p, 'Lee las reseñas de Vinicunca', 'webmcp');
    await lastAnswered(p, 2);
    await p.waitForTimeout(2200);
    await typeAndRun(p, 'Reserva mi ruta a nombre de Vanessa', 'webmcp');
    await p.waitForSelector('#confirm-dialog[open]', { timeout: 20000 });
    await p.waitForTimeout(2500);
    await p.click('[data-confirm-yes]');
    await lastAnswered(p, 3);
    await p.waitForTimeout(2500);
  },
};

const which = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const [name, scene] of Object.entries(SCENES)) {
  if (which.length && !which.includes(name)) continue;
  rmSync(TMP, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: SIZE, recordVideo: { dir: TMP, size: SIZE }, colorScheme: 'light' });
  const p = await ctx.newPage();
  await p.goto(`${DEMO}/?engine=sim&theme=light`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await scene(p);
  await p.screenshot({ path: join(OUT, `${name}.png`) });
  const video = p.video();
  await ctx.close();
  renameSync(await video.path(), join(OUT, `${name}.webm`));
  console.log('✓', name);
}
rmSync(TMP, { recursive: true, force: true });
await browser.close();
