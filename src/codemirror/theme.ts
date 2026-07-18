import { EditorView } from '@codemirror/view';

// Dark theme matching the My-Notes app aesthetic (bg #1a1a1a, accent #7c6af7)
export const editorTheme = EditorView.theme(
  {
    '&': {
      color: '#d4d4d4',
      backgroundColor: 'transparent',
      fontSize: '15px',
      lineHeight: '1.75',
      height: '100%',
    },
    '.cm-content': {
      caretColor: '#7c6af7',
      fontFamily:
        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      padding: '0',
      maxWidth: '100%',
    },
    '.cm-line': {
      padding: '0',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#7c6af7',
      borderLeftWidth: '2px',
    },
    '.cm-selectionBackground, .cm-content ::selection': {
      background: 'rgba(124, 106, 247, 0.25)',
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      background: 'rgba(124, 106, 247, 0.25)',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      color: '#444',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    '.cm-placeholder': {
      color: '#333',
    },
    // Markdown syntax highlighting
    '.tok-heading1': { color: '#e0e0e0', fontWeight: '700', fontSize: '1.5em' },
    '.tok-heading2': { color: '#e0e0e0', fontWeight: '700', fontSize: '1.3em' },
    '.tok-heading3': { color: '#d4d4d4', fontWeight: '600', fontSize: '1.15em' },
    '.tok-heading4, .tok-heading5, .tok-heading6': {
      color: '#c4c4c4',
      fontWeight: '600',
    },
    '.tok-heading': { color: '#7c6af7' },
    '.tok-emphasis': { color: '#e0a060', fontStyle: 'italic' },
    '.tok-strong': { color: '#e0a060', fontWeight: '700' },
    '.tok-strikethrough': { color: '#888', textDecoration: 'line-through' },
    '.tok-link': { color: '#6db4ff', textDecoration: 'underline' },
    '.tok-url': { color: '#6db4ff' },
    '.tok-monospace': {
      color: '#4a9e6b',
      fontFamily: 'ui-monospace, monospace',
      backgroundColor: 'rgba(74, 158, 107, 0.1)',
      borderRadius: '3px',
      padding: '0 3px',
    },
    '.tok-quote': { color: '#888', fontStyle: 'italic' },
    '.tok-list': { color: '#7c6af7' },
    '.tok-meta': { color: '#666' },
    '.tok-string': { color: '#4a9e6b' },
    '.tok-number': { color: '#e0a060' },
    '.tok-keyword': { color: '#7c6af7' },
    '.tok-atom': { color: '#7c6af7' },
    '.tok-comment': { color: '#555', fontStyle: 'italic' },
    '.tok-tag': { color: '#7c6af7' },
    '.tok-attributeName': { color: '#e0a060' },
    '.tok-attributeValue': { color: '#4a9e6b' },
  },
  { dark: true }
);
