// Einfache Syntaxhervorhebung für Code-Blöcke (Kommentare, Zeichenketten, Zahlen, Schlüsselwörter)

export const LANGUAGES = [
  ['plain', 'Text'], ['js', 'JavaScript / TypeScript'], ['python', 'Python'], ['java', 'Java / Kotlin'], ['csharp', 'C#'],
  ['go', 'Go'], ['php', 'PHP'], ['sql', 'SQL'], ['bash', 'Shell'], ['json', 'JSON'], ['yaml', 'YAML'], ['html', 'HTML / XML'],
  ['css', 'CSS'], ['dockerfile', 'Dockerfile'],
];

const words = (s) => new Set(s.split(' '));

const KEYWORDS = {
  js: words('const let var function return if else for while do switch case break continue new class extends import export from default async await try catch finally throw typeof instanceof in of this super null undefined true false yield static get set interface type enum implements public private protected readonly as void delete'),
  python: words('def return if elif else for while in not and or is class import from as try except finally raise with lambda pass break continue yield global nonlocal None True False async await assert del self'),
  java: words('public private protected class interface enum extends implements static final void return if else for while do switch case break continue new try catch finally throw throws import package this super null true false int long double float boolean char byte short var val fun object override abstract synchronized'),
  csharp: words('public private protected internal class interface enum struct static readonly void return if else for foreach while do switch case break continue new try catch finally throw using namespace this base null true false int long double float bool string char var async await get set override virtual abstract sealed record'),
  go: words('package import func return if else for range switch case break continue go defer chan select struct interface map type var const nil true false make new len append'),
  php: words('function return if else elseif foreach for while do switch case break continue new class extends implements public private protected static echo try catch finally throw use namespace null true false array fn match'),
  sql: words('select from where and or not insert into values update set delete create table alter drop index primary key foreign references join left right inner outer on group by order having limit offset as distinct union all null is in like between case when then else end default unique constraint view with returning begin commit rollback'),
  bash: words('if then else elif fi for while do done case esac in function return export local echo exit set unset source sudo cd'),
  yaml: words('true false null yes no on off'),
  json: words('true false null'),
  css: words('important media import from to'),
  dockerfile: words('FROM RUN CMD COPY ADD ENV ARG WORKDIR EXPOSE ENTRYPOINT USER VOLUME LABEL HEALTHCHECK AS SHELL ONBUILD STOPSIGNAL'),
  html: new Set(),
  plain: new Set(),
};

const LINE_COMMENT = { js: '//', java: '//', csharp: '//', go: '//', php: '//', css: null, sql: '--', python: '#', bash: '#', yaml: '#', dockerfile: '#' };
const BLOCK_COMMENT = { js: ['/*', '*/'], java: ['/*', '*/'], csharp: ['/*', '*/'], go: ['/*', '*/'], php: ['/*', '*/'], css: ['/*', '*/'], sql: ['/*', '*/'], html: ['<!--', '-->'] };

export const THEMES = {
  dark: { bg: '#1e2030', gutter: '#6b7089', text: '#e4e6f0', keyword: '#c792ea', string: '#c3e88d', number: '#f78c6c', comment: '#7f85a3', tag: '#82aaff', head: '#2a2d40' },
  light: { bg: '#f8f9fb', gutter: '#a0a4b0', text: '#24292f', keyword: '#8250df', string: '#0a7f3f', number: '#c4432b', comment: '#8c959f', tag: '#0550ae', head: '#eceef2' },
};

// Zerlegt den Code in Zeilen aus Tokens { t: Text, k: Art }. Mehrzeilige Kommentare werden über Zeilen fortgeführt.
const own = (map, key) => (Object.hasOwn(map, key) ? map[key] : undefined);

// Große Blöcke nur teilweise hervorheben, damit das Zeichnen schnell bleibt
export const MAX_LINES = 1000;
const MAX_LINE_CHARS = 2000;

export function tokenize(code, lang) {
  const kw = own(KEYWORDS, lang) || KEYWORDS.plain;
  const lc = own(LINE_COMMENT, lang);
  const bc = own(BLOCK_COMMENT, lang);
  const ci = lang === 'sql';
  const out = [];
  let inBlock = false;
  for (let line of String(code || '').split('\n').slice(0, MAX_LINES)) {
    if (line.length > MAX_LINE_CHARS) line = line.slice(0, MAX_LINE_CHARS);
    const toks = [];
    let i = 0;
    const push = (t, k) => t && toks.push({ t, k });
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf(bc[1], i);
        if (end < 0) {
          push(line.slice(i), 'comment');
          i = line.length;
        } else {
          push(line.slice(i, end + bc[1].length), 'comment');
          i = end + bc[1].length;
          inBlock = false;
        }
        continue;
      }
      const rest = line.slice(i);
      if (bc && rest.startsWith(bc[0])) {
        inBlock = true;
        push(bc[0], 'comment');
        i += bc[0].length;
        continue;
      }
      if (lc && rest.startsWith(lc) && !(lang === 'bash' && i > 0 && line[i - 1] === '$')) {
        push(rest, 'comment');
        break;
      }
      const ch = line[i];
      if (lang === 'html' && ch === '<') {
        const m = /^<\/?[\w:-]+/.exec(rest);
        if (m) {
          push(m[0], 'tag');
          i += m[0].length;
          continue;
        }
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        let j = i + 1;
        while (j < line.length && line[j] !== ch) j += line[j] === '\\' ? 2 : 1;
        push(line.slice(i, j + 1), 'string');
        i = j + 1;
        continue;
      }
      const num = /^(0x[\da-f]+|\d+(\.\d+)?(e[+-]?\d+)?)\b/i.exec(rest);
      if (num && !/[\w$]/.test(line[i - 1] || '')) {
        push(num[0], 'number');
        i += num[0].length;
        continue;
      }
      const word = /^[A-Za-z_$][\w$-]*/.exec(rest);
      if (word) {
        let w = word[0];
        if (lang !== 'css' && lang !== 'yaml' && lang !== 'html') w = /^[A-Za-z_$][\w$]*/.exec(rest)[0];
        const isKey = lang === 'yaml' ? /^\s*(- )?$/.test(line.slice(0, i)) && line.slice(i + w.length).startsWith(':') : kw.has(ci ? w.toLowerCase() : w);
        push(w, isKey ? 'keyword' : 'text');
        i += w.length;
        continue;
      }
      // sonstige Zeichen bis zum nächsten interessanten Zeichen zusammenfassen
      const m = /^[^A-Za-z_$0-9"'`<\/#-]+/.exec(rest);
      const t = m ? m[0] : ch;
      push(t, 'text');
      i += t.length;
    }
    out.push(toks);
  }
  return out;
}
