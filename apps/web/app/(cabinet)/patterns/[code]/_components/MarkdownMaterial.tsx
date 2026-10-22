import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

export function MarkdownMaterial({ content }: Readonly<{ content: string }>) {
  return (
    <article className="pattern-markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { plainText: ["text", "plaintext", "txt"] }]]}
        skipHtml
      >
        {content}
      </Markdown>
    </article>
  );
}
