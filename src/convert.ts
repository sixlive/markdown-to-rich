import { marked } from 'marked';
import DOMPurify from 'dompurify';

export interface ConvertOptions {
  /** A single Enter becomes a line break instead of collapsing into a space. */
  lineBreaks: boolean;
  /** Blank lines beyond the first between paragraphs become empty lines instead of collapsing. */
  keepBlankLines: boolean;
  /**
   * How paragraphs are separated. Chat composers like Slack ignore CSS margins,
   * so 'blank-line' puts a real empty line between blocks; 'margin' uses
   * paragraph spacing, which word processors and email clients honor.
   */
  spacing: 'blank-line' | 'margin';
}

export const defaultOptions: ConvertOptions = { lineBreaks: true, keepBlankLines: true, spacing: 'blank-line' };

const BLANK_LINE = '\u00a0';
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Markdown collapses any run of blank lines into one paragraph break. Insert a
 * non-breaking-space paragraph for each extra blank line so the gap survives.
 * Fenced code blocks are left untouched.
 */
export function preserveBlankLines(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let fence: string | null = null;
  let blankRun = 0;

  for (const line of lines) {
    const fenceMatch = line.match(FENCE);
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null;
      out.push(line);
      continue;
    }

    if (line.trim() === '') {
      blankRun++;
      continue;
    }

    if (blankRun > 0) {
      out.push('');
      // Only pad between content, not at the very start of the document.
      if (out.length > 1) {
        for (let i = 1; i < blankRun; i++) out.push(BLANK_LINE, '');
      }
    }
    blankRun = 0;
    if (fenceMatch) fence = fenceMatch[1];
    out.push(line);
  }

  return out.join('\n');
}

export function markdownToHtml(markdown: string, options: ConvertOptions = defaultOptions): string {
  const source = options.keepBlankLines ? preserveBlankLines(markdown) : markdown;
  const html = marked.parse(source, { gfm: true, breaks: options.lineBreaks, async: false });
  return DOMPurify.sanitize(html);
}

const MONO = "Menlo, Consolas, 'Courier New', monospace";

const STYLES: Record<string, string> = {
  p: 'margin:0 0 12px 0;line-height:1.5;',
  h1: 'font-size:26px;font-weight:bold;margin:18px 0 10px 0;line-height:1.25;',
  h2: 'font-size:22px;font-weight:bold;margin:16px 0 8px 0;line-height:1.25;',
  h3: 'font-size:18px;font-weight:bold;margin:14px 0 6px 0;line-height:1.3;',
  h4: 'font-size:16px;font-weight:bold;margin:12px 0 6px 0;',
  h5: 'font-size:14px;font-weight:bold;margin:12px 0 6px 0;',
  h6: 'font-size:13px;font-weight:bold;margin:12px 0 6px 0;color:#555555;',
  ul: 'margin:0 0 12px 0;padding-left:28px;',
  ol: 'margin:0 0 12px 0;padding-left:28px;',
  li: 'margin:0 0 4px 0;line-height:1.5;',
  blockquote: 'margin:0 0 12px 0;padding:2px 0 2px 14px;border-left:4px solid #d0d7de;color:#555555;',
  code: `font-family:${MONO};font-size:0.9em;background-color:#f2f3f5;padding:1px 4px;border-radius:3px;`,
  a: 'color:#0b57d0;text-decoration:underline;',
  hr: 'border:none;border-top:1px solid #d0d7de;margin:16px 0;',
  table: 'border-collapse:collapse;margin:0 0 12px 0;',
  th: 'border:1px solid #d0d7de;padding:6px 10px;font-weight:bold;background-color:#f6f8fa;text-align:left;',
  td: 'border:1px solid #d0d7de;padding:6px 10px;',
  img: 'max-width:100%;',
};

const CODE_BLOCK_STYLE = `font-family:${MONO};font-size:13px;line-height:1.45;overflow-wrap:anywhere;background-color:#f6f8fa;padding:10px 12px;margin:0 0 12px 0;border-radius:4px;`;

