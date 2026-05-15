import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const compressImageToDataUrl = async (
  file: File,
  maxSizeMB: number = 0.15,
  maxWidth: number = 1000,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(event.target?.result as string); // fallback
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // try to compress
        let quality = 0.9;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);

        // roughly estimate base64 size limit based on maxSizeMB
        const maxBase64Size = maxSizeMB * 1024 * 1024 * 1.34;

        while (dataUrl.length > maxBase64Size && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }

        resolve(dataUrl);
      };
      img.onerror = () =>
        reject(new Error("Failed to load image for compression"));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
  });
};

export const compressImageToFile = async (
  file: File,
  maxSizeMB: number = 0.15,
  maxWidth: number = 1000,
): Promise<File> => {
  const dataUrl = await compressImageToDataUrl(file, maxSizeMB, maxWidth);

  // Convert base64 to Blob
  const parts = dataUrl.split(";");
  const mime = parts[0].split(":")[1];
  const bstr = atob(parts[1].split(",")[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  // Create File from Blob
  return new File([u8arr], file.name || "image.jpg", { type: mime });
};
