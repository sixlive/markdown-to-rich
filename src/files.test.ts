import { describe, expect, it } from 'vitest';
import { isMarkdownFile, readMarkdownFile } from './files';

describe('isMarkdownFile', () => {
  it('accepts Markdown and text extensions regardless of reported type', () => {
    expect(isMarkdownFile({ name: 'notes.md', type: '' })).toBe(true);
    expect(isMarkdownFile({ name: 'README.MARKDOWN', type: 'application/octet-stream' })).toBe(true);
    expect(isMarkdownFile({ name: 'draft.txt', type: 'text/plain' })).toBe(true);
  });

  it('accepts a Markdown MIME type without a known extension', () => {
    expect(isMarkdownFile({ name: 'notes', type: 'text/markdown' })).toBe(true);
  });

  it('rejects other files', () => {
    expect(isMarkdownFile({ name: 'photo.png', type: 'image/png' })).toBe(false);
    expect(isMarkdownFile({ name: 'report.docx', type: '' })).toBe(false);
  });
});

describe('readMarkdownFile', () => {
  it('returns the file contents', async () => {
    const file = new File(['# Hello\nWorld'], 'hello.md', { type: '' });
    expect(await readMarkdownFile(file)).toBe('# Hello\nWorld');
  });

  it('refuses non-Markdown files', async () => {
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    await expect(readMarkdownFile(file)).rejects.toThrow("photo.png isn't a Markdown or text file.");
  });

  it('refuses files over 5 MB', async () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.md');
    await expect(readMarkdownFile(file)).rejects.toThrow('big.md is larger than 5 MB.');
  });
});
