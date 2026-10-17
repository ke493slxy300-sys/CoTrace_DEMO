import type { ReactNode } from 'react';
import type { CodeLanguage } from '../types';

type TokenKind =
  | 'plain'
  | 'keyword'
  | 'string'
  | 'comment'
  | 'number'
  | 'function'
  | 'punctuation'
  | 'property';

const JS_KEYWORDS = new Set([
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'null',
  'of',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'undefined',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

function pushToken(
  out: Array<{ kind: TokenKind; text: string }>,
  kind: TokenKind,
  text: string,
) {
  if (!text) return;
  out.push({ kind, text });
}

/** 轻量演示用高亮：不追求完整解析，只让 JS/JSON 看起来像 IDE */
export function tokenizeLine(
  line: string,
  language: CodeLanguage,
): Array<{ kind: TokenKind; text: string }> {
  if (language !== 'javascript' && language !== 'json' && language !== 'typescript') {
    return [{ kind: 'plain', text: line.length ? line : ' ' }];
  }

  const tokens: Array<{ kind: TokenKind; text: string }> = [];
  let i = 0;

  while (i < line.length) {
    if (line[i] === '/' && line[i + 1] === '/') {
      pushToken(tokens, 'comment', line.slice(i));
      break;
    }

    const ch = line[i];

    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === '\\') {
          j += 2;
          continue;
        }
        if (line[j] === quote) {
          j += 1;
          break;
        }
        j += 1;
      }
      pushToken(tokens, 'string', line.slice(i, j));
      i = j;
      continue;
    }

    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /[0-9._xXa-fA-F]/.test(line[j])) j += 1;
      pushToken(tokens, 'number', line.slice(i, j));
      i = j;
      continue;
    }

    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /[A-Za-z0-9_$]/.test(line[j])) j += 1;
      const word = line.slice(i, j);
      let k = j;
      while (k < line.length && /\s/.test(line[k])) k += 1;
      if (line[k] === '(') {
        pushToken(tokens, 'function', word);
      } else if (JS_KEYWORDS.has(word)) {
        pushToken(tokens, 'keyword', word);
      } else if (language === 'json') {
        pushToken(tokens, 'property', word);
      } else {
        pushToken(tokens, 'plain', word);
      }
      i = j;
      continue;
    }

    if (/[{}()\[\];,.:=<>!&|?+\-*/%]/.test(ch)) {
      pushToken(tokens, 'punctuation', ch);
      i += 1;
      continue;
    }

    pushToken(tokens, 'plain', ch);
    i += 1;
  }

  if (tokens.length === 0) return [{ kind: 'plain', text: ' ' }];
  return tokens;
}

export function renderHighlightedLine(
  line: string,
  language: CodeLanguage,
): ReactNode {
  const tokens = tokenizeLine(line, language);
  return tokens.map((token, index) => (
    <span key={`${index}-${token.kind}`} className={`tok tok-${token.kind}`}>
      {token.text}
    </span>
  ));
}
