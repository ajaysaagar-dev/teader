'use client';

import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  ExternalLink, 
  Info, 
  AlertTriangle, 
  Lightbulb, 
  AlertCircle, 
  ShieldAlert, 
  ChevronRight,
  ChevronDown 
} from 'lucide-react';
import { toast } from 'sonner';

export interface ActiveHighlightInfo {
  lineIndex: number;
  word?: string;
  timestamp: number;
}

export interface ActiveCursorInfo {
  lineIndex: number;
  col?: number;
  offset?: number;
  userId?: string;
  userName?: string;
  color?: string;
  isLocal?: boolean;
}

/**
 * Realtime Live Cursor Beacon in the markdown preview (supports multi-user collaborative presence)
 */
export function LiveCursorBeacon({
  lineIndex,
  col = 1,
  userName,
  color = '#DCB001',
  isLocal = false,
}: {
  lineIndex: number;
  col?: number;
  userName?: string;
  color?: string;
  isLocal?: boolean;
}) {
  const displayName = userName || (isLocal ? 'You' : `Ln ${lineIndex + 1}:${col}`);

  return (
    <span
      className="inline-block relative align-middle -translate-y-0.5 mx-0.5 z-30 pointer-events-none group/cursor select-none"
      title={userName ? `${userName}'s cursor (Line ${lineIndex + 1}, Col ${col})` : `Live Cursor at Line ${lineIndex + 1}, Column ${col}`}
    >
      {/* Glowing Pulsing Caret Bar */}
      <span
        className="inline-block w-[3px] h-[18px] animate-pulse rounded-full align-middle shadow-md transition-transform"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 12px ${color}`,
        }}
      />
      {/* Floating Username Nametag Badge near the text cursor */}
      <span
        className="absolute -top-6 -left-2 px-1.5 py-0.5 text-[10px] font-sans font-bold rounded-md shadow-xl whitespace-nowrap opacity-100 transition-all border flex items-center gap-1.5 z-40 pointer-events-none"
        style={{
          backgroundColor: '#0F1014',
          borderColor: color,
          color: '#FFFFFF',
          boxShadow: `0 4px 12px rgba(0,0,0,0.6), 0 0 8px ${color}33`,
        }}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0 shadow-sm"
          style={{ backgroundColor: color }}
        />
        <span className="leading-none text-white tracking-wide">{displayName}</span>
        {/* Tiny triangular pointer attached to cursor */}
        <span
          className="absolute -bottom-1 left-2 w-2 h-2 rotate-45 border-r border-b"
          style={{
            backgroundColor: '#0F1014',
            borderColor: color,
          }}
        />
      </span>
    </span>
  );
}

/**
 * Animated letter-by-letter fading highlight for newly typed words in realtime
 */
export function TypingLetterFade({
  text,
  animKey = 'default',
}: {
  text: string;
  animKey?: string | number;
}) {
  if (!text) return null;

  return (
    <span key={`fade_grp_${animKey}`} className="inline">
      {text.split('').map((char, index) => (
        <span
          key={`char_${animKey}_${index}`}
          className="animate-letter-fade"
          style={{
            animationDelay: `${index * 45}ms`,
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
}

function renderTextWithHighlight(
  textSlice: string,
  keyIdx: number,
  highlight?: ActiveHighlightInfo | null
): React.ReactNode {
  if (!highlight || !highlight.word || !highlight.word.trim()) {
    return textSlice;
  }

  const targetWord = highlight.word.trim();
  const wordIdx = textSlice.indexOf(targetWord);

  if (wordIdx !== -1) {
    const before = textSlice.slice(0, wordIdx);
    const match = textSlice.slice(wordIdx, wordIdx + targetWord.length);
    const after = textSlice.slice(wordIdx + targetWord.length);

    return (
      <span key={`hl_wrap_${keyIdx}`}>
        {before}
        <TypingLetterFade text={match} animKey={highlight.timestamp} />
        {after}
      </span>
    );
  }

  return textSlice;
}

/**
 * Parses inline GitHub Markdown and embedded HTML tags (<b>, <i>, <code>, <kbd>, <a>, <img>, <br>, <span>, <del>, <sub>, <sup>, etc.)
 */
export function parseInlineMarkdown(
  text: string,
  highlight?: ActiveHighlightInfo | null,
  cursor?: ActiveCursorInfo | ActiveCursorInfo[] | null
): React.ReactNode[] {
  const cursorList: ActiveCursorInfo[] = Array.isArray(cursor) ? cursor : cursor ? [cursor] : [];
  if (!text) {
    return cursorList.length > 0
      ? cursorList.map((c, idx) => (
          <LiveCursorBeacon
            key={`cursor_empty_${idx}`}
            lineIndex={c.lineIndex}
            col={c.col}
            userName={c.userName}
            color={c.color}
            isLocal={c.isLocal}
          />
        ))
      : [];
  }
  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // 0. Skip / Strip HTML comments: <!-- comment -->
    const commentMatch = remaining.match(/^<!--[\s\S]*?-->/);
    if (commentMatch) {
      remaining = remaining.slice(commentMatch[0].length);
      continue;
    }

    // 1. Inline HTML: <br> or <br/> or <br />
    const brMatch = remaining.match(/^<br\s*\/?>/i);
    if (brMatch) {
      tokens.push(<br key={`br_${keyIdx++}`} />);
      remaining = remaining.slice(brMatch[0].length);
      continue;
    }

    // 2. Inline HTML: <kbd>...</kbd>
    const kbdMatch = remaining.match(/^<kbd(?:\s+[^>]*)?>([\s\S]*?)<\/kbd>/i);
    if (kbdMatch) {
      tokens.push(
        <kbd
          key={`kbd_${keyIdx++}`}
          className="px-1.5 py-0.5 mx-0.5 bg-[#1B1C1F] border border-[#2E3138] text-[#CFD4DD] font-mono text-[10px] rounded shadow-sm inline-block font-semibold"
        >
          {parseInlineMarkdown(kbdMatch[1])}
        </kbd>
      );
      remaining = remaining.slice(kbdMatch[0].length);
      continue;
    }

    // 3. Inline HTML: <code ...>...</code>
    const htmlCodeMatch = remaining.match(/^<code(?:\s+[^>]*)?>([\s\S]*?)<\/code>/i);
    if (htmlCodeMatch) {
      tokens.push(
        <code
          key={`hcode_${keyIdx++}`}
          className="px-1.5 py-0.5 mx-0.5 bg-[#202226] border border-[#2F333A] text-[#DCB001] font-mono text-[11px] rounded-md font-medium"
        >
          {htmlCodeMatch[1]}
        </code>
      );
      remaining = remaining.slice(htmlCodeMatch[0].length);
      continue;
    }

    // 4. Markdown Inline code: `code`
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

    // 5. HTML: <b>...</b> or <strong>...</strong>
    const strongHtmlMatch = remaining.match(/^<(b|strong)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/i);
    if (strongHtmlMatch) {
      tokens.push(
        <strong key={`b_html_${keyIdx++}`} className="font-bold text-white">
          {parseInlineMarkdown(strongHtmlMatch[2])}
        </strong>
      );
      remaining = remaining.slice(strongHtmlMatch[0].length);
      continue;
    }

    // 6. Markdown Bold + Italic: ***text*** or ___text___
    const boldItalicMatch = remaining.match(/^(\*\*\*|___)(.+?)\1/);
    if (boldItalicMatch) {
      tokens.push(
        <strong key={`bi_${keyIdx++}`} className="font-bold italic text-white">
          {parseInlineMarkdown(boldItalicMatch[2])}
        </strong>
      );
      remaining = remaining.slice(boldItalicMatch[0].length);
      continue;
    }

    // 7. Markdown Bold: **text** or __text__
    const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/);
    if (boldMatch) {
      tokens.push(
        <strong key={`b_${keyIdx++}`} className="font-bold text-white">
          {parseInlineMarkdown(boldMatch[2])}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 8. HTML: <i>...</i> or <em>...</em>
    const emHtmlMatch = remaining.match(/^<(i|em)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/i);
    if (emHtmlMatch) {
      tokens.push(
        <em key={`em_html_${keyIdx++}`} className="italic text-[#E6EDF3]">
          {parseInlineMarkdown(emHtmlMatch[2])}
        </em>
      );
      remaining = remaining.slice(emHtmlMatch[0].length);
      continue;
    }

    // 9. Markdown Italic: *text* or _text_
    const italicMatch = remaining.match(/^(\*|_)([^*_]+)\1/);
    if (italicMatch) {
      tokens.push(
        <em key={`i_${keyIdx++}`} className="italic text-[#E6EDF3]">
          {parseInlineMarkdown(italicMatch[2])}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // 10. HTML: <del>...<del> or <s>...</s> or <strike>...</strike>
    const delHtmlMatch = remaining.match(/^<(del|s|strike)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/i);
    if (delHtmlMatch) {
      tokens.push(
        <del key={`del_html_${keyIdx++}`} className="line-through text-[#787C83]">
          {parseInlineMarkdown(delHtmlMatch[2])}
        </del>
      );
      remaining = remaining.slice(delHtmlMatch[0].length);
      continue;
    }

    // 11. Markdown Strikethrough: ~~text~~
    const strikeMatch = remaining.match(/^~~(.+?)~~/);
    if (strikeMatch) {
      tokens.push(
        <del key={`s_${keyIdx++}`} className="line-through text-[#787C83]">
          {parseInlineMarkdown(strikeMatch[1])}
        </del>
      );
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // 12. HTML: <u>...</u> or <ins>...</ins>
    const uHtmlMatch = remaining.match(/^<(u|ins)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/i);
    if (uHtmlMatch) {
      tokens.push(
        <span key={`u_html_${keyIdx++}`} className="underline underline-offset-2">
          {parseInlineMarkdown(uHtmlMatch[2])}
        </span>
      );
      remaining = remaining.slice(uHtmlMatch[0].length);
      continue;
    }

    // 13. HTML: <sup>...</sup> and <sub>...</sub>
    const supMatch = remaining.match(/^<sup>([\s\S]*?)<\/sup>/i);
    if (supMatch) {
      tokens.push(
        <sup key={`sup_${keyIdx++}`} className="text-[10px] text-[#DCB001]">
          {parseInlineMarkdown(supMatch[1])}
        </sup>
      );
      remaining = remaining.slice(supMatch[0].length);
      continue;
    }
    const subMatch = remaining.match(/^<sub>([\s\S]*?)<\/sub>/i);
    if (subMatch) {
      tokens.push(
        <sub key={`sub_${keyIdx++}`} className="text-[10px] text-[#8E939D]">
          {parseInlineMarkdown(subMatch[1])}
        </sub>
      );
      remaining = remaining.slice(subMatch[0].length);
      continue;
    }

    // 14. HTML: <a href="..." id="..." name="...">...</a> or anchor target <a id="..."></a>
    const aHtmlMatch = remaining.match(/^<a\s+([^>]*?)>([\s\S]*?)<\/a>/i);
    if (aHtmlMatch) {
      const attrs = aHtmlMatch[1];
      const inner = aHtmlMatch[2];
      const hrefMatch = attrs.match(/href=["']([^"']*)["']/i);
      const idMatch = attrs.match(/(?:id|name)=["']([^"']*)["']/i);

      if (hrefMatch) {
        tokens.push(
          <a
            key={`a_html_${keyIdx++}`}
            href={hrefMatch[1]}
            id={idMatch ? idMatch[1] : undefined}
            target={hrefMatch[1].startsWith('#') ? undefined : '_blank'}
            rel={hrefMatch[1].startsWith('#') ? undefined : 'noopener noreferrer'}
            className="text-[#58A6FF] hover:underline inline-flex items-center gap-0.5 font-medium"
          >
            <span>{parseInlineMarkdown(inner)}</span>
            {!hrefMatch[1].startsWith('#') && <ExternalLink size={10} className="opacity-70 inline" />}
          </a>
        );
      } else if (idMatch) {
        tokens.push(
          <span key={`a_anchor_${keyIdx++}`} id={idMatch[1]} className="scroll-mt-24">
            {parseInlineMarkdown(inner)}
          </span>
        );
      } else {
        tokens.push(<span key={`a_span_${keyIdx++}`}>{parseInlineMarkdown(inner)}</span>);
      }
      remaining = remaining.slice(aHtmlMatch[0].length);
      continue;
    }

    // 15. Markdown Link: [title](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      const isAnchor = linkMatch[2].startsWith('#');
      tokens.push(
        <a
          key={`a_${keyIdx++}`}
          href={linkMatch[2]}
          target={isAnchor ? undefined : '_blank'}
          rel={isAnchor ? undefined : 'noopener noreferrer'}
          className="text-[#58A6FF] hover:underline inline-flex items-center gap-0.5 font-medium"
        >
          <span>{parseInlineMarkdown(linkMatch[1])}</span>
          {!isAnchor && <ExternalLink size={10} className="opacity-70 inline" />}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // 16. HTML: <img src="..." alt="..." width="..." height="..." />
    const imgHtmlMatch = remaining.match(/^<img\s+([^>]*?)\/?>/i);
    if (imgHtmlMatch) {
      const attrs = imgHtmlMatch[1];
      const srcMatch = attrs.match(/src=["']([^"']*)["']/i);
      const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
      const widthMatch = attrs.match(/width=["']([^"']*)["']/i);
      const heightMatch = attrs.match(/height=["']([^"']*)["']/i);

      if (srcMatch) {
        tokens.push(
          <img
            key={`img_html_${keyIdx++}`}
            src={srcMatch[1]}
            alt={altMatch ? altMatch[1] : 'Image'}
            style={{
              maxWidth: '100%',
              width: widthMatch ? widthMatch[1] : undefined,
              height: heightMatch ? heightMatch[1] : undefined,
            }}
            className="my-2 rounded-lg border border-[#2A2C30] inline-block shadow-sm"
          />
        );
      }
      remaining = remaining.slice(imgHtmlMatch[0].length);
      continue;
    }

    // 17. Markdown Image: ![alt](url)
    const mdImgMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (mdImgMatch) {
      tokens.push(
        <img
          key={`img_${keyIdx++}`}
          src={mdImgMatch[2]}
          alt={mdImgMatch[1] || 'Image'}
          className="my-2 max-w-full rounded-lg border border-[#2A2C30] shadow-sm inline-block"
        />
      );
      remaining = remaining.slice(mdImgMatch[0].length);
      continue;
    }

    // 18. HTML: <span ...>...</span> or <div ...>...</div>
    const spanHtmlMatch = remaining.match(/^<(span|div|p)(?:\s+([^>]*))?>([\s\S]*?)<\/\1>/i);
    if (spanHtmlMatch) {
      const inner = spanHtmlMatch[3];
      tokens.push(
        <span key={`span_html_${keyIdx++}`} className="inline">
          {parseInlineMarkdown(inner)}
        </span>
      );
      remaining = remaining.slice(spanHtmlMatch[0].length);
      continue;
    }

    // Regular plain text slice until next special marker
    const nextSpecial = remaining.search(/[`*_~\[<]/);
    if (nextSpecial === -1) {
      tokens.push(renderTextWithHighlight(remaining, keyIdx++, highlight));
      break;
    } else if (nextSpecial === 0) {
      // Unmatched marker character
      tokens.push(renderTextWithHighlight(remaining[0], keyIdx++, highlight));
      remaining = remaining.slice(1);
    } else {
      tokens.push(renderTextWithHighlight(remaining.slice(0, nextSpecial), keyIdx++, highlight));
      remaining = remaining.slice(nextSpecial);
    }
  }

  // Insert live cursor beacon if this line has active cursors
  if (cursorList.length > 0) {
    cursorList.forEach((c, cIdx) => {
      tokens.push(
        <LiveCursorBeacon
          key={`cursor_beacon_${c.userId || 'local'}_${cIdx}`}
          lineIndex={c.lineIndex}
          col={c.col}
          userName={c.userName}
          color={c.color}
          isLocal={c.isLocal}
        />
      );
    });
  }

  return tokens;
}

