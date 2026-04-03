/**
 * Utility functions for image processing
 */

/**
 * Converts a base64 string to a Blob
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
}

/**
 * Converts an image URL to a base64 string
 */
export async function imageUrlToBase64(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Resizes an image and converts it to a compressed JPEG to stay within storage limits.
 * Always processes through canvas to ensure format conversion and quality compression.
 */
export async function resizeImage(input: string, maxWidth = 1280, maxHeight = 1280, quality = 0.8): Promise<string> {
  // If input is a URL, we need to fetch it first to avoid canvas tainting
  const base64 = input.startsWith('http') ? await imageUrlToBase64(input) : input;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // Enable CORS for the image
    img.src = base64;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height *= maxWidth / width;
          width = maxWidth;
        } else {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // Fill with white background (important for transparent PNGs converted to JPEG)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Always return as a compressed JPEG
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Failed to load image for resizing'));
  });
}
