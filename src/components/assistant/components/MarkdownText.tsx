'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import React, { memo } from 'react';
import CodeBlock from './CodeBlock';

const MarkdownTextImpl = ({ children }: { children: string }) => {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // ── Headings ──
          h1: ({ className, ...props }) => (
            <h1 className={`mt-8 mb-4 text-2xl font-bold tracking-tight text-white first:mt-0 last:mb-0 ${className || ''}`} {...props} />
          ),
          h2: ({ className, ...props }) => (
            <h2 className={`mt-6 mb-3 text-xl font-semibold tracking-tight text-white first:mt-0 last:mb-0 ${className || ''}`} {...props} />
          ),
          h3: ({ className, ...props }) => (
            <h3 className={`mt-5 mb-2 text-lg font-semibold tracking-tight text-white first:mt-0 last:mb-0 ${className || ''}`} {...props} />
          ),
          h4: ({ className, ...props }) => (
            <h4 className={`mt-4 mb-2 text-base font-semibold text-white first:mt-0 last:mb-0 ${className || ''}`} {...props} />
          ),
          h5: ({ className, ...props }) => (
            <h5 className={`mt-4 mb-2 text-sm font-semibold text-white first:mt-0 last:mb-0 ${className || ''}`} {...props} />
          ),
          h6: ({ className, ...props }) => (
            <h6 className={`mt-4 mb-2 text-xs font-semibold text-gray-300 first:mt-0 last:mb-0 ${className || ''}`} {...props} />
          ),

          // ── Paragraph ──
          p: ({ className, ...props }) => (
            <p className={`mt-3 mb-3 leading-7 text-gray-200 first:mt-0 last:mb-0 ${className || ''}`} {...props} />
          ),

          // ── Links ──
          a: ({ className, ...props }) => (
            <a className={`text-blue-400 hover:text-blue-300 underline underline-offset-2 ${className || ''}`} target="_blank" rel="noopener noreferrer" {...props} />
          ),

          // ── Blockquote ──
          blockquote: ({ className, ...props }) => (
            <blockquote className={`border-l-2 border-blue-500/50 pl-4 italic text-gray-400 my-4 ${className || ''}`} {...props} />
          ),

          // ── Lists ──
          ul: ({ className, ...props }) => (
            <ul className={`my-3 ml-6 list-disc space-y-1 [&>li]:text-gray-200 ${className || ''}`} {...props} />
          ),
          ol: ({ className, ...props }) => (
            <ol className={`my-3 ml-6 list-decimal space-y-1 [&>li]:text-gray-200 ${className || ''}`} {...props} />
          ),
          li: ({ className, ...props }) => (
            <li className={`leading-7 ${className || ''}`} {...props} />
          ),

          // ── Horizontal Rule ──
          hr: ({ className, ...props }) => (
            <hr className={`my-6 border-t border-gray-700 ${className || ''}`} {...props} />
          ),

          // ── Tables ──
          table: ({ className, ...props }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-gray-700">
              <table className={`w-full border-collapse text-sm ${className || ''}`} {...props} />
            </div>
          ),
          thead: ({ className, ...props }) => (
            <thead className={`bg-[#1a1a1a] ${className || ''}`} {...props} />
          ),
          th: ({ className, ...props }) => (
            <th className={`px-4 py-2.5 text-left font-semibold text-gray-300 border-b border-gray-700 first:rounded-tl-lg last:rounded-tr-lg ${className || ''}`} {...props} />
          ),
          td: ({ className, ...props }) => (
            <td className={`px-4 py-2.5 text-gray-200 border-b border-gray-800 ${className || ''}`} {...props} />
          ),
          tr: ({ className, ...props }) => (
            <tr className={`hover:bg-white/[0.02] transition-colors ${className || ''}`} {...props} />
          ),

          // ── Pre (block code wrapper) ──
          // In react-markdown: block code is <pre><code class="language-xxx">content</code></pre>
          // We need to extract the language and content from the code child
          pre: ({ children: preChildren }) => {
            // Extract language and code from the nested code element
            const codeElement = Array.isArray(preChildren) ? preChildren[0] : preChildren;
            const props = codeElement && typeof codeElement === 'object' && 'props' in codeElement ? codeElement.props as { className?: string; children?: React.ReactNode } : undefined;
            const className = props?.className || '';
            const code = String(props?.children || '').replace(/\n$/, '');
            const match = /language-(\w+)/.exec(className);
            const language = match ? match[1] : 'text';

            return <CodeBlock language={language} code={code} />;
          },

          // ── Code (inline only — block code is handled by pre) ──
          code: ({ className, children, ...props }) => {
            // If this has a language class, it's a block code (handled by pre above)
            if (className && /language-/.test(className)) {
              return <code className={className} {...props}>{children}</code>;
            }

            // Inline code
            return (
              <code
                className={`px-1.5 py-0.5 rounded bg-[#1a1a1a] text-blue-300 font-mono text-[13px] border border-gray-800 ${className || ''}`}
                {...props}
              >
                {children}
              </code>
            );
          },

          // ── Strong ──
          strong: ({ className, ...props }) => (
            <strong className={`font-bold text-white ${className || ''}`} {...props} />
          ),

          // ── Em ──
          em: ({ className, ...props }) => (
            <em className={`italic text-gray-300 ${className || ''}`} {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};

export const MarkdownText = memo(MarkdownTextImpl);
