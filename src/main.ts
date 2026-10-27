import './styles.css';
import { convert, defaultOptions, type ConvertOptions } from './convert';
import { copyRichText } from './clipboard';
import { SAMPLE } from './sample';
import { ACCEPT, readMarkdownFile } from './files';

const STORAGE_KEY = 'md2rich:v1';

const input = document.querySelector<HTMLTextAreaElement>('#markdown')!;
const preview = document.querySelector<HTMLDivElement>('#preview')!;
const empty = document.querySelector<HTMLDivElement>('#empty')!;
const copyButton = document.querySelector<HTMLButtonElement>('#copy')!;
const status = document.querySelector<HTMLSpanElement>('#status')!;
const lineBreaks = document.querySelector<HTMLInputElement>('#opt-line-breaks')!;
const keepBlankLines = document.querySelector<HTMLInputElement>('#opt-blank-lines')!;

interface Saved {
  markdown: string;
  options: ConvertOptions;
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ markdown: input.value, options: currentOptions() }));
  } catch {
    // Storage unavailable (private mode, blocked site data); the draft just won't persist.
  }
}

function currentOptions(): ConvertOptions {
  return {
    lineBreaks: lineBreaks.checked,
    keepBlankLines: keepBlankLines.checked,
    // Real empty lines between paragraphs paste correctly everywhere, including
    // Slack, which ignores margins.
    spacing: 'blank-line',
  };
}

/**
 * Plain text for targets that only take text/plain. Rendered from the margin
 * layout so paragraphs get exactly one blank line; innerText needs the element
 * in the document to compute line breaks.
 */
function plainText(): string {
  const scratch = document.createElement('div');
  scratch.style.cssText = 'position:absolute;left:-10000px;top:0;width:800px;';
  scratch.innerHTML = convert(input.value, { ...currentOptions(), spacing: 'margin' });
  document.body.appendChild(scratch);
  const text = scratch.innerText.trim();
  scratch.remove();
  return text;
}

function render() {
  const hasContent = input.value.trim() !== '';
  preview.innerHTML = hasContent ? convert(input.value, currentOptions()) : '';
  empty.hidden = hasContent;
  copyButton.disabled = !hasContent;
  save();
}

let statusTimer: number | undefined;
function flash(message: string, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => (status.textContent = ''), 2500);
}

copyButton.addEventListener('click', async () => {
  try {
    // The preview is the clipboard HTML, so what you see is what you paste.
    await copyRichText(preview.innerHTML, plainText());
    flash('Copied — paste into Slack, Docs, Word, Gmail…');
  } catch (error) {
    console.error(error);
    flash('Copy failed. Select the preview and press ⌘C / Ctrl+C.', true);
  }
});

async function openFile(file: File) {
  try {
    input.value = await readMarkdownFile(file);
    render();
    flash(`Opened ${file.name}`);
  } catch (error) {
    flash(error instanceof Error ? error.message : 'Could not open that file.', true);
  }
}

const fileInput = document.querySelector<HTMLInputElement>('#file')!;
fileInput.accept = ACCEPT;
document.querySelector('#open-file')!.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) openFile(file);
  fileInput.value = ''; // Let the same file be chosen again.
});

// Drag a file onto the Markdown pane to open it. Dragged text still drops into
// the textarea normally; only file drags are intercepted.
const inputPane = document.querySelector<HTMLElement>('#input-pane')!;
const isFileDrag = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;
let dragDepth = 0;

inputPane.addEventListener('dragenter', (event) => {
  if (!isFileDrag(event)) return;
  dragDepth++;
  inputPane.classList.add('dropping');
});
inputPane.addEventListener('dragleave', (event) => {
  if (!isFileDrag(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) inputPane.classList.remove('dropping');
});
inputPane.addEventListener('drop', (event) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  dragDepth = 0;
  inputPane.classList.remove('dropping');
  const file = event.dataTransfer?.files[0];
  if (file) openFile(file);
});

// Without this, a file dropped anywhere else makes the browser open it and
// navigate away from the page, losing the draft.
window.addEventListener('dragover', (event) => {
  if (isFileDrag(event)) event.preventDefault();
});
window.addEventListener('drop', (event) => {
  if (isFileDrag(event)) event.preventDefault();
});

document.querySelector('#sample')!.addEventListener('click', () => {
  input.value = SAMPLE;
  render();
});

document.querySelector('#clear')!.addEventListener('click', () => {
  input.value = '';
  render();
  input.focus();
});

input.addEventListener('input', render);
lineBreaks.addEventListener('change', render);
keepBlankLines.addEventListener('change', render);

const saved = load();
const options = { ...defaultOptions, ...saved?.options };
lineBreaks.checked = options.lineBreaks;
keepBlankLines.checked = options.keepBlankLines;
input.value = saved?.markdown ?? '';
render();