// Elements whose whitespace-only children are formatting noise from the HTML source.
const BLOCK_CONTAINERS = new Set(['DIV', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR']);
const BLOCK_ELEMENTS = new Set([...BLOCK_CONTAINERS, 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'PRE']);

/** True when whitespace next to this sibling sits against a block edge, so it renders as nothing. */
function isBlockBoundary(sibling: Node | null, parent: Element): boolean {
  if (sibling === null) return parent.id === 'root' || BLOCK_ELEMENTS.has(parent.tagName);
  return sibling.nodeType === 1 && BLOCK_ELEMENTS.has((sibling as Element).tagName);
}

/**
 * Rewrite <pre><code> as a div of <br>-separated lines with non-breaking spaces.
 * Many paste targets (Google Docs, Slack, some mail clients) drop <pre> whitespace,
 * which flattens code onto one line and loses indentation.
 */
function flattenCodeBlock(pre: HTMLElement): HTMLElement {
  const doc = pre.ownerDocument;
  const div = doc.createElement('div');
  div.setAttribute('style', CODE_BLOCK_STYLE);
  const lines = (pre.textContent ?? '').replace(/\n$/, '').split('\n');
  lines.forEach((line, i) => {
    if (i > 0) div.appendChild(doc.createElement('br'));
    // Indentation and runs of spaces must survive, but single spaces stay
    // breakable so long lines wrap instead of running off the page.
    const text = line
      .replace(/\t/g, '    ')
      .replace(/^ +/, (lead) => '\u00a0'.repeat(lead.length))
      .replace(/ {2,}/g, (run) => ' ' + '\u00a0'.repeat(run.length - 1));
    div.appendChild(doc.createTextNode(text || '\u00a0'));
  });
  return div;
}

function isBlankParagraph(el: Element): boolean {
  return el.tagName === 'P' && el.textContent === BLANK_LINE;
}

/**
 * Replace margins between blocks with real empty lines, the same thing you get
 * by pressing Enter twice. Blank-line paragraphs from keepBlankLines are folded
 * into the count so each one still adds exactly one empty line.
 */
function separateWithBlankLines(container: Element) {
  const doc = container.ownerDocument;
  let pendingBlankLines = 0;
  let seenContent = false;

  for (const el of [...container.children]) {
    if (isBlankParagraph(el)) {
      pendingBlankLines++;
      el.remove();
      continue;
    }
    if (el.tagName === 'BLOCKQUOTE') separateWithBlankLines(el);
    el.setAttribute('style', `${el.getAttribute('style') ?? ''}margin-top:0;margin-bottom:0;`);
    if (seenContent) {
      for (let i = 0; i <= pendingBlankLines; i++) {
        const line = doc.createElement('p');
        line.setAttribute('style', 'margin:0;line-height:1.5;');
        line.appendChild(doc.createElement('br'));
        el.before(line);
      }
    }
    pendingBlankLines = 0;
    seenContent = true;
  }
}

/**
 * Turn rendered markdown HTML into self-contained HTML for the clipboard:
 * inline styles, code blocks that keep their lines, and no stray newlines
 * that a paste target might read as extra spacing.
 */
export function toClipboardHtml(html: string, spacing: ConvertOptions['spacing'] = defaultOptions.spacing): string {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root')!;

  root.querySelectorAll('pre').forEach((pre) => pre.replaceWith(flattenCodeBlock(pre)));

  root.querySelectorAll('input[type="checkbox"]').forEach((box) => {
    const checked = (box as HTMLInputElement).hasAttribute('checked');
    box.replaceWith(doc.createTextNode(checked ? '☑' : '☐'));
  });

  root.querySelectorAll('*').forEach((el) => {
    const style = STYLES[el.tagName.toLowerCase()];
    if (style) el.setAttribute('style', style);
    el.removeAttribute('class');
  });

  // A <p> inside a list item would add paragraph spacing to every bullet.
  root.querySelectorAll('li > p').forEach((p) => p.setAttribute('style', 'margin:0;line-height:1.5;'));
  root.querySelectorAll('li > ul, li > ol').forEach((list) => list.setAttribute('style', 'margin:4px 0 0 0;padding-left:28px;'));
  root.querySelectorAll('blockquote > :last-child').forEach((el) => {
    el.setAttribute('style', `${el.getAttribute('style') ?? ''}margin-bottom:0;`);
  });

  // Any newline still in a text node is source formatting, not a line break the
  // author asked for (those are already <br>). Collapse it like a browser would.
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  for (const node of textNodes) {
    const parent = node.parentElement!;
    if (/^\s*$/.test(node.data) && !node.data.includes('\u00a0') && (parent === root || BLOCK_CONTAINERS.has(parent.tagName))) {
      node.remove();
    } else if (node.data.includes('\n')) {
      const data = node.data;
      node.data = data.replace(/\s*\n\s*/g, (match, offset: number) => {
        if (offset === 0 && isBlockBoundary(node.previousSibling, parent)) return '';
        if (offset + match.length === data.length && isBlockBoundary(node.nextSibling, parent)) return '';
        return ' ';
      });
    }
  }

  if (spacing === 'blank-line') separateWithBlankLines(root);

  return root.innerHTML;
}

export function convert(markdown: string, options: ConvertOptions = defaultOptions): string {
  return toClipboardHtml(markdownToHtml(markdown, options), options.spacing);
}
