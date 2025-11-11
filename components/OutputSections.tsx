'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Message } from '@/lib/types';

interface OutputSectionsProps {
  content: string;
  isStreaming: boolean;
  messages: Message[];
}

export function OutputSections({ content, isStreaming, messages }: OutputSectionsProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const structuredSplit = useMemo(() => splitStructuredContent(content), [content]);
  const sections = useMemo(
    () => parseSections(structuredSplit.structuredText),
    [structuredSplit.structuredText]
  );
  const formattedMessages = useMemo(
    () =>
      messages.map(message => {
        const split = splitStructuredContent(message.content);
        let displayContent = split.plainText;

        if (!displayContent && split.hasStructured) {
          displayContent = getPrimarySectionContent(split.structuredText);
        }

        if (!displayContent) {
          displayContent = split.hasStructured ? '_Structured details below_' : message.content;
        }

        return { message, displayContent };
      }),
    [messages]
  );

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isStreaming, messages]);

  return (
    <div
      ref={contentRef}
      className="h-full overflow-y-auto space-y-8 p-6"
    >
      <div>
        {messages.length === 0 ? (
          <div className="glass glass-border rounded-2xl p-4 text-textMuted text-sm">
            Ask a question to start the session.
          </div>
        ) : (
          <div className="space-y-3">
            {formattedMessages.map(({ message, displayContent }, index) => (
              <ChatMessage key={`${message.role}-${index}`} message={message} content={displayContent} />
            ))}
          </div>
        )}
      </div>

      {sections.length > 0 && (
        <div className="space-y-4">
          {sections.map((section, index) => (
            <Section key={index} section={section} />
          ))}
        </div>
      )}

      {isStreaming && (
        <div className="flex items-center gap-2 text-accent">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          <span className="text-sm">Generating...</span>
        </div>
      )}
    </div>
  );
}

function ChatMessage({ message, content }: { message: Message; content: string }) {
  const isUser = message.role === 'user';
  return (
    <div
      className={`glass glass-border rounded-2xl p-4 space-y-2 ${
        isUser ? 'border-accent/40' : 'border-surfaceHover'
      }`}
    >
      <p className="text-xs font-medium tracking-wide text-textDim">
        {isUser ? 'You' : 'Assistant'}
      </p>
      <div className="prose prose-invert prose-sm max-w-none">
        <MarkdownContent content={content} />
      </div>
    </div>
  );
}

interface ParsedSection {
  type: 'answer' | 'code' | 'test' | 'failures' | 'text';
  title?: string;
  content: string;
  language?: string;
  filepath?: string;
}

function parseSections(markdown: string): ParsedSection[] {
  if (!markdown || !markdown.trim()) {
    return [];
  }

  let working = markdown.trim();
  working = stripConversationBlocks(working);

  const firstHeadingIndex = findFirstHeadingIndex(working);
  if (firstHeadingIndex > 0) {
    working = working.slice(firstHeadingIndex).trimStart();
  }

  if (!working) {
    return [];
  }

  const letterSections = extractLetteredSections(working);
  if (letterSections.length > 0) {
    return letterSections;
  }

  return extractNamedSections(working);
}

function Section({ section }: { section: ParsedSection }) {
  const decorativeBorders = {
    answer: 'border-l-2 border-accent/80',
    code: 'border-l-2 border-green-500/70',
    test: 'border-l-2 border-yellow-500/70',
    failures: 'border-l-2 border-red-500/70',
    text: '',
  };

  const defaultTitles = new Set(['Answer', 'Code', 'Test & Validation', 'Failure Modes & Fixes']);
  const showTitle = section.title && !defaultTitles.has(section.title);

  return (
    <div className={`bg-surface rounded-xl p-5 ${decorativeBorders[section.type]}`}>
      {showTitle && (
        <p className="text-sm font-semibold text-text mb-3">{section.title}</p>
      )}
      <div className="prose prose-invert prose-sm max-w-none">
        <MarkdownContent content={section.content} />
      </div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  // Parse code blocks
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const parts: JSX.Element[] = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      parts.push(<TextBlock key={`text-${lastIndex}`} content={text} />);
    }

    // Add code block
    const language = match[1] || 'text';
    const code = match[2];
    parts.push(
      <CodeBlock key={`code-${match.index}`} language={language} code={code} />
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(<TextBlock key={`text-${lastIndex}`} content={content.slice(lastIndex)} />);
  }

  return <>{parts}</>;
}

