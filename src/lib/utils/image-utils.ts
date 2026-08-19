import imageCompression from "browser-image-compression";

/**
 * Smart compression utility
 * If file > 1MB, compress to ~1MB. Else passthrough.
 */
export async function compressImage(file: File): Promise<File | Blob> {
  const sizeInMB = file.size / 1024 / 1024;
  
  if (sizeInMB <= 1) {
    return file;
  }

  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    initialQuality: 0.8,
  };

  try {
    return await imageCompression(file, options);
  } catch (error) {
    console.error("Compression failed:", error);
    return file;
  }
}

/**
 * Crop helper for react-easy-crop
 * Generates a Blob from canvas coordinates.
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // When the crop is zoomed out past the image edge, the extra area would be
  // transparent → black in JPEG. Fill white so the padding stays clean.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, "image/jpeg", 0.9);
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}
