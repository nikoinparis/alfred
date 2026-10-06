/**
 * Resize and re-encode a photo before upload. Phone photos are 3–12 MB; a 1024 px JPEG
 * is ~150–300 KB, which keeps the vision call cheap (~1.5k input tokens) and fast on mobile data.
 */
export async function compressImage(
  file: File,
  maxSide = 1024,
  quality = 0.8,
): Promise<{ base64: string; dataUrl: string; bytes: number }> {
  const bitmap = await createImageBitmap(file).catch(async () => {
    // Older Safari: fall back to an <img> decode.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  });
  const w = "naturalWidth" in bitmap ? bitmap.naturalWidth : bitmap.width;
  const h = "naturalHeight" in bitmap ? bitmap.naturalHeight : bitmap.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if ("close" in bitmap) bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return { base64, dataUrl, bytes: Math.round((base64.length * 3) / 4) };
}
