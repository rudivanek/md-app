import {
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Code2,
  CheckSquare,
  List,
  ListOrdered,
  Quote,
  Link2,
  Minus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EditorView } from '@codemirror/view';
import { commands } from '../codemirror/commands';

interface Props {
  view: EditorView | null;
}

interface Btn {
  icon: LucideIcon;
  label: string;
  run: (v: EditorView) => void;
}

const groups: Btn[][] = [
  [
    { icon: Heading1, label: 'Heading 1', run: commands.h1 },
    { icon: Heading2, label: 'Heading 2', run: commands.h2 },
    { icon: Heading3, label: 'Heading 3', run: commands.h3 },
    { icon: Pilcrow, label: 'Paragraph', run: commands.paragraph },
  ],
  [
    { icon: Bold, label: 'Bold', run: commands.bold },
    { icon: Italic, label: 'Italic', run: commands.italic },
    { icon: Strikethrough, label: 'Strikethrough', run: commands.strikethrough },
  ],
  [
    { icon: Code, label: 'Inline code', run: commands.inlineCode },
    { icon: Code2, label: 'Code block', run: commands.codeBlock },
  ],
  [
    { icon: CheckSquare, label: 'Checkbox', run: commands.checkbox },
    { icon: List, label: 'Bulleted list', run: commands.bulletList },
    { icon: ListOrdered, label: 'Numbered list', run: commands.numberList },
    { icon: Quote, label: 'Blockquote', run: commands.quote },
  ],
  [
    { icon: Link2, label: 'Link', run: commands.link },
    { icon: Minus, label: 'Horizontal rule', run: commands.hr },
  ],
];

export function FormattingToolbar({ view }: Props) {
  const handleClick = (run: (v: EditorView) => void) => {
    if (view) run(view);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-[#2a2a2a] bg-[#161616] overflow-x-auto">
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {group.map((btn) => (
            <button
              key={btn.label}
              type="button"
              title={btn.label}
              aria-label={btn.label}
              disabled={!view}
              onClick={() => handleClick(btn.run)}
              className="flex items-center justify-center w-7 h-7 rounded-md text-[#888] hover:bg-[#252525] hover:text-[#ddd] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <btn.icon size={14} />
            </button>
          ))}
          {gi < groups.length - 1 && (
            <span className="w-px h-4 bg-[#2a2a2a] mx-1" />
          )}
        </div>
      ))}
    </div>
  );
}
