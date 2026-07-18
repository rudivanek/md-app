import { EditorView } from '@codemirror/view';

// Patterns that, when typed at line start, should be preserved/continued.
// We use a single input handler to:
//  - continue list items on Enter (bulleted, numbered, checkbox)
//  - strip empty list markers when Enter is pressed on an empty marker line

function linePrefix(line: string): string {
  // Matches leading whitespace + marker for: bullet (-, *, +), numbered (1.), checkbox (- [ ] / - [x])
  const m = line.match(/^(\s*)([-*+]\s|[-*+]\s\[[ xX]\]\s|\d+\.\s)(.*)$/);
  return m ? m[1] + m[2] : '';
}

function markerOnly(line: string): boolean {
  // True if the line is just whitespace + a marker (no content)
  return /^\s*([-*+]\s|[-*+]\s\[[ xX]\]\s|\d+\.\s)$/.test(line);
}

export const autoFormat = EditorView.inputHandler.of((view, from, to, text) => {
  // Only interested in plain text insertions (single char or short strings)
  if (text !== '\n' && text !== '\r\n') return false;

  const state = view.state;
  if (from !== to) return false;

  const line = state.doc.lineAt(from);
  const lineText = line.text.slice(0, from - line.from);

  // Enter on an empty list marker line -> remove the marker (exit list)
  if (markerOnly(lineText)) {
    view.dispatch({
      changes: { from: line.from, to: from, insert: '' },
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
    return true;
  }

  const prefix = linePrefix(lineText);
  if (!prefix) return false;

  // Continue numbered lists by incrementing the number
  const numberedMatch = prefix.match(/^(\s*)(\d+)\.\s$/);
  if (numberedMatch) {
    const indent = numberedMatch[1];
    const nextNum = parseInt(numberedMatch[2], 10) + 1;
    const insert = `\n${indent}${nextNum}. `;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
      scrollIntoView: true,
    });
    return true;
  }

  // Continue checkbox lists — but uncheck the new box
  const checkboxMatch = prefix.match(/^(\s*)([-*+])\s\[[ xX]\]\s$/);
  if (checkboxMatch) {
    const insert = `\n${checkboxMatch[1]}${checkboxMatch[2]} [ ] `;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
      scrollIntoView: true,
    });
    return true;
  }

  // Continue plain bullet lists
  const bulletMatch = prefix.match(/^(\s*)([-*+])\s$/);
  if (bulletMatch) {
    const insert = `\n${bulletMatch[1]}${bulletMatch[2]} `;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
      scrollIntoView: true,
    });
    return true;
  }

  return false;
});
