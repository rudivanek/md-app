import { useRef, useEffect, useState } from 'react';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { editorTheme } from './theme';
import { autoFormat } from './autoFormat';

interface Options {
  noteId: string;
  initialDoc: string;
  onChange: (doc: string) => void;
}

export function useCodeMirror({ noteId, initialDoc, onChange }: Options) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [view, setView] = useState<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const currentNoteIdRef = useRef<string | null>(null);
  onChangeRef.current = onChange;

  // Create the editor once.
  useEffect(() => {
    if (!parentRef.current) return;

    const state = EditorState.create({
      doc: initialDoc,
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        editorTheme,
        autoFormat,
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ spellcheck: 'true' }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged && currentNoteIdRef.current === noteId) {
            onChangeRef.current(u.state.doc.toString());
          }
        }),
        keymap.of([...defaultKeymap, ...historyKeymap]),
      ],
    });

    const v = new EditorView({ state, parent: parentRef.current });
    viewRef.current = v;
    currentNoteIdRef.current = noteId;
    setView(v);

    return () => {
      v.destroy();
      viewRef.current = null;
      setView(null);
      currentNoteIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the active note changes, swap the document without recreating the view.
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    if (currentNoteIdRef.current === noteId) return;
    currentNoteIdRef.current = noteId;
    v.dispatch({
      changes: { from: 0, to: v.state.doc.length, insert: initialDoc },
      selection: { anchor: 0 },
      scrollIntoView: true,
      userEvent: 'input.noteSwitch',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  return { parentRef, view };
}
