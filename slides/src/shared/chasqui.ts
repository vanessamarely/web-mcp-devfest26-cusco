// Crea tu chasqui: avatar inspirado en los chasquis, los mensajeros del Tawantinsuyu que
// corrían por el Qhapaq Ñan llevando quipus de posta en posta. El quipu era un mensaje
// ESTRUCTURADO (cuerdas, colores y nudos) que cualquiera en la red sabía leer: la mejor
// metáfora de una tool de WebMCP (nombre, descripción y JSON Schema).
//
// Todo se dibuja en el dispositivo con SVG (y canvas para el PNG): sin red, sin fotos.
// Al muro solo viajan las opciones (pocos bytes); el deck vuelve a dibujar el SVG.
import { EVENT, SPEAKER, SPEAKER_HANDLE, TALK_TITLE } from './config';

export interface ChasquiOptions {
  poncho: number;
  pallay: number;
  tocado: number;
  piel: number;
  accesorio: number;
  expresion: number;
}

export const DEFAULT_CHASQUI: ChasquiOptions = { poncho: 0, pallay: 0, tocado: 0, piel: 2, accesorio: 1, expresion: 0 };

/** Paletas del poncho: [base, acento, acento 2, borde] — colores de Google con nombres de Cusco. */
export const PONCHOS = [
  { label: 'Vinicunca', c: ['#ea4335', '#ffd427', '#5cdb6d', '#57caff'] },
  { label: 'Chinchero', c: ['#c5221f', '#1e1e1e', '#ffd427', '#34a853'] },
  { label: 'Ausangate', c: ['#4285f4', '#c3ecf6', '#ffffff', '#f9ab00'] },
  { label: 'Inti Raymi', c: ['#f9ab00', '#ea4335', '#ffe7a5', '#4285f4'] },
  { label: 'Valle Sagrado', c: ['#34a853', '#ccf6c5', '#f9ab00', '#ea4335'] },
  { label: 'Pisaq', c: ['#8430ce', '#ff7daf', '#ffd427', '#5cdb6d'] },
] as const;

/** Pallay: los diseños tejidos de los textiles cusqueños. */
export const PALLAYS = ['Rombos (qocha)', 'Chakana', 'Mayu (río)', 'Inti (sol)', 'Listas'] as const;
export const TOCADOS = ['Chullo', 'Montera', 'Sombrero de Chinchero', 'Trenzas', "Llawt'u", 'Corto'] as const;
export const PIELES = ['#f6d3b3', '#e8b48a', '#c98b5e', '#9a6440', '#6b4329'] as const;
export const ACCESORIOS = ['Ninguno', 'Quipu', 'Pututu', 'Alpaca', 'Laptop', 'Charango', 'Choclo'] as const;
export const EXPRESIONES = ['Sonrisa', 'Guiño', 'Sorpresa', 'Concentrado'] as const;

/** El encargo que lleva tu chasqui (lista cerrada: nada de texto libre llega al proyector). */
export const ENCARGOS = [
  'Mi web ya registra tools',
  'Mi agente ya no adivina el DOM',
  'Una tool por intención',
  'consequentialHint en lo irreversible',
  'Valido en código, no solo en el schema',
  'Mi formulario ya tiene toolname',
  'Gemini Nano corre en mi laptop',
  'MCP en el backend, WebMCP en el navegador',
  'AbortSignal para quitar tools',
  'Quiero probar el Origin Trial',
  'untrustedContentHint para las reseñas',
  'Mi sitio está listo para agentes',
] as const;

export const LEYENDA =
  'Los chasquis corrían por el Qhapaq Ñan llevando quipus de posta en posta: mensajes estructurados con cuerdas, colores y nudos que cualquiera en la red sabía leer. Hoy tus tools de WebMCP son el quipu, y los agentes, los nuevos chasquis.';

const INK = '#1e1e1e';
const HAIR = '#2b2118';
let seq = 0;

const clampIdx = (n: number, len: number) => (Number.isInteger(n) && n >= 0 && n < len ? n : 0);

