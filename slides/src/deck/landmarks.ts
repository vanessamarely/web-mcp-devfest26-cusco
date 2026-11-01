// Paisajes emblemáticos de Cusco detrás de los chasquis (capítulos, portada y cierre).
// Ilustración plana con el trazo del deck (tinta #1e1e1e) y los colores de Google.
// viewBox 400×720 y preserveAspectRatio "xMidYMax slice": el suelo siempre queda abajo y
// los lados se recortan en 4:3 sin deformar nada.
const INK = '#1e1e1e';
const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

// Lienzo 520×720 (proporción del panel en 16:9); el dibujo vive en x 60–460 y los fondos se
// extienden a los lados, así en 4:3 solo se recortan los costados (nunca el cielo ni los picos).
const svg = (body: string, label: string) =>
  `<svg class="landmark-svg" viewBox="0 0 520 720" preserveAspectRatio="xMidYMax slice" role="img" aria-label="${label}"><title>${label}</title><g transform="translate(60 0)">${body}</g></svg>`;

const cloud = (x: number, y: number, s = 1) =>
  `<g class="lm-cloud" transform="translate(${x} ${y}) scale(${s})"><path d="M0 30 C0 14 16 8 26 14 C30 0 52 -2 60 12 C72 6 88 14 86 30 Z" fill="#fff" ${S}/></g>`;

/** Sol inca (Inti, como el disco dorado del Qorikancha): rayos que giran despacio. */
const inti = (x: number, y: number, r: number, face = false) => {
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI) / 8;
    const r1 = r + 8;
    const r2 = r + (i % 2 ? 22 : 34);
    const w = 0.12;
    const p = (rr: number, aa: number) => `${(Math.cos(aa) * rr).toFixed(1)} ${(Math.sin(aa) * rr).toFixed(1)}`;
    return `<path d="M${p(r1, a - w)} L${p(r2, a)} L${p(r1, a + w)} Z" fill="#f9ab00" ${S}/>`;
  }).join('');
  const f = face
    ? `<circle cx="${-r * 0.32}" cy="${-r * 0.12}" r="${r * 0.09}" fill="${INK}"/><circle cx="${r * 0.32}" cy="${-r * 0.12}" r="${r * 0.09}" fill="${INK}"/>
       <path d="M${-r * 0.36} ${r * 0.28} Q0 ${r * 0.52} ${r * 0.36} ${r * 0.28}" fill="none" ${S}/><path d="M0 ${-r * 0.05} v${r * 0.22}" ${S}/>`
    : '';
  return `<g transform="translate(${x} ${y})"><g class="lm-rays">${rays}</g><circle r="${r}" fill="#ffd427" ${S}/><circle r="${r * 0.72}" fill="none" stroke="#f9ab00" stroke-width="4"/>${f}</g>`;
};

/** Cóndor andino planeando (alas largas, collar blanco). */
const condor = (x: number, y: number, s = 1) =>
  `<g class="lm-condor" transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 0 C-30 -14 -62 -12 -96 4 C-70 2 -52 8 -36 14 L-12 8 Z" fill="${INK}"/>
    <path d="M0 0 C30 -14 62 -12 96 4 C70 2 52 8 36 14 L12 8 Z" fill="${INK}"/>
    <path d="M-90 4 l-8 6 M-82 6 l-6 8 M90 4 l8 6 M82 6 l6 8" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="0" cy="8" rx="13" ry="9" fill="${INK}"/><path d="M-9 1 Q0 -4 9 1" stroke="#fff" stroke-width="4" fill="none"/>
    <circle cx="0" cy="-5" r="5" fill="#ea4335"/></g>`;

