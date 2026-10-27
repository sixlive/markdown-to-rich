export const ACCEPTED_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.txt'];
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Value for the file input's accept attribute. */
export const ACCEPT = [...ACCEPTED_EXTENSIONS, 'text/markdown', 'text/plain'].join(',');

export function isMarkdownFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = file.name.toLowerCase();
  // Browsers often report .md files with an empty or generic type, so trust the extension first.
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext)) || file.type === 'text/markdown' || file.type === 'text/plain';
}

/** Read a dropped or chosen file locally. Nothing is sent anywhere. */
export async function readMarkdownFile(file: File): Promise<string> {
  if (!isMarkdownFile(file)) throw new Error(`${file.name} isn't a Markdown or text file.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 5 MB.`);
  return file.text();
}
