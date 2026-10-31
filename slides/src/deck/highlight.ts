// Resaltado de sintaxis mínimo (sin dependencias) para los bloques del deck.
// Trabaja línea por línea: ningún <span> cruza un salto de línea, así el modo foco
// (code-focus.ts) puede envolver cada línea sin romper etiquetas.
import { esc } from '../shared/esc';

const JS_KW = /^(const|let|await|async|return|if|new|import|from|export|function|true|false|null|of|for)$/;

function jsLine(line: string): string {
  const re = /(\/\/.*$|\/\*.*?\*\/)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b\d+\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)/g;
  let out = '';
  let last = 0;
  for (const m of line.matchAll(re)) {
    out += esc(line.slice(last, m.index));
    const [tok, com, str, num, fn, word] = m;
    if (com) out += `<span class="tk-c">${esc(com)}</span>`;
    else if (str) out += `<span class="tk-s">${esc(str)}</span>`;
    else if (num) out += `<span class="tk-n">${esc(num)}</span>`;
    else if (fn) out += JS_KW.test(fn) ? `<span class="tk-k">${esc(fn)}</span>` : `<span class="tk-f">${esc(fn)}</span>`;
    else if (word) out += JS_KW.test(word) ? `<span class="tk-k">${esc(word)}</span>` : /^(document|modelContext|server|controller|ruta|form|e)$/.test(word) ? `<span class="tk-p">${esc(word)}</span>` : esc(word);
    else out += esc(tok);
    last = (m.index ?? 0) + tok.length;
  }
  return out + esc(line.slice(last));
}

function htmlLine(line: string): string {
  // Dentro de <script> resaltamos como JS.
  if (!/[<>]/.test(line) || /^\s*(form|if|e\.|\}\))/.test(line)) return jsLine(line);
  return line.replace(/(<\/?)([\w-]+)|([\w-]+)(=)("[^"]*")|(>)|(\s+|[^<>="\s]+|[="])/g, (all, open, tag, attr, eq, val, close, text) => {
    if (open) return `${esc(open)}<span class="tk-k">${esc(tag)}</span>`;
    if (attr) return `<span class="${/^tool/.test(attr) ? 'tk-p' : 'tk-f'}">${esc(attr)}</span>${eq}<span class="tk-s">${esc(val)}</span>`;
    if (close) return esc(close);
    return esc(text ?? all);
  });
}

export function highlight(src: string, lang: 'js' | 'html'): string {
  return src
    .split('\n')
    .map((l) => (lang === 'html' ? htmlLine(l) : jsLine(l)))
    .join('\n');
}