/** Alpaca pequeña de perfil. */
const alpaca = (x: number, y: number, s = 1, c = '#fff4e0', flip = false) =>
  `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">
    <path d="M-16 20 v18 M-6 22 v18 M10 22 v18 M18 20 v18" ${S}/>
    <path d="M-24 10 C-26 -2 -12 -8 0 -4 C10 -10 26 -6 26 6 C30 16 20 26 6 24 C-6 28 -22 24 -24 10 Z" fill="${c}" ${S}/>
    <path d="M14 -2 C14 -18 14 -30 18 -38 L28 -38 C30 -26 28 -12 26 2 Z" fill="${c}" ${S}/>
    <path d="M14 -40 C12 -48 22 -54 30 -48 C36 -44 34 -36 28 -36 C22 -35 16 -36 14 -40 Z" fill="${c}" ${S}/>
    <path d="M17 -48 l-2 -10 5 6 M25 -50 l2 -10 -6 6" fill="${c}" ${S}/>
    <circle cx="26" cy="-44" r="1.8" fill="${INK}"/><path d="M15 -20 h12" stroke="#ea4335" stroke-width="5"/></g>`;

/** 01 · Machu Picchu: Huayna Picchu, andenes y casitas de piedra con techo de ichu. */
export function machuPicchu(): string {
  const terraces = Array.from({ length: 6 }, (_, i) => {
    const y = 440 + i * 22;
    const inset = 70 - i * 12;
    return `<path d="M${inset} ${y} H${400 - inset} L${410 - inset} ${y + 22} H${inset - 10} Z" fill="${i % 2 ? '#5cdb6d' : '#ccf6c5'}" ${S}/>`;
  }).join('');
  const house = (x: number, y: number) =>
    `<g transform="translate(${x} ${y})"><rect x="-22" y="-26" width="44" height="26" fill="#e8e1d5" ${S}/><path d="M-6 0 L-4 -16 H4 L6 0 Z" fill="${INK}"/><path d="M-28 -26 L0 -48 L28 -26 Z" fill="#f9ab00" ${S}/><path d="M-22 -14 h12 M8 -18 h14 M-14 -6 h6" stroke="${INK}" stroke-width="1.5"/></g>`;
  return svg(
    `<rect x="-80" width="680" height="720" fill="#c3ecf6"/>
     ${inti(330, 96, 30)}
     ${cloud(30, 120, 0.9)}${cloud(190, 70, 0.7)}
     ${condor(110, 210, 0.55)}
     <path d="M-80 450 L-40 340 L40 300 L90 360 L140 280 L190 450 Z" fill="#0b8043" opacity=".55" ${S}/>
     <path d="M130 450 L208 150 Q224 124 240 150 L300 330 L344 360 L480 450 Z" fill="#34a853" ${S}/>
     <path d="M208 150 Q224 124 240 150 L262 240 C246 230 232 236 220 250 Z" fill="#5cdb6d" ${S}/>
     <path d="M196 300 h70 M186 340 h96 M174 380 h120" stroke="#0b8043" stroke-width="3" stroke-dasharray="10 8"/>
     ${terraces}
     ${house(110, 438)}${house(180, 430)}${house(270, 438)}
     <rect x="-80" y="572" width="680" height="160" fill="#5cdb6d" ${S}/>`,
    'Machu Picchu y Huayna Picchu',
  );
}

