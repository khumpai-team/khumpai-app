import { readFile } from 'node:fs/promises';
import { extractText, getDocumentProxy } from 'unpdf';

export interface ExtractResult {
  text: string;
  charCount: number;
}

/** Read a PDF and return its merged text (whitespace collapsed). */
export async function extractPdf(path: string): Promise<ExtractResult> {
  const buf = await readFile(path);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  const merged = (Array.isArray(text) ? text.join('\n') : text)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text: merged, charCount: merged.length };
}