export function normalizeChasqui(o: Partial<ChasquiOptions> | null | undefined): ChasquiOptions {
  return {
    poncho: clampIdx(o?.poncho ?? 0, PONCHOS.length),
    pallay: clampIdx(o?.pallay ?? 0, PALLAYS.length),
    tocado: clampIdx(o?.tocado ?? 0, TOCADOS.length),
    piel: clampIdx(o?.piel ?? 2, PIELES.length),
    accesorio: clampIdx(o?.accesorio ?? 0, ACCESORIOS.length),
    expresion: clampIdx(o?.expresion ?? 0, EXPRESIONES.length),
  };
}

export function randomChasqui(r: () => number = Math.random): ChasquiOptions {
  const n = (len: number) => Math.floor(r() * len);
  return { poncho: n(PONCHOS.length), pallay: n(PALLAYS.length), tocado: n(TOCADOS.length), piel: n(PIELES.length), accesorio: n(ACCESORIOS.length), expresion: n(EXPRESIONES.length) };
}

/** Pallay como <pattern> con id único por dibujo. */
function pallayDef(id: string, kind: number, [base, a1, a2]: readonly string[]): string {
  const bg = `<rect width="16" height="16" fill="${base}"/>`;
  switch (kind) {
    case 1: // chakana: cruz andina escalonada
      return `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse">${bg}<path d="M6 2h4v2h2v2h2v4h-2v2h-2v2H6v-2H4v-2H2V6h2V4h2z" fill="${a1}"/><rect x="7" y="7" width="2" height="2" fill="${a2}"/></pattern>`;
    case 2: // mayu: el río en zigzag
      return `<pattern id="${id}" width="16" height="10" patternUnits="userSpaceOnUse"><rect width="16" height="10" fill="${base}"/><path d="M0 7 L4 3 L8 7 L12 3 L16 7" fill="none" stroke="${a1}" stroke-width="2.2"/><path d="M0 10 L4 6 L8 10 L12 6 L16 10" fill="none" stroke="${a2}" stroke-width="1.2"/></pattern>`;
    case 3: // inti: soles pequeños
      return `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse">${bg}<circle cx="8" cy="8" r="3.2" fill="${a1}"/><path d="M8 1.5v2.5M8 12v2.5M1.5 8H4M12 8h2.5M3.4 3.4l1.8 1.8M10.8 10.8l1.8 1.8M3.4 12.6l1.8-1.8M10.8 5.2l1.8-1.8" stroke="${a2}" stroke-width="1.3"/></pattern>`;
    case 4: // listas
      return `<pattern id="${id}" width="16" height="12" patternUnits="userSpaceOnUse"><rect width="16" height="12" fill="${base}"/><rect y="2" width="16" height="3" fill="${a1}"/><rect y="8" width="16" height="1.5" fill="${a2}"/></pattern>`;
    default: // rombos (qocha, la laguna)
      return `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse">${bg}<path d="M8 1 L15 8 L8 15 L1 8 Z" fill="${a1}"/><path d="M8 5 L11 8 L8 11 L5 8 Z" fill="${a2}"/></pattern>`;
  }
}

const S = `stroke="${INK}" stroke-width="2" stroke-linejoin="round"`;
const CAP = `<path d="M68 96 C66 52 94 38 120 38 C146 38 174 52 172 96 C160 72 140 64 120 66 C100 64 80 72 68 96 Z" fill="${HAIR}" ${S}/>`;

function tocadoBack(t: number, [, a1, a2]: readonly string[]): string {
  if (t === 3)
    // Trenzas con t'ikas (pompones) de colores
    return `<g stroke="${INK}" stroke-width="2">
      <path d="M72 96 C60 140 64 170 70 200" fill="none" stroke="${HAIR}" stroke-width="16" stroke-linecap="round"/>
      <path d="M168 96 C180 140 176 170 170 200" fill="none" stroke="${HAIR}" stroke-width="16" stroke-linecap="round"/>
      <circle cx="70" cy="206" r="8" fill="${a1}"/><circle cx="170" cy="206" r="8" fill="${a2}"/></g>`;
  return '';
}