/** Muro inca (Hatun Rumiyoc / Sacsayhuamán): piedras poligonales encajadas y puerta trapezoidal, con el Inti. */
export function piedraInca(): string {
  // Piedras poligonales con semilla fija: filas onduladas y juntas inclinadas.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rows = [300, 382, 470, 552, 640, 730];
  const line = (y: number) => {
    const pts: string[] = [];
    for (let x = -80; x <= 480; x += 40) pts.push(`${x},${(y + (rnd() - 0.5) * 18).toFixed(0)}`);
    return pts;
  };
  const lines = rows.map(line);
  let joints = '';
  for (let r = 0; r < lines.length - 1; r++) {
    let x = -70 + rnd() * 40;
    while (x < 470) {
      const yTop = Number(lines[r][Math.min(14, Math.max(0, Math.round((x + 80) / 40)))].split(',')[1]);
      const yBot = Number(lines[r + 1][Math.min(14, Math.max(0, Math.round((x + 80) / 40)))].split(',')[1]);
      const lean = (rnd() - 0.5) * 22;
      joints += `<path d="M${x.toFixed(0)} ${yTop} Q${(x + lean).toFixed(0)} ${((yTop + yBot) / 2).toFixed(0)} ${(x + lean / 2).toFixed(0)} ${yBot}" fill="none" ${S}/>`;
      x += 60 + rnd() * 70;
    }
  }
  const rowsSvg = lines.map((pts) => `<polyline points="${pts.join(' ')}" fill="none" ${S}/>`).join('');
  return svg(
    `<rect x="-80" width="680" height="720" fill="#ffe7a5"/>
     ${inti(200, 150, 58, true)}
     ${cloud(18, 70, 0.8)}${cloud(300, 250, 0.6)}
     <rect x="-80" y="296" width="680" height="440" fill="#d8cdb8"/>
     ${rowsSvg}${joints}
     <path d="M142 422 L188 410 L214 420 L230 446 L222 476 L196 488 L160 482 L140 458 Z" fill="#e8dfcd" ${S}/>
     <path d="M148 432 l6 -4 M210 426 l4 6" stroke="${INK}" stroke-width="1.5"/>
     <path d="M158 730 L172 520 L228 520 L242 730 Z" fill="#3c3c3c" ${S}/>
     <path d="M166 520 h68" stroke="${INK}" stroke-width="6"/>`,
    'Muro inca de piedras encajadas y el Inti',
  );
}

/** Vinicunca (montaña de siete colores) con el nevado Ausangate y alpacas. */
export function vinicunca(): string {
  const colors = ['#ff7daf', '#ea4335', '#f9ab00', '#ffd427', '#5cdb6d', '#57caff', '#8b5a2b'];
  const stripes = colors.map((c, i) => `<path d="M-100 ${300 + i * 34} C80 ${270 + i * 34} 200 ${330 + i * 30} 500 ${290 + i * 34} L500 ${334 + i * 34} C200 ${374 + i * 30} 80 ${314 + i * 34} -100 ${344 + i * 34} Z" fill="${c}"/>`).join('');
  return svg(
    `<defs><clipPath id="vin-clip"><path d="M-80 600 L-80 420 L60 360 L150 290 L230 330 L300 260 L420 380 L480 420 L480 600 Z"/></clipPath></defs>
     <rect x="-80" width="680" height="720" fill="#c3ecf6"/>
     ${cloud(250, 60, 0.8)}
     ${condor(90, 120, 0.5)}
     <path d="M0 360 L170 110 L230 190 L280 130 L460 360 Z" fill="#9aa9b8" ${S}/>
     <path d="M140 168 L170 110 L200 150 L188 168 L172 158 L160 176 Z M262 160 L280 130 L300 166 L286 160 Z" fill="#fff" ${S}/>
     <g clip-path="url(#vin-clip)">${stripes}</g>
     <path d="M-80 600 L-80 420 L60 360 L150 290 L230 330 L300 260 L420 380 L480 420 L480 600 Z" fill="none" ${S}/>
     <rect x="-80" y="560" width="680" height="170" fill="#ccb38a" ${S}/>
     ${alpaca(70, 548, 1)}${alpaca(330, 556, 0.85, '#8b5a2b', true)}`,
    'Vinicunca, la montaña de siete colores, y el nevado Ausangate',
  );
}

/** Portada y cierre: el cielo de Cusco (Inti, nubes y cóndor) sobre la montaña de colores (Vinicunca). */
export function coverSky(): string {
  return `<svg class="landmark-svg" viewBox="0 0 520 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g transform="translate(60 0)">
    ${inti(300, 130, 44)}
    ${cloud(40, 90, 0.9)}${cloud(170, 190, 0.6)}
    ${condor(120, 260, 0.7)}
  </g></svg>`;
}

export const LANDMARKS: Record<string, () => string> = { machu: machuPicchu, piedra: piedraInca, vinicunca, cover: coverSky };

/** Piezas sueltas para los efectos de reacciones (SVG independientes). */
export const condorSVG = () => `<svg viewBox="-110 -30 220 60" aria-hidden="true">${condor(0, 0, 1)}</svg>`;
export const intiSVG = () => `<svg viewBox="-110 -110 220 220" aria-hidden="true">${inti(0, 0, 62, true)}</svg>`;
