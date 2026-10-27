/**
 * Put rich HTML and a plain-text fallback on the clipboard as separate formats.
 *
 * We never copy a DOM selection: browsers serialize selections with computed
 * styles and source whitespace, which is where pasted line breaks go wrong.
 */
export async function copyRichText(html: string, plainText: string): Promise<void> {
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        }),
      ]);
      return;
    } catch {
      // Fall through: some browsers reject the async API outside secure contexts.
    }
  }

  const onCopy = (event: ClipboardEvent) => {
    event.clipboardData?.setData('text/html', html);
    event.clipboardData?.setData('text/plain', plainText);
    event.preventDefault();
  };
  document.addEventListener('copy', onCopy);
  try {
    if (!document.execCommand('copy')) throw new Error('Copy command was rejected');
  } finally {
    document.removeEventListener('copy', onCopy);
  }
}