function tocadoFront(t: number, [base, a1, a2, borde]: readonly string[], pid: string): string {
  switch (t) {
    case 1: // Montera cusqueña: disco plano con flecos
      return `${CAP}<g ${S}>
        <ellipse cx="120" cy="54" rx="88" ry="17" fill="${a1}"/>
        <ellipse cx="120" cy="52" rx="62" ry="10" fill="url(#${pid})"/>
        <path d="M44 62 C70 76 170 76 196 62" fill="none" stroke="${borde}" stroke-width="4" stroke-dasharray="4 5"/></g>`;
    case 2: // Sombrero de Chinchero: copa baja, ala plana roja
      return `${CAP}<g ${S}>
        <ellipse cx="120" cy="60" rx="70" ry="13" fill="#ea4335"/>
        <path d="M84 60 V36 C84 30 156 30 156 36 V60 Z" fill="#c5221f"/>
        <rect x="84" y="46" width="72" height="10" fill="url(#${pid})"/>
        <ellipse cx="120" cy="34" rx="36" ry="6" fill="#ea4335"/></g>`;
    case 3: // Trenzas: raya al medio
      return `${CAP}<path d="M120 40 L120 64" stroke="#4a3a2c" stroke-width="2"/>`;
    case 4: // Llawt'u: cinta trenzada en la frente con borla roja
      return `${CAP}<g ${S}>
        <path d="M70 70 C90 56 150 56 170 70 L168 82 C150 70 90 70 72 82 Z" fill="url(#${pid})"/>
        <path d="M108 74 h24 v6 h-24 z" fill="${borde}"/>
        <g stroke="#ea4335" stroke-width="2.4">${[110, 114, 118, 122, 126, 130].map((x) => `<path d="M${x} 80 v10"/>`).join('')}</g></g>`;
    case 5: // Corto
      return `<path d="M68 94 C64 50 94 36 120 36 C150 36 176 50 172 94 C168 78 160 70 150 66 C142 76 124 80 104 76 C92 74 80 80 68 94 Z" fill="${HAIR}" ${S}/>`;
    default: // Chullo: gorro tejido con orejeras, tiras y pompón
      return `<g ${S}>
        <path d="M66 100 C62 56 92 30 120 30 C148 30 178 56 174 100 C170 94 166 92 160 92 C150 82 136 78 120 78 C104 78 90 82 80 92 C74 92 70 94 66 100 Z" fill="url(#${pid})"/>
        <path d="M66 98 C64 112 66 124 72 132 C78 126 82 112 80 92 Z M174 98 C176 112 174 124 168 132 C162 126 158 112 160 92 Z" fill="${base}"/>
        <path d="M72 132 C72 150 70 160 66 170 M168 132 C168 150 170 160 174 170" fill="none" stroke="${a1}" stroke-width="3"/>
        <circle cx="66" cy="174" r="5" fill="${a2}"/><circle cx="174" cy="174" r="5" fill="${a2}"/>
        <path d="M80 92 C96 80 144 80 160 92" fill="none" stroke="${borde}" stroke-width="5"/>
        <circle cx="120" cy="26" r="10" fill="${a1}"/></g>`;
  }
}