/**
 * Collapsible HTML Details/Summary Component
 */
export function CollapsibleDetails({
  summaryContent,
  children,
  defaultOpen = false,
}: {
  summaryContent: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="my-3 rounded-xl border border-[#2A2C30] bg-[#111215] overflow-hidden shadow-sm transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-[#16181D] hover:bg-[#1C1E23] flex items-center justify-between text-left transition-colors border-b border-[#2A2C30]/50"
      >
        <div className="flex items-center gap-2.5 font-semibold text-white text-xs sm:text-sm">
          {isOpen ? (
            <ChevronDown size={15} className="text-[#DCB001] shrink-0" />
          ) : (
            <ChevronRight size={15} className="text-[#8E939D] shrink-0" />
          )}
          <span>{summaryContent}</span>
        </div>
        <span className="text-[10px] font-mono uppercase text-[#787C83] px-2 py-0.5 rounded bg-[#0E0F12] border border-[#2A2C30]">
          {isOpen ? 'Collapse' : 'Expand'}
        </span>
      </button>

      {isOpen && <div className="p-4 bg-[#0F1012] overflow-x-auto space-y-2">{children}</div>}
    </div>
  );
}

/**
 * Full GitHub-Flavored Markdown + HTML Parser with realtime letter-by-letter fade highlight & live multi-user cursors
 */
