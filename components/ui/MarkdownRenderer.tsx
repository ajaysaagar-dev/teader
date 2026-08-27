'use client';

import React from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export function parseInlineMarkdown(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // 1. Inline code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      tokens.push(
        <code
          key={`code_${keyIdx++}`}
          className="px-1.5 py-0.5 mx-0.5 bg-[#202226] border border-[#2F333A] text-[#DCB001] font-mono text-[11px] rounded-md font-medium"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // 2. Bold + Italic: ***text*** or ___text___
    const boldItalicMatch = remaining.match(/^(\*\*\*|___)(.+?)\1/);
    if (boldItalicMatch) {
      tokens.push(
        <strong key={`bi_${keyIdx++}`} className="font-bold italic text-white">
          {boldItalicMatch[2]}
        </strong>
      );
      remaining = remaining.slice(boldItalicMatch[0].length);
      continue;
    }

    // 3. Bold: **text** or __text__
    const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/);
    if (boldMatch) {
      tokens.push(
        <strong key={`b_${keyIdx++}`} className="font-bold text-white">
          {boldMatch[2]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 4. Strikethrough: ~~text~~
    const strikeMatch = remaining.match(/^~~(.+?)~~/);
    if (strikeMatch) {
      tokens.push(
        <del key={`s_${keyIdx++}`} className="line-through text-[#787C83]">
          {strikeMatch[1]}
        </del>
      );
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // 5. Italic: *text* or _text_
    const italicMatch = remaining.match(/^(\*|_)([^*_]+)\1/);
    if (italicMatch) {
      tokens.push(
        <em key={`i_${keyIdx++}`} className="italic text-[#E6EDF3]">
          {italicMatch[2]}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // 6. Link: [title](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      tokens.push(
        <a
          key={`a_${keyIdx++}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#58A6FF] hover:underline inline-flex items-center gap-0.5 font-medium"
        >
          <span>{linkMatch[1]}</span>
          <ExternalLink size={10} className="opacity-70" />
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Regular plain text slice until next special token
    const nextSpecial = remaining.search(/[`*_~\[]/);
    if (nextSpecial === -1) {
      tokens.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      tokens.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      tokens.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return tokens;
}

export function renderGithubMarkdown(markdown: string) {
  if (!markdown || !markdown.trim()) return null;
  const lines = markdown.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code Block: ```lang
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim() || 'text';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      const codeString = codeLines.join('\n');

      elements.push(
        <div key={`codeblock_${i}`} className="my-3 rounded-xl bg-[#0E1012] border border-[#2A2C30] overflow-hidden shadow-md">
          <div className="px-3.5 py-1.5 bg-[#17181A] border-b border-[#2A2C30] flex items-center justify-between text-[11px] font-mono text-[#787C83]">
            <span className="font-semibold uppercase tracking-wider text-[#DCB001]">{lang}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(codeString);
                toast.success('Code copied to clipboard');
              }}
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              <Copy size={11} />
              <span>Copy</span>
            </button>
          </div>
          <pre className="p-3.5 text-xs font-mono text-[#E6EDF3] overflow-x-auto leading-relaxed selection:bg-[#DCB001]/30">
            <code>{codeString}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 2. Table: | Col 1 | Col 2 |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerCols = tableLines[0].split('|').slice(1, -1).map((c) => c.trim());
        const bodyLines = tableLines.slice(2);

        elements.push(
          <div key={`table_${i}`} className="my-3 overflow-x-auto rounded-xl border border-[#2A2C30] shadow-sm">
            <table className="w-full text-xs text-left border-collapse bg-[#131415]">
              <thead>
                <tr className="bg-[#1B1C1F] border-b border-[#2A2C30]">
                  {headerCols.map((h, colIdx) => (
                    <th key={colIdx} className="px-3.5 py-2 font-bold text-white border-r last:border-r-0 border-[#2A2C30]">
                      {parseInlineMarkdown(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2C30]">
                {bodyLines.map((bRow, rIdx) => {
                  const cells = bRow.split('|').slice(1, -1).map((c) => c.trim());
                  return (
                    <tr key={rIdx} className="hover:bg-[#1A1B1E] transition-colors">
                      {cells.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3.5 py-1.5 text-[#CFD4DD] border-r last:border-r-0 border-[#2A2C30]">
                          {parseInlineMarkdown(cell)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 3. Horizontal Rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      elements.push(<hr key={`hr_${i}`} className="my-4 border-t border-[#2A2C30]" />);
      i++;
      continue;
    }

    // 4. Headings
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1_${i}`} className="text-xl sm:text-2xl font-extrabold text-white pb-2 mb-3 mt-4 border-b border-[#2A2C30] tracking-tight">
          {parseInlineMarkdown(trimmed.slice(2))}
        </h1>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2_${i}`} className="text-lg sm:text-xl font-bold text-white pb-1.5 mb-2.5 mt-3.5 border-b border-[#2A2C30]/60 tracking-tight">
          {parseInlineMarkdown(trimmed.slice(3))}
        </h2>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3_${i}`} className="text-sm sm:text-base font-bold text-[#DCB001] mb-1.5 mt-3 tracking-tight">
          {parseInlineMarkdown(trimmed.slice(4))}
        </h3>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      elements.push(
        <h4 key={`h4_${i}`} className="text-xs sm:text-sm font-semibold text-[#CFD4DD] mb-1 mt-2.5">
          {parseInlineMarkdown(trimmed.slice(5))}
        </h4>
      );
      i++;
      continue;
    }

    // 5. Blockquote (> )
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      elements.push(
        <blockquote
          key={`quote_${i}`}
          className="my-2.5 pl-3.5 py-1.5 border-l-4 border-[#DCB001] bg-[#141517] rounded-r-lg text-xs text-[#CFD4DD] italic leading-relaxed"
        >
          {parseInlineMarkdown(quoteText)}
        </blockquote>
      );
      i++;
      continue;
    }

    // 6. Task List (- [ ] or - [x])
    if (/^[-*]\s+\[([ xX])\]/.test(trimmed)) {
      const isChecked = /^[-*]\s+\[([xX])\]/.test(trimmed);
      const taskText = trimmed.replace(/^[-*]\s+\[([ xX])\]\s*/, '');
      elements.push(
        <div key={`task_${i}`} className="flex items-start gap-2 my-1 pl-1 text-xs">
          <input
            type="checkbox"
            checked={isChecked}
            readOnly
            className="mt-0.5 w-3.5 h-3.5 rounded accent-[#DCB001] bg-[#1B1C1F] border-[#2A2C30] cursor-default"
          />
          <span className={isChecked ? 'line-through text-[#787C83]' : 'text-[#CFD4DD]'}>
            {parseInlineMarkdown(taskText)}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // 7. Unordered List (- or *)
    if (/^[-*]\s+/.test(trimmed)) {
      const listText = trimmed.replace(/^[-*]\s+/, '');
      elements.push(
        <div key={`ul_${i}`} className="flex items-start gap-2 my-0.5 pl-2 text-xs text-[#CFD4DD]">
          <span className="text-[#DCB001] font-bold text-xs leading-none mt-1">•</span>
          <span className="flex-1 leading-relaxed">{parseInlineMarkdown(listText)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 8. Ordered List (1. 2. etc)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      elements.push(
        <div key={`ol_${i}`} className="flex items-start gap-2 my-0.5 pl-2 text-xs text-[#CFD4DD]">
          <span className="font-mono text-[11px] font-bold text-[#DCB001] shrink-0 mt-0.5">{numMatch[1]}.</span>
          <span className="flex-1 leading-relaxed">{parseInlineMarkdown(numMatch[2])}</span>
        </div>
      );
      i++;
      continue;
    }

    // 9. Blank line
    if (trimmed === '') {
      elements.push(<div key={`blank_${i}`} className="h-1.5" />);
      i++;
      continue;
    }

    // 10. Paragraph
    elements.push(
      <p key={`p_${i}`} className="my-1 text-xs text-[#CFD4DD] leading-relaxed">
        {parseInlineMarkdown(line)}
      </p>
    );
    i++;
  }

  return elements;
}

export function MarkdownRenderer({ content, className = '' }: { content?: string; className?: string }) {
  if (!content || !content.trim()) {
    return <p className="text-xs text-[#787C83] italic">No description provided.</p>;
  }

  return (
    <div className={`space-y-1 font-sans text-xs leading-relaxed ${className}`}>
      {renderGithubMarkdown(content)}
    </div>
  );
}

export default MarkdownRenderer;