function face(expresion: number): string {
  const cheeks = `<circle cx="94" cy="116" r="7" fill="#ff7daf" opacity=".55"/><circle cx="146" cy="116" r="7" fill="#ff7daf" opacity=".55"/>`;
  const line = `fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"`;
  switch (expresion) {
    case 1: // guiño
      return `<circle cx="102" cy="100" r="5" fill="${INK}"/><path d="M132 100 Q138 95 144 100" ${line}/>${cheeks}<path d="M108 120 Q120 132 134 119" ${line}/>`;
    case 2: // sorpresa
      return `<circle cx="102" cy="100" r="6" fill="${INK}"/><circle cx="138" cy="100" r="6" fill="${INK}"/>${cheeks}<ellipse cx="120" cy="124" rx="7" ry="9" fill="${INK}"/>`;
    case 3: // concentrado (leyendo el JSON Schema)
      return `<path d="M94 88 Q102 85 110 89 M146 88 Q138 85 130 89" ${line}/><circle cx="102" cy="102" r="4.5" fill="${INK}"/><circle cx="138" cy="102" r="4.5" fill="${INK}"/>${cheeks}<path d="M110 122 Q120 127 130 122" ${line}/>`;
    default: // sonrisa
      return `<circle cx="102" cy="100" r="5" fill="${INK}"/><circle cx="138" cy="100" r="5" fill="${INK}"/>${cheeks}<path d="M106 118 Q120 134 134 118" ${line}/>`;
  }
}

/** Manos por defecto (a los lados del poncho). */
const hands = (skin: string, l = true, r = true) =>
  `${l ? `<circle cx="64" cy="232" r="8" fill="${skin}" ${S}/>` : ''}${r ? `<circle cx="176" cy="232" r="8" fill="${skin}" ${S}/>` : ''}`;