export function renderGithubMarkdown(
  markdown: string,
  activeHighlight?: ActiveHighlightInfo | null,
  activeCursors?: ActiveCursorInfo[] | ActiveCursorInfo | null
): React.ReactNode[] | null {
  const cursorList: ActiveCursorInfo[] = Array.isArray(activeCursors)
    ? activeCursors
    : activeCursors
    ? [activeCursors]
    : [];

  if (!markdown || !markdown.trim()) {
    if (cursorList.length > 0) {
      return cursorList.map((c, idx) => (
        <LiveCursorBeacon
          key={`cursor_empty_${idx}`}
          lineIndex={c.lineIndex}
          col={c.col}
          userName={c.userName}
          color={c.color}
          isLocal={c.isLocal}
        />
      ));
    }
    return null;
  }
  const lines = markdown.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineHighlight = activeHighlight && activeHighlight.lineIndex === i ? activeHighlight : null;
    const lineCursors = cursorList.filter((c) => c.lineIndex === i);

    // 0. Skip HTML comment line
    if (trimmed.startsWith('<!--') && trimmed.endsWith('-->')) {
      i++;
      continue;
    }

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
        <div key={`codeblock_${i}`} className="my-4 rounded-xl bg-[#0E1012] border border-[#2A2C30] overflow-hidden shadow-md">
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
          <pre className="p-4 text-xs font-mono text-[#E6EDF3] overflow-x-auto leading-relaxed selection:bg-[#DCB001]/30">
            <code>{codeString}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 2. Alert Callouts: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]
    const alertMatch = trimmed.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
    if (alertMatch) {
      const alertType = alertMatch[1].toUpperCase();
      const alertLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        alertLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }

      let borderColor = 'border-[#3B82F6]';
      let bgColor = 'bg-[#1E293B]/40';
      let textColor = 'text-[#60A5FA]';
      let title = 'Note';
      let IconComponent = Info;

      if (alertType === 'TIP') {
        borderColor = 'border-[#10B981]';
        bgColor = 'bg-[#064E3B]/30';
        textColor = 'text-[#34D399]';
        title = 'Tip';
        IconComponent = Check;
      } else if (alertType === 'IMPORTANT') {
        borderColor = 'border-[#A855F7]';
        bgColor = 'bg-[#581C87]/30';
        textColor = 'text-[#C084FC]';
        title = 'Important';
        IconComponent = AlertCircle;
      } else if (alertType === 'WARNING') {
        borderColor = 'border-[#F59E0B]';
        bgColor = 'bg-[#78350F]/30';
        textColor = 'text-[#FBBF24]';
        title = 'Warning';
        IconComponent = AlertTriangle;
      } else if (alertType === 'CAUTION') {
        borderColor = 'border-[#EF4444]';
        bgColor = 'bg-[#7F1D1D]/30';
        textColor = 'text-[#F87171]';
        title = 'Caution';
        IconComponent = AlertCircle;
      }

      elements.push(
        <div key={`alert_${i}`} className={`my-4 p-4 rounded-xl border-l-4 ${borderColor} ${bgColor} backdrop-blur-sm space-y-1.5`}>
          <div className={`flex items-center gap-2 font-bold text-xs ${textColor}`}>
            <IconComponent size={15} />
            <span>{title}</span>
          </div>
          <div className="text-xs text-[#CFD4DD] leading-relaxed">
            {alertLines.map((al, alIdx) => (
              <p key={alIdx} className="my-0.5">{parseInlineMarkdown(al, lineHighlight, lineCursors)}</p>
            ))}
          </div>
        </div>
      );
      continue;
    }

    // 3. HTML Details / Summary (<details> ... <summary> ... </summary> ... </details>)
    if (/^<details(?:\s+open)?(?:\s+[^>]*)?>/i.test(trimmed)) {
      const isDefaultOpen = /<details\s+open/i.test(trimmed);
      let summaryText = 'Details';
      const detailBodyLines: string[] = [];
      i++;

      // Check if next line or subsequent is summary
      while (i < lines.length && !/<\/details>/i.test(lines[i])) {
        const curLineTrim = lines[i].trim();
        const summaryMatch = curLineTrim.match(/^<summary(?:\s+[^>]*)?>([\s\S]*?)<\/summary>/i);
        if (summaryMatch) {
          summaryText = summaryMatch[1];
        } else {
          detailBodyLines.push(lines[i]);
        }
        i++;
      }
      i++; // Skip </details>

      elements.push(
        <CollapsibleDetails
          key={`details_${i}`}
          summaryContent={parseInlineMarkdown(summaryText, lineHighlight, lineCursors)}
          defaultOpen={isDefaultOpen}
        >
          {renderGithubMarkdown(detailBodyLines.join('\n'), activeHighlight, lineCursors)}
        </CollapsibleDetails>
      );
      continue;
    }

    // 4. HTML Table: <table> ... </table>
    if (/^<table(?:\s+[^>]*)?>/i.test(trimmed)) {
      const tableLines: string[] = [line];
      i++;
      while (i < lines.length && !/<\/table>/i.test(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        tableLines.push(lines[i]); // include </table>
        i++;
      }

      elements.push(
        <div key={`html_table_${i}`} className="my-4 overflow-x-auto rounded-xl border border-[#2A2C30] bg-[#111215]">
          <div className="p-3 text-xs" dangerouslySetInnerHTML={{ __html: tableLines.join('\n') }} />
        </div>
      );
      continue;
    }

    // 5. Markdown Table (| header | header |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerCols = tableLines[0].split('|').slice(1, -1).map((s) => s.trim());
        const bodyRows = tableLines.slice(2).map((r) => r.split('|').slice(1, -1).map((s) => s.trim()));

        elements.push(
          <div key={`md_table_${i}`} className="my-4 overflow-x-auto rounded-xl border border-[#2A2C30] bg-[#111215] shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#2A2C30] bg-[#17181C]">
                  {headerCols.map((h, colIdx) => (
                    <th key={colIdx} className="px-4 py-2.5 font-semibold text-white">
                      {parseInlineMarkdown(h, lineHighlight, lineCursors)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222428]">
                {bodyRows.map((row, rowIdx) => {
                  return (
                    <tr key={rowIdx} className="hover:bg-[#16181D]/60 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-4 py-2.5 text-[#CFD4DD]">
                          {parseInlineMarkdown(cell, lineHighlight, lineCursors)}
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

    // 6. Horizontal Rule: ---, ***, ___, <hr>, <hr/>
    if (trimmed === '---' || trimmed === '***' || trimmed === '___' || /^<hr\s*\/?>/i.test(trimmed)) {
      elements.push(<hr key={`hr_${i}`} className="my-6 border-t border-[#2A2C30]" />);
      i++;
      continue;
    }

    // 7. HTML Headings: <h1>, <h2>, <h3>, <h4>
    const hHtmlMatch = trimmed.match(/^<(h[1-6])(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/i);
    if (hHtmlMatch) {
      const tag = hHtmlMatch[1].toLowerCase();
      const content = hHtmlMatch[2];
      if (tag === 'h1') {
        elements.push(
          <h1 key={`h1_html_${i}`} className="text-2xl sm:text-3xl font-extrabold text-white pb-2.5 mb-4 mt-7 border-b border-[#2A2C30] tracking-tight">
            {parseInlineMarkdown(content, lineHighlight, lineCursors)}
          </h1>
        );
      } else if (tag === 'h2') {
        elements.push(
          <h2 key={`h2_html_${i}`} className="text-xl sm:text-2xl font-bold text-white pb-2 mb-3 mt-6 border-b border-[#2A2C30]/60 tracking-tight">
            {parseInlineMarkdown(content, lineHighlight, lineCursors)}
          </h2>
        );
      } else if (tag === 'h3') {
        elements.push(
          <h3 key={`h3_html_${i}`} className="text-base sm:text-lg font-bold text-[#DCB001] mb-2 mt-5 tracking-tight">
            {parseInlineMarkdown(content, lineHighlight, lineCursors)}
          </h3>
        );
      } else {
        elements.push(
          <h4 key={`h4_html_${i}`} className="text-sm sm:text-base font-semibold text-[#CFD4DD] mb-1.5 mt-4">
            {parseInlineMarkdown(content, lineHighlight, lineCursors)}
          </h4>
        );
      }
      i++;
      continue;
    }

    // 8. Markdown Headings
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1_${i}`} className="text-2xl sm:text-3xl font-extrabold text-white pb-2.5 mb-4 mt-7 border-b border-[#2A2C30] tracking-tight">
          {parseInlineMarkdown(trimmed.slice(2), lineHighlight, lineCursors)}
        </h1>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2_${i}`} className="text-xl sm:text-2xl font-bold text-white pb-2 mb-3 mt-6 border-b border-[#2A2C30]/60 tracking-tight">
          {parseInlineMarkdown(trimmed.slice(3), lineHighlight, lineCursors)}
        </h2>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3_${i}`} className="text-base sm:text-lg font-bold text-[#DCB001] mb-2 mt-5 tracking-tight">
          {parseInlineMarkdown(trimmed.slice(4), lineHighlight, lineCursors)}
        </h3>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      elements.push(
        <h4 key={`h4_${i}`} className="text-sm sm:text-base font-semibold text-[#CFD4DD] mb-1.5 mt-4">
          {parseInlineMarkdown(trimmed.slice(5), lineHighlight, lineCursors)}
        </h4>
      );
      i++;
      continue;
    }

    // 9. Centered block: <div align="center"> or <center>
    if (/^<(?:div\s+align=["']center["']|center)(?:\s+[^>]*)?>/i.test(trimmed)) {
      const centerLines: string[] = [];
      i++;
      while (i < lines.length && !/<\/(?:div|center)>/i.test(lines[i])) {
        centerLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing tag

      elements.push(
        <div key={`center_${i}`} className="my-4 text-center">
          {renderGithubMarkdown(centerLines.join('\n'), activeHighlight, lineCursors)}
        </div>
      );
      continue;
    }

    // 10. Anchor target: <a id="..." name="..."></a>
    const anchorOnlyMatch = trimmed.match(/^<a\s+(?:id|name)=["']([^"']*)["'](?:\s*\/?>|>\s*<\/a>)$/i);
    if (anchorOnlyMatch) {
      elements.push(<span key={`anchor_${i}`} id={anchorOnlyMatch[1]} className="scroll-mt-24 block h-0" />);
      i++;
      continue;
    }

    // 11. Standard Blockquote (> )
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      elements.push(
        <blockquote
          key={`quote_${i}`}
          className="my-3 pl-4 py-2 border-l-4 border-[#DCB001] bg-[#1B1C1F]/60 rounded-r-xl text-xs sm:text-sm text-[#CFD4DD] italic leading-relaxed"
        >
          {quoteLines.map((q, idx) => (
            <p key={idx} className="my-0.5">{parseInlineMarkdown(q, lineHighlight, lineCursors)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // 12. Task List (- [ ] or - [x])
    if (/^[-*]\s+\[([ xX])\]/.test(trimmed)) {
      const isChecked = /^[-*]\s+\[([xX])\]/.test(trimmed);
      const taskText = trimmed.replace(/^[-*]\s+\[([ xX])\]\s*/, '');
      elements.push(
        <div key={`task_${i}`} className="flex items-start gap-2.5 my-1.5 pl-1 text-xs sm:text-sm">
          <input
            type="checkbox"
            checked={isChecked}
            readOnly
            className="mt-1 w-3.5 h-3.5 rounded accent-[#DCB001] bg-[#1B1C1F] border-[#2A2C30] cursor-default"
          />
          <span className={isChecked ? 'line-through text-[#787C83]' : 'text-[#CFD4DD]'}>
            {parseInlineMarkdown(taskText, lineHighlight, lineCursors)}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // 13. Unordered List (- or * or +)
    if (/^[-*+]\s+/.test(trimmed)) {
      const listText = trimmed.replace(/^[-*+]\s+/, '');
      elements.push(
        <div key={`ul_${i}`} className="flex items-start gap-2 my-1 pl-3 text-xs sm:text-sm text-[#CFD4DD]">
          <span className="text-[#DCB001] font-bold text-sm leading-none mt-1.5">•</span>
          <span className="flex-1 leading-relaxed">{parseInlineMarkdown(listText, lineHighlight, lineCursors)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 14. Ordered List (1. 2. etc)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      elements.push(
        <div key={`ol_${i}`} className="flex items-start gap-2 my-1 pl-3 text-xs sm:text-sm text-[#CFD4DD]">
          <span className="font-mono text-[11px] font-bold text-[#DCB001] shrink-0 mt-0.5">{numMatch[1]}.</span>
          <span className="flex-1 leading-relaxed">{parseInlineMarkdown(numMatch[2], lineHighlight, lineCursors)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 15. Blank line
    if (trimmed === '') {
      elements.push(
        <div key={`blank_${i}`} className="h-2">
          {lineCursors.length > 0 &&
            lineCursors.map((c, cIdx) => (
              <LiveCursorBeacon
                key={`cursor_blank_${c.userId || 'local'}_${cIdx}`}
                lineIndex={c.lineIndex}
                col={c.col}
                userName={c.userName}
                color={c.color}
                isLocal={c.isLocal}
              />
            ))}
        </div>
      );
      i++;
      continue;
    }

    // 16. Paragraph
    elements.push(
      <p key={`p_${i}`} className="my-1.5 text-xs sm:text-sm text-[#CFD4DD] leading-relaxed">
        {parseInlineMarkdown(line, lineHighlight, lineCursors)}
      </p>
    );
    i++;
  }

  return elements;
}

export function MarkdownRenderer({
  content,
  activeHighlight,
  activeCursor,
  className = '',
}: {
  content?: string;
  activeHighlight?: ActiveHighlightInfo | null;
  activeCursor?: ActiveCursorInfo[] | ActiveCursorInfo | null;
  className?: string;
}) {
  if (!content || !content.trim()) {
    return <p className="text-xs text-[#787C83] italic">No description provided.</p>;
  }

  return (
    <div className={`space-y-1 font-sans text-xs leading-relaxed ${className}`}>
      {renderGithubMarkdown(content, activeHighlight, activeCursor)}
    </div>
  );
}

export default MarkdownRenderer;
