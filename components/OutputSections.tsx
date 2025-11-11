'use client';

import { useEffect, useRef } from 'react';

interface OutputSectionsProps {
  content: string;
  isStreaming: boolean;
}

export function OutputSections({ content, isStreaming }: OutputSectionsProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (contentRef.current && isStreaming) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  // Parse markdown-like sections
  const sections = parseSections(content);

  return (
    <div
      ref={contentRef}
      className="h-full overflow-y-auto space-y-6 p-6"
    >
      {sections.length === 0 && !isStreaming && (
        <div className="flex items-center justify-center h-full text-textMuted">
          Response will appear here
        </div>
      )}

      {sections.map((section, index) => (
        <Section key={index} section={section} />
      ))}

      {isStreaming && (
        <div className="flex items-center gap-2 text-accent">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          <span className="text-sm">Generating...</span>
        </div>
      )}
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
  const sections: ParsedSection[] = [];

  // Split by major headers (## A), B), C), D))
  const headerRegex = /^## ([A-D])\) (.+)$/gm;
  const parts = markdown.split(headerRegex);

  if (parts[0].trim()) {
    sections.push({ type: 'text', content: parts[0].trim() });
  }

  for (let i = 1; i < parts.length; i += 3) {
    const letter = parts[i];
    const title = parts[i + 1];
    const content = parts[i + 2]?.trim() || '';

    let type: ParsedSection['type'] = 'text';
    if (letter === 'A') type = 'answer';
    else if (letter === 'B') type = 'code';
    else if (letter === 'C') type = 'test';
    else if (letter === 'D') type = 'failures';

    sections.push({ type, title, content });
  }

  return sections;
}

function Section({ section }: { section: ParsedSection }) {
  const sectionStyles = {
    answer: 'border-l-4 border-accent',
    code: 'border-l-4 border-green-500',
    test: 'border-l-4 border-yellow-500',
    failures: 'border-l-4 border-red-500',
    text: '',
  };

  const sectionLabels = {
    answer: 'Answer',
    code: 'Code',
    test: 'Test & Validation',
    failures: 'Failure Modes & Fixes',
    text: '',
  };

  return (
    <div className={`bg-surface rounded-lg p-4 ${sectionStyles[section.type]}`}>
      {section.type !== 'text' && (
        <h3 className="text-sm font-semibold text-text mb-3 uppercase tracking-wide">
          {sectionLabels[section.type]}
        </h3>
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