function accessory(n: number, skin: string, [, a1, a2]: readonly string[]): { back: string; front: string } {
  switch (n) {
    case 1: // Quipu: cuerda principal con cuerdas colgantes y nudos (¡el JSON del Tawantinsuyu!)
      return {
        back: '',
        front: `<g ${S}>
          <path d="M150 222 C170 216 196 218 214 226" fill="none" stroke="#d9a35b" stroke-width="5" stroke-linecap="round"/>
          ${[
            [160, '#ea4335'],
            [172, '#f9ab00'],
            [184, '#34a853'],
            [196, '#4285f4'],
            [208, '#ffffff'],
          ]
            .map(([x, c], i) => `<path d="M${x} ${221 + (i % 2)} v${34 + (i % 3) * 8}" stroke="${c}" stroke-width="4" stroke-linecap="round"/><circle cx="${x}" cy="${236 + i * 3}" r="3.2" fill="${c}"/><circle cx="${x}" cy="${250 + (i % 3) * 4}" r="2.6" fill="${c}"/>`)
            .join('')}
        </g>${hands(skin, true, false)}<circle cx="156" cy="226" r="8" fill="${skin}" ${S}/>`,
      };
    case 2: // Pututu: la caracola con la que el chasqui anunciaba su llegada
      return {
        back: '',
        front: `<g ${S}>
          <path d="M150 128 C172 112 206 118 210 142 C214 166 190 178 172 170 C160 164 154 150 150 128 Z" fill="#fff4e0"/>
          <path d="M158 134 C176 126 196 132 198 146 M164 150 C178 146 190 150 192 158" fill="none" stroke="#d9a35b" stroke-width="2.2"/>
          <path d="M150 128 L140 124" stroke-width="5" stroke-linecap="round"/></g>
          <circle cx="174" cy="176" r="8" fill="${skin}" ${S}/>${hands(skin, true, false)}`,
      };
    case 3: // Alpaca a su lado: cuello largo, orejas en punta, lana esponjosa y borlas en las orejas
      return {
        back: `<g ${S}>
          <path d="M168 262 v30 M180 264 v30 M200 264 v30 M212 262 v30" stroke-width="6" stroke-linecap="round"/>
          <path d="M165 292 h7 M177 294 h7 M197 294 h7 M209 292 h7" stroke-width="4" stroke-linecap="round"/>
          <path d="M160 252 C154 236 166 226 176 230 C180 220 194 220 198 228 C206 222 220 228 218 240 C226 246 224 262 214 266 C206 274 186 274 176 270 C164 272 156 262 160 252 Z" fill="#fff4e0"/>
          <path d="M158 246 C150 244 148 252 154 256" fill="#fff4e0"/>
          <path d="M204 236 C204 214 204 196 208 184 L224 184 C226 200 222 220 220 240 Z" fill="#fff4e0"/>
          <path d="M203 190 C200 176 212 168 222 170 C232 170 238 178 236 186 C234 194 226 196 216 196 C210 196 205 195 203 190 Z" fill="#fff4e0"/>
          <path d="M206 172 C202 160 204 150 208 146 C212 154 213 164 212 172 Z M216 170 C216 158 220 150 224 146 C226 156 224 164 222 172 Z" fill="#fff4e0"/>
          <circle cx="207" cy="148" r="4" fill="${a1}"/><circle cx="224" cy="148" r="4" fill="${a2}"/>
          <circle cx="222" cy="182" r="2.4" fill="${INK}" stroke="none"/>
          <path d="M232 186 c2 2 2 4 0 5" fill="none" stroke-width="1.6"/>
          <path d="M228 192 q4 2 6 0" fill="none" stroke-width="1.6"/>
          <path d="M205 214 C211 218 219 218 223 214" fill="none" stroke="${a1}" stroke-width="5"/>
          <path d="M206 222 C212 226 218 226 222 222" fill="none" stroke="${a2}" stroke-width="3"/>
          <path d="M168 244 c4 -3 8 -3 12 0 M188 240 c4 -3 8 -3 12 0 M172 258 c4 -3 8 -3 12 0 M194 256 c4 -3 8 -3 12 0" fill="none" stroke-width="1.4" opacity=".6"/></g>`,
        front: hands(skin),
      };
    case 4: // Laptop
      return {
        back: '',
        front: `<g ${S}>
          <rect x="84" y="196" width="72" height="44" rx="5" fill="#f0f0f0"/>
          <path d="M76 240 H164 L158 250 H82 Z" fill="#c4c4c4"/>
          <rect x="91" y="203" width="58" height="30" rx="2" fill="#1e1e1e"/>
          <path d="M98 212 l6 4 -6 4 M108 222 h12" fill="none" stroke="#5cdb6d" stroke-width="2.4" stroke-linecap="round"/>
          <circle cx="78" cy="236" r="8" fill="${skin}"/><circle cx="162" cy="236" r="8" fill="${skin}"/></g>`,
      };
    case 5: // Charango
      return {
        back: '',
        front: `<g ${S}>
          <path d="M150 182 L206 136" stroke="#8b5a2b" stroke-width="7" stroke-linecap="round"/>
          <rect x="198" y="124" width="16" height="14" rx="3" fill="#6b4329" transform="rotate(-40 206 131)"/>
          <ellipse cx="146" cy="196" rx="24" ry="18" fill="#d9a35b" transform="rotate(-40 146 196)"/>
          <circle cx="148" cy="192" r="5" fill="${INK}"/>
          <path d="M138 202 L204 140" stroke="#ffffff" stroke-width="0.8"/></g>
          <circle cx="132" cy="210" r="8" fill="${skin}" ${S}/><circle cx="176" cy="164" r="8" fill="${skin}" ${S}/>${hands(skin, true, false)}`,
      };
    case 6: // Choclo gigante del Valle Sagrado
      return {
        back: '',
        front: `<g ${S}>
          <path d="M168 168 C150 180 152 226 168 244 C172 226 172 196 168 168 Z" fill="#34a853"/>
          <ellipse cx="180" cy="200" rx="14" ry="34" fill="#ffe7a5"/>
          <g fill="#f9ab00" stroke="none">${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="175" cy="${176 + i * 9}" r="3"/><circle cx="185" cy="${180 + i * 9}" r="3"/>`).join('')}</g>
          <path d="M194 176 C206 190 204 226 190 244" fill="#5cdb6d"/></g>${hands(skin, true, false)}<circle cx="182" cy="236" r="8" fill="${skin}" ${S}/>`,
      };
    default:
      return { back: '', front: hands(skin) };
  }
}

/** SVG del chasqui (viewBox 240×344). `title` da nombre accesible. */
export function chasquiSVG(opts: ChasquiOptions, title = 'Chasqui'): string {
  const o = normalizeChasqui(opts);
  const colors = PONCHOS[o.poncho].c;
  const [base, a1, , borde] = colors;
  const skin = PIELES[o.piel];
  const id = `cq${++seq}`;
  const pallay = `${id}-p`;
  const band = `${id}-b`;
  const acc = accessory(o.accesorio, skin, colors);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -24 240 344" role="img" aria-label="${escapeXml(title)}">
  <title>${escapeXml(title)}</title>
  <defs>
    ${pallayDef(pallay, o.pallay, colors)}
    <pattern id="${band}" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${borde}"/><path d="M0 6 L6 0 L12 6 L6 12 Z" fill="${a1}"/></pattern>
  </defs>
  ${acc.back}
  ${tocadoBack(o.tocado, colors)}
  <!-- Piernas y ojotas -->
  <g ${S}>
    <rect x="94" y="236" width="20" height="50" rx="6" fill="#3c3c3c"/>
    <rect x="126" y="236" width="20" height="50" rx="6" fill="#3c3c3c"/>
    <rect x="94" y="270" width="20" height="12" fill="${skin}"/><rect x="126" y="270" width="20" height="12" fill="${skin}"/>
    <ellipse cx="102" cy="292" rx="15" ry="7" fill="#8b5a2b"/><ellipse cx="138" cy="292" rx="15" ry="7" fill="#8b5a2b"/>
  </g>
  <!-- Poncho con pallay y borde tejido -->
  <g ${S}>
    <path d="M80 146 C100 136 140 136 160 146 L186 236 C150 248 90 248 54 236 Z" fill="${base}"/>
    <path d="M96 152 C110 146 130 146 144 152 L156 232 C132 238 108 238 84 232 Z" fill="url(#${pallay})"/>
    <path d="M54 236 C90 248 150 248 186 236 L184 244 C150 256 90 256 56 244 Z" fill="url(#${band})"/>
    <path d="M60 248 v8 M72 250 v8 M84 252 v8 M96 253 v8 M108 254 v8 M120 254 v8 M132 254 v8 M144 253 v8 M156 252 v8 M168 250 v8 M180 248 v8" stroke="${borde}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M106 142 Q120 154 134 142" fill="none"/>
  </g>
  <!-- Cabeza -->
  <rect x="110" y="132" width="20" height="14" fill="${skin}" ${S}/>
  <circle cx="120" cy="96" r="52" fill="${skin}" ${S}/>
  ${tocadoFront(o.tocado, colors, pallay)}
  ${face(o.expresion)}
  ${acc.front}
</svg>`;
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export interface ChasquiCard {
  name: string;
  encargo: number;
  opts: ChasquiOptions;
}

/** Franja de tejido andino (rombos + escalones) para el PNG. */
function textileBand(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, [base, a1, a2, borde]: readonly string[]) {
  ctx.fillStyle = base;
  ctx.fillRect(x0, y0, w, 64);
  for (let x = x0; x < x0 + w; x += 64) {
    ctx.fillStyle = a1;
    ctx.beginPath();
    ctx.moveTo(x + 32, y0 + 6);
    ctx.lineTo(x + 58, y0 + 32);
    ctx.lineTo(x + 32, y0 + 58);
    ctx.lineTo(x + 6, y0 + 32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = a2;
    // chakana pequeña al centro
    ctx.fillRect(x + 26, y0 + 20, 12, 24);
    ctx.fillRect(x + 20, y0 + 26, 24, 12);
  }
  ctx.fillStyle = borde;
  ctx.fillRect(x0, y0 + 64, w, 10);
}

/** PNG 1080×1350 para compartir: el chasqui, su nombre, su encargo y la leyenda. */
export async function chasquiPNG(card: ChasquiCard): Promise<Blob> {
  await document.fonts?.ready;
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const o = normalizeChasqui(card.opts);
  const colors = PONCHOS[o.poncho].c;
  const sans = "'Google Sans', system-ui, sans-serif";
  const mono = "'Roboto Mono', ui-monospace, monospace";

  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, W, H);
  const r = 56;
  ctx.beginPath();
  ctx.roundRect(48, 48, W - 96, H - 96, r);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1e1e1e';
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(48, 48, W - 96, H - 96, r);
  ctx.clip();
  textileBand(ctx, 48, 48, W - 96, colors);
  // Montañas al fondo (Apus) con las franjas de Vinicunca
  const stripes = ['#ea4335', '#f9ab00', '#ffd427', '#5cdb6d', '#57caff'];
  stripes.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.moveTo(48, 860 - i * 22);
    ctx.lineTo(300, 600 - i * 22);
    ctx.lineTo(520, 800 - i * 22);
    ctx.lineTo(760, 560 - i * 22);
    ctx.lineTo(W - 48, 820 - i * 22);
    ctx.lineTo(W - 48, 900);
    ctx.lineTo(48, 900);
    ctx.closePath();
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(48, 122);
  ctx.lineTo(W - 48, 122);
  ctx.stroke();

  ctx.fillStyle = '#4b4b4b';
  ctx.font = `300 30px ${mono}`;
  ctx.fillText('// MI CHASQUI · ' + EVENT.toUpperCase(), 104, 186);

  const img = await loadImage(svgDataUrl(chasquiSVG(o, card.name)));
  ctx.drawImage(img, W / 2 - 220, 220, 440, 631); // viewBox 240×344

  ctx.fillStyle = '#1e1e1e';
  ctx.textAlign = 'center';
  ctx.font = `700 76px ${sans}`;
  ctx.fillText(card.name || 'Mi chasqui', W / 2, 940, W - 200);
  const encargo = ENCARGOS[clampIdx(card.encargo, ENCARGOS.length)];
  ctx.font = `500 38px ${sans}`;
  const text = `Mi quipu dice: “${encargo}”`;
  const pw = Math.min(ctx.measureText(text).width + 64, W - 160);
  ctx.beginPath();
  ctx.roundRect(W / 2 - pw / 2, 970, pw, 74, 37);
  ctx.fillStyle = '#ffe7a5';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#1e1e1e';
  ctx.fillText(text, W / 2, 1020, W - 200);
  ctx.font = `400 26px ${sans}`;
  ctx.fillStyle = '#4b4b4b';
  wrap(ctx, LEYENDA, W - 240).forEach((l, i) => ctx.fillText(l, W / 2, 1094 + i * 34));
  ctx.textAlign = 'left';
  ctx.font = `300 24px ${mono}`;
  ctx.fillStyle = '#1e1e1e';
  ctx.fillText(TALK_TITLE, 104, H - 96, W - 400);
  ctx.fillStyle = '#4b4b4b';
  ctx.fillText(`${SPEAKER} · ${SPEAKER_HANDLE}`, 104, H - 64);
  ['#4285f4', '#ea4335', '#f9ab00', '#34a853'].forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(W - 120 - (3 - i) * 34, H - 84, 12, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}

/** Data URL PNG pequeña para incrustar en la memoria PDF. */
export async function chasquiPNGDataUrl(opts: ChasquiOptions, size = 360): Promise<string> {
  const img = await loadImage(svgDataUrl(chasquiSVG(opts)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((size * 240) / 344);
  canvas.height = size;
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/** Silueta para quien no publicó su chasqui (podio). */
export function chasquiSilhouette(title = 'Sin chasqui'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -24 240 344" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title>
  <g fill="#c4c7c5" stroke="#8a8d8b" stroke-width="3" stroke-linejoin="round">
    <path d="M80 146 C100 136 140 136 160 146 L186 236 C150 248 90 248 54 236 Z"/>
    <rect x="94" y="236" width="20" height="50" rx="6"/><rect x="126" y="236" width="20" height="50" rx="6"/>
    <circle cx="120" cy="96" r="52"/>
  </g>
  <text x="120" y="116" text-anchor="middle" font-family="system-ui, sans-serif" font-size="56" font-weight="700" fill="#8a8d8b">?</text></svg>`;
}
