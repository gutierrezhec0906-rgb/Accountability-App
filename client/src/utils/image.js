// Shared image helpers. Phone photos are often 3–8 MB, which stalls uploads on
// mobile networks and bloats in-memory previews. Compress in the browser BEFORE
// uploading or previewing.

// Downscale + re-encode an image File to a JPEG. Returns { blob, preview } where
// preview is a data URL. Throws if the browser can't decode the image (e.g. some
// HEIC) so callers can fall back to the original file.
export function compressImage(file, maxDim = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          blob => blob ? resolve({ blob, preview: canvas.toDataURL('image/jpeg', quality) }) : reject(new Error('toBlob failed')),
          'image/jpeg',
          quality,
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Reject a promise that stalls, so upload UIs never stick on "Saving…" forever.
export function withTimeout(promise, ms, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out`)), ms)),
  ]);
}
