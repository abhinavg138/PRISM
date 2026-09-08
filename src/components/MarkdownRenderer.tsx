import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Project } from '../types/index';

interface MarkdownRendererProps {
  content: string;
  allProjects?: Project[];
  onSelectProject?: (project: Project) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  allProjects = [],
  onSelectProject
}) => {
  return (
    <div className="prose-clean text-slate-800 text-sm leading-relaxed space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-base font-bold tracking-tight text-slate-900 mt-3 mb-2 pb-1 border-b border-slate-100 flex items-center gap-1.5" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-sm font-bold tracking-tight text-slate-900 mt-3 mb-1.5" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-sm font-semibold tracking-tight text-slate-800 mt-2 mb-1" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="text-sm text-slate-700 leading-relaxed mb-2 last:mb-0" {...props} />
          ),
          strong: ({ node, children, ...props }) => {
            const text = String(children);
            // Check for key metrics (e.g., numbers, percentages, risk tiers)
            const isMetric = /^\d+([,.]\d+)?%?$/.test(text) ||
              /^\d+\/\d+$/.test(text) ||
              /^(CRITICAL|HIGH|MODERATE|LOW|P1|P2|P3)$/i.test(text) ||
              /^\d+,\d+\s+projects?$/i.test(text);

            return (
              <strong
                className={`font-semibold text-slate-900 ${
                  isMetric
                    ? 'bg-slate-100/90 text-slate-950 px-1 py-0.5 rounded text-[12px] font-mono'
                    : ''
                }`}
                {...props}
              >
                {children}
              </strong>
            );
          },
          em: ({ node, ...props }) => (
            <em className="italic text-slate-600" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-4 space-y-1 mb-2.5 text-sm text-slate-700" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-4 space-y-1 mb-2.5 text-sm text-slate-700" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed text-sm text-slate-700 pl-0.5" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="pl-3 border-l-2 border-blue-400 bg-blue-50/50 py-1 my-2 rounded-r text-xs text-slate-700 italic" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="my-2.5 w-full overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs text-left" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="bg-slate-100/90 p-2 font-semibold text-slate-800 border-b border-slate-200" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="p-2 border-b border-slate-100 text-slate-700" {...props} />
          ),
          code: ({ node, className, children, ...props }: any) => {
            const isInline = !className?.includes('language-');
            const codeText = String(children).trim();

            // Check if code block references an existing project ID (e.g. 701396, PRJ-IN-001)
            const matchedProject = isInline && allProjects.length > 0
              ? allProjects.find(p => p.id.toLowerCase() === codeText.toLowerCase().replace(/^paimana-/, ''))
              : null;

            if (matchedProject && onSelectProject) {
              return (
                <button
                  type="button"
                  onClick={() => onSelectProject(matchedProject)}
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                  title={`Click to view ${matchedProject.name}`}
                >
                  <span>{codeText}</span>
                  <span className="text-[9px] uppercase text-blue-500">↗</span>
                </button>
              );
            }

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[12px] text-slate-800 border border-slate-200/80"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <pre className="p-3 my-2 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto">
                <code {...props}>{children}</code>
              </pre>
            );
          },
          a: ({ node, ...props }) => (
            <a
              className="text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-3 border-slate-200" {...props} />
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
