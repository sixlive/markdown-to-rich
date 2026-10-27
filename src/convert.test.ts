import { describe, expect, it } from 'vitest';
import { convert, defaultOptions, preserveBlankLines, type ConvertOptions } from './convert';

const strip = (html: string) => html.replace(/ style="[^"]*"/g, '');
const opts = (overrides: Partial<ConvertOptions>): ConvertOptions => ({ ...defaultOptions, ...overrides });
const margin = opts({ spacing: 'margin' });
const EMPTY = '<p><br></p>';

describe('line breaks', () => {
  it('turns a single Enter into a <br>', () => {
    expect(strip(convert('Line one\nLine two\nLine three'))).toBe('<p>Line one<br>Line two<br>Line three</p>');
  });

  it('collapses single newlines into spaces when line breaks are off', () => {
    expect(strip(convert('Line one\nLine two', opts({ lineBreaks: false })))).toBe('<p>Line one Line two</p>');
  });

  it('keeps line breaks inside list items and blockquotes', () => {
    expect(strip(convert('- item a\n  continued\n- item b'))).toBe('<ul><li>item a<br>continued</li><li>item b</li></ul>');
    expect(strip(convert('> quote one\n> quote two'))).toBe('<blockquote><p>quote one<br>quote two</p></blockquote>');
  });

  it('handles Windows line endings', () => {
    expect(strip(convert('One\r\nTwo\r\n\r\n\r\nThree'))).toBe(`<p>One<br>Two</p>${EMPTY}${EMPTY}<p>Three</p>`);
  });

  it('emits no stray newlines between blocks', () => {
    const html = convert('# Title\n\n- a\n  - nested\n- b\n\n| x | y |\n|---|---|\n| 1 | 2 |\n\n> quote');
    expect(html).not.toContain('\n');
  });

  it('does not glue words together when collapsing soft breaks next to inline markup', () => {
    expect(strip(convert('- foo\n  **bar**', opts({ lineBreaks: false })))).toBe('<ul><li>foo <strong>bar</strong></li></ul>');
  });
});

// Chat composers (Slack) ignore CSS margins, so the gap has to be an actual empty line.
describe('blank-line spacing (Slack / chat)', () => {
  it('puts an empty line between every block, including around lists', () => {
    expect(strip(convert('Intro.\n\nTried:\n\n- one\n- two\n\nAfter the list.'))).toBe(
      `<p>Intro.</p>${EMPTY}<p>Tried:</p>${EMPTY}<ul><li>one</li><li>two</li></ul>${EMPTY}<p>After the list.</p>`,
    );
  });

  it('zeroes block margins so word processors do not double the gap', () => {
    const doc = new DOMParser().parseFromString(convert('One\n\n- two'), 'text/html');
    for (const el of doc.body.children) expect(el.getAttribute('style')).toMatch(/margin-top:0;margin-bottom:0;$|^margin:0;/);
  });

  it('adds one more empty line for each extra blank line typed', () => {
    expect(strip(convert('First\n\n\n\nSecond'))).toBe(`<p>First</p>${EMPTY}${EMPTY}${EMPTY}<p>Second</p>`);
  });

  it('collapses extra blank lines when that option is off', () => {
    expect(strip(convert('First\n\n\n\nSecond', opts({ keepBlankLines: false })))).toBe(`<p>First</p>${EMPTY}<p>Second</p>`);
  });

  it('separates paragraphs inside a blockquote', () => {
    expect(strip(convert('> one\n>\n> two'))).toBe(`<blockquote><p>one</p>${EMPTY}<p>two</p></blockquote>`);
  });

  it('adds no empty line at the start or end', () => {
    expect(strip(convert('\n\n\nOnly\n\n\n'))).toBe('<p>Only</p>');
  });
});

describe('margin spacing (Docs / Word / email)', () => {
  // Guards against copied HTML that forces margin:0 on every <p> and list-style:none
  // on lists, which pastes paragraphs as one block and makes bullets vanish.
  it('gives every paragraph and list explicit spacing and keeps bullets', () => {
    const html = convert('Intro.\n\n**Bold lead.** Body.\n\nTried:\n\n- one\n- two\n\nAfter the list.', margin);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const blocks = [...doc.body.children];
    expect(blocks.map((el) => el.tagName)).toEqual(['P', 'P', 'P', 'UL', 'P']);
    for (const el of blocks) expect(el.getAttribute('style')).toMatch(/^margin:0 0 12px 0;/);
    expect(html).not.toContain('list-style');
  });

  it('separates paragraphs with margin only', () => {
    expect(strip(convert('First\n\nSecond', margin))).toBe('<p>First</p><p>Second</p>');
  });

  it('keeps extra blank lines as empty paragraphs', () => {
    expect(strip(convert('First\n\n\n\nSecond', margin))).toBe('<p>First</p><p>&nbsp;</p><p>&nbsp;</p><p>Second</p>');
  });

  it('collapses extra blank lines when that option is off', () => {
    expect(strip(convert('First\n\n\n\nSecond', opts({ spacing: 'margin', keepBlankLines: false })))).toBe('<p>First</p><p>Second</p>');
  });

  it('inlines paragraph spacing', () => {
    expect(convert('Hello', margin)).toMatch(/^<p style="margin:0 0 12px 0;/);
  });

  it('removes paragraph spacing inside loose list items', () => {
    const html = convert('- one\n\n- two', margin);
    expect(html).toContain('<li style="margin:0 0 4px 0;line-height:1.5;"><p style="margin:0;line-height:1.5;">one</p></li>');
  });
});

describe('code blocks', () => {
  it('keeps each line and its indentation', () => {
    const html = strip(convert('```js\nif (x) {\n  run();\n}\n```'));
    expect(html).toBe('<div>if (x) {<br>&nbsp;&nbsp;run();<br>}</div>');
  });

  it('keeps runs of spaces but leaves single spaces breakable so long lines wrap', () => {
    expect(strip(convert('```\na  =   b c\n```'))).toBe('<div>a &nbsp;= &nbsp;&nbsp;b c</div>');
  });

  it('does not pad blank lines inside fenced code', () => {
    expect(preserveBlankLines('```\na\n\n\n\nb\n```')).toBe('```\na\n\n\n\nb\n```');
  });

  it('keeps empty lines inside code visible', () => {
    expect(strip(convert('```\na\n\nb\n```'))).toBe('<div>a<br>&nbsp;<br>b</div>');
  });
});

describe('formatting', () => {
  it('renders GFM tables, strikethrough and task lists', () => {
    const html = strip(convert('~~old~~\n\n- [x] done\n- [ ] todo\n\n| a |\n|---|\n| 1 |'));
    expect(html).toContain('<del>old</del>');
    expect(html).toContain('<li>☑ done</li><li>☐ todo</li>');
    expect(html).toContain('<table><thead><tr><th>a</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>');
  });

  it('strips scripts and event handlers', () => {
    const html = convert('<img src=x onerror="alert(1)"><script>alert(2)</script>');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script');
  });
});
