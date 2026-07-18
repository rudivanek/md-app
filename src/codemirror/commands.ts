import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';

type View = EditorView;

function selectedText(view: View): { from: number; to: number; text: string } {
  const { from, to } = view.state.selection.main;
  return { from, to, text: view.state.sliceDoc(from, to) };
}

function sel(from: number, to: number) {
  return EditorSelection.range(from, to);
}

function wrapSelection(view: View, prefix: string, suffix: string, placeholder: string) {
  const { from, to, text } = selectedText(view);
  const content = text || placeholder;
  const insert = `${prefix}${content}${suffix}`;
  view.dispatch({
    changes: { from, to, insert },
    selection: text
      ? sel(from + prefix.length, from + prefix.length + content.length)
      : sel(from + prefix.length, from + prefix.length + placeholder.length),
    scrollIntoView: true,
    userEvent: 'input.toolbar',
  });
  view.focus();
}

function lineStart(view: View): number {
  return view.state.doc.lineAt(view.state.selection.main.from).from;
}

function setLinePrefix(view: View, prefix: string) {
  const line = view.state.doc.lineAt(view.state.selection.main.from);
  const text = line.text.replace(/^(\s*)(#+\s*|[-*+]\s+|\d+\.\s+|>\s*)?/, '$1');
  const insert = `${prefix}${text}`;
  view.dispatch({
    changes: { from: line.from, to: line.to, insert },
    scrollIntoView: true,
    userEvent: 'input.toolbar',
  });
  view.focus();
}

function removeLinePrefix(view: View) {
  const line = view.state.doc.lineAt(view.state.selection.main.from);
  const stripped = line.text.replace(
    /^(\s*)(#+\s*|[-*+]\s+|\d+\.\s+|>\s*|[-*+]\s\[[ xX]\]\s+)/,
    '$1'
  );
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: stripped },
    scrollIntoView: true,
    userEvent: 'input.toolbar',
  });
  view.focus();
}

function insertBlock(view: View, content: string, selectFrom?: number, selectTo?: number) {
  const { from, to } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const atLineStart = from === line.from;
  const prefix = atLineStart ? '' : '\n\n';
  const insert = `${prefix}${content}`;
  const start = from + prefix.length;
  view.dispatch({
    changes: { from, to, insert },
    selection:
      selectFrom !== undefined && selectTo !== undefined
        ? sel(start + selectFrom, start + selectTo)
        : sel(from + insert.length, from + insert.length),
    scrollIntoView: true,
    userEvent: 'input.toolbar',
  });
  view.focus();
}

export const commands = {
  h1: (v: View) => setLinePrefix(v, '# '),
  h2: (v: View) => setLinePrefix(v, '## '),
  h3: (v: View) => setLinePrefix(v, '### '),
  paragraph: (v: View) => removeLinePrefix(v),

  bold: (v: View) => wrapSelection(v, '**', '**', 'bold text'),
  italic: (v: View) => wrapSelection(v, '*', '*', 'italic text'),
  strikethrough: (v: View) => wrapSelection(v, '~~', '~~', 'strikethrough'),

  inlineCode: (v: View) => wrapSelection(v, '`', '`', 'code'),
  codeBlock: (v: View) => insertBlock(v, '```\n\n```', 4, 4),

  checkbox: (v: View) => setLinePrefix(v, '- [ ] '),
  bulletList: (v: View) => setLinePrefix(v, '- '),
  numberList: (v: View) => setLinePrefix(v, '1. '),
  quote: (v: View) => setLinePrefix(v, '> '),

  link: (v: View) => {
    const { from, to, text } = selectedText(v);
    const label = text || 'link text';
    const insert = `[${label}](url)`;
    const urlStart = from + label.length + 3; // [label](
    const urlEnd = urlStart + 3; // "url"
    v.dispatch({
      changes: { from, to, insert },
      selection: sel(urlStart, urlEnd),
      scrollIntoView: true,
      userEvent: 'input.toolbar',
    });
    v.focus();
  },

  hr: (v: View) => insertBlock(v, '---\n\n'),
};

// Keep lineStart referenced for future block-prefix helpers.
void lineStart;
