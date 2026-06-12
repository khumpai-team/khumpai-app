/**
 * Attachment helper for the composer. Reads a picked file and, for images,
 * downscales it to a small JPEG thumbnail (so it can live in sessionStorage
 * without blowing the quota). Non-images return no url — only the file name.
 */

export interface Attachment {
  url: string | null;
  isImage: boolean;
  name: string;
}

export async function readAttachment(file: File, max = 360): Promise<Attachment> {
  const isImage = file.type.startsWith('image/');
  if (!isImage) return { url: null, isImage: false, name: file.name };

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
    return { url: canvas.toDataURL('image/jpeg', 0.72), isImage: true, name: file.name };
  } catch {
    return { url: dataUrl, isImage: true, name: file.name };
  }
}
