import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// react-markdown escapes raw HTML by default; do not add rehype-raw (untrusted model/calendar text).
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none break-words prose-pre:overflow-x-auto", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

// Inline: strip the block <p> wrapper so it fits in a list item / badge.
export function MarkdownInline({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: (props) => <>{props.children}</> }}>
      {children}
    </ReactMarkdown>
  );
}