function TextBlock({ content }: { content: string }) {
  // Simple markdown parsing for text
  const lines = content.split('\n').map((line, i) => {
    // Headers
    if (line.startsWith('### ')) {
      return <h4 key={i} className="text-base font-semibold mt-4 mb-2 text-text">{line.slice(4)}</h4>;
    }
    if (line.startsWith('## ')) {
      return <h3 key={i} className="text-lg font-semibold mt-4 mb-2 text-text">{line.slice(3)}</h3>;
    }
    // Lists
    if (line.match(/^\d+\. /)) {
      return <li key={i} className="ml-4 text-text">{line.replace(/^\d+\. /, '')}</li>;
    }
    if (line.startsWith('- ')) {
      return <li key={i} className="ml-4 text-text">{line.slice(2)}</li>;
    }
    // Bold
    if (line.includes('**')) {
      const parts = line.split('**');
      return (
        <p key={i} className="mb-2 text-text">
          {parts.map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : part))}
        </p>
      );
    }
    // Regular paragraph
    if (line.trim()) {
      return <p key={i} className="mb-2 text-text">{line}</p>;
    }
    return <br key={i} />;
  });

  return <div>{lines}</div>;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="relative my-4 group">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={copyToClipboard}
          className="px-2 py-1 text-xs bg-background border border-border rounded hover:bg-surfaceHover text-textMuted hover:text-text"
        >
          Copy
        </button>
      </div>
      <div className="bg-background border border-border rounded-lg p-4 overflow-x-auto">
        <div className="text-xs text-textMuted mb-2">{language}</div>
        <pre className="text-sm text-text font-mono">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

interface StructuredSplitResult {
  plainText: string;
  structuredText: string;
  hasStructured: boolean;
}

function splitStructuredContent(text: string): StructuredSplitResult {
  if (!text) {
    return { plainText: '', structuredText: '', hasStructured: false };
  }

  const normalized = text.trim();
  const markerRegex = /(?:^|\n)(CONVERSATION|STRUCTURED OUTPUT|(?:##\s*)?[A-D]\)\s|[A-D]\)\s)/i;
  const match = markerRegex.exec(normalized);

  if (!match) {
    return { plainText: normalized, structuredText: '', hasStructured: false };
  }

  const index = match.index ?? 0;
  const plainText = normalized.slice(0, index).trimEnd();
  const structuredText = normalized.slice(index).trimStart();

  return {
    plainText,
    structuredText,
    hasStructured: structuredText.length > 0,
  };
}

function extractLetteredSections(markdown: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const letterRegex = /(?:^|\n)(?:##\s*)?([A-D])\)\s+([^\n]+)\n([\s\S]*?)(?=(?:\n(?:##\s*)?[A-D]\)\s+[^\n]+)|$)/g;
  let match: RegExpExecArray | null;

  const typeMap: Record<string, ParsedSection['type']> = {
    A: 'answer',
    B: 'code',
    C: 'test',
    D: 'failures',
  };

  while ((match = letterRegex.exec(markdown)) !== null) {
    const letter = match[1];
    const title = match[2]?.trim();
    const content = match[3]?.trim() || '';
    const type = typeMap[letter] ?? 'text';
    sections.push({ type, title, content });
  }

  return sections;
}

function extractNamedSections(markdown: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const headingRegex =
    /(?:^|\n)#{0,3}\s*(Answer|Code|Test(?:\s*&|\s*and)?\s*Validation|Test|Failures?|Failure Modes & Fixes)\s*:?\s*\n([\s\S]*?)(?=\n#{0,3}\s*(Answer|Code|Test(?:\s*&|\s*and)?\s*Validation|Test|Failures?|Failure Modes & Fixes)\s*:?\n|$)/gi;

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(markdown)) !== null) {
    const heading = match[1]?.trim() ?? '';
    const body = match[2]?.trim() ?? '';
    const type = mapHeadingToSection(heading);
    if (!type) continue;
    sections.push({ type, title: heading, content: body });
  }

  return sections;
}

function mapHeadingToSection(heading: string): ParsedSection['type'] | null {
  const normalized = heading.toLowerCase();
  if (normalized.startsWith('answer')) return 'answer';
  if (normalized.startsWith('code')) return 'code';
  if (normalized.startsWith('test')) return 'test';
  if (normalized.startsWith('failure')) return 'failures';
  return null;
}

function findFirstHeadingIndex(text: string): number {
  const headingPatterns = [
    /(^|\n)((?:##\s*)?[A-D]\)\s+)/,
    /(^|\n)(Answer\b)/i,
    /(^|\n)(Code\b)/i,
    /(^|\n)(Test(?:\s*&|\s*and)?\s*Validation\b|Test\b)/i,
    /(^|\n)(Failures?\b|Failure Modes & Fixes\b)/i,
  ];

  let earliest = -1;

  for (const pattern of headingPatterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const headingStart = match.index + (match[1] ? match[1].length : 0);
    if (earliest === -1 || headingStart < earliest) {
      earliest = headingStart;
    }
  }

  return earliest;
}

function stripConversationBlocks(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(
    /^CONVERSATION[\s\S]*?(?=\n(?:STRUCTURED OUTPUT|(?:##\s*)?[A-D]\)\s|[A-D]\)\s|Answer|Code|Test|Failure))/i,
    ''
  );
  cleaned = cleaned.replace(/^STRUCTURED OUTPUT\s*/i, '');
  return cleaned.trimStart();
}

function getPrimarySectionContent(markdown: string): string {
  const sections = parseSections(markdown);
  if (!sections.length) return '';
  const preferredOrder: ParsedSection['type'][] = ['answer', 'code', 'test', 'failures', 'text'];
  for (const type of preferredOrder) {
    const section = sections.find(sec => sec.type === type && sec.content.trim());
    if (section) {
      return section.content.trim();
    }
  }
  return sections[0]?.content?.trim() ?? '';
}
