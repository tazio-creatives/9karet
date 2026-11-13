import type { ReactNode } from 'react';

// Renders blog post content — a small Markdown subset — straight to React
// elements. Deliberately NOT an HTML renderer: nothing typed into the admin
// editor is ever injected as markup, so content can't break the page or
// smuggle scripts in. Kept in sync by hand with the storefront copy (web/src/features/blog).
//
// Supported:
//   # / ## / ### Heading        (# renders as h2 — the page title is the h1)
//   - item / * item             bullet list
//   1. item                     numbered list
//   > quote                     blockquote
//   ![alt text](image-url)      image on its own line
//   **bold**, *italic*, [link text](https://… or /path)
//   blank line                  new paragraph

const SAFE_URL = /^(https?:\/\/|\/(?!\/))/i;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${i++}`;
    if (match[2] !== undefined) {
      nodes.push(<strong key={key}>{match[2]}</strong>);
    } else if (match[4] !== undefined) {
      nodes.push(<em key={key}>{match[4]}</em>);
    } else {
      const label = match[6];
      const href = match[7];
      if (SAFE_URL.test(href)) {
        const external = /^https?:\/\//i.test(href);
        nodes.push(
          <a key={key} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {label}
          </a>,
        );
      } else {
        nodes.push(label);
      }
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { type: 'heading'; level: 2 | 3 | 4; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'image'; alt: string; src: string };

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line);
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    const quote = /^>\s?(.*)$/.exec(line);

    if (heading) {
      flushParagraph();
      blocks.push({ type: 'heading', level: (heading[1].length + 1) as 2 | 3 | 4, text: heading[2] });
    } else if (image) {
      flushParagraph();
      if (SAFE_URL.test(image[2])) blocks.push({ type: 'image', alt: image[1], src: image[2] });
    } else if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? 'ul' : 'ol';
      const text = (bullet ?? numbered)![1];
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === type) prev.items.push(text);
      else blocks.push({ type, items: [text] });
    } else if (quote) {
      flushParagraph();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === 'quote') prev.text += ` ${quote[1]}`;
      else blocks.push({ type: 'quote', text: quote[1] });
    } else {
      paragraph.push(line);
    }
  }
  flushParagraph();
  return blocks;
}

export function renderBlogContent(source: string): ReactNode {
  return parseBlocks(source).map((block, i) => {
    const key = `b${i}`;
    switch (block.type) {
      case 'heading': {
        const Tag = `h${block.level}` as 'h2' | 'h3' | 'h4';
        return <Tag key={key}>{renderInline(block.text, key)}</Tag>;
      }
      case 'ul':
      case 'ol': {
        const Tag = block.type;
        return (
          <Tag key={key}>
            {block.items.map((item, j) => (
              <li key={j}>{renderInline(item, `${key}-${j}`)}</li>
            ))}
          </Tag>
        );
      }
      case 'quote':
        return <blockquote key={key}>{renderInline(block.text, key)}</blockquote>;
      case 'image':
        return (
          <figure key={key}>
            <img src={block.src} alt={block.alt} loading="lazy" />
            {block.alt && <figcaption>{block.alt}</figcaption>}
          </figure>
        );
      default:
        return <p key={key}>{renderInline(block.text, key)}</p>;
    }
  });
}
