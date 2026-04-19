const MAX_WIDTH = 1680;
const TARGET_BYTES = 800 * 1024;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to read "${file.name}"`));
    };
    image.src = url;
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to export image"));
      },
      "image/webp",
      quality
    );
  });
}

export async function optimizeImageUploads(files: FileList | File[]) {
  const nextFiles: File[] = [];

  for (const file of Array.from(files)) {
    if (!file.type.startsWith("image/") || file.type === "image/gif") {
      throw new Error(`"${file.name}" is not a supported still image.`);
    }

    const image = await loadImage(file);
    const scale = Math.min(1, MAX_WIDTH / image.width);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in this browser.");

    context.drawImage(image, 0, 0, width, height);

    let quality = 0.86;
    let blob = await canvasToBlob(canvas, quality);
    while (blob.size > TARGET_BYTES && quality > 0.52) {
      quality -= 0.08;
      blob = await canvasToBlob(canvas, quality);
    }

    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    nextFiles.push(new File([blob], name, { type: "image/webp" }));
  }

  return nextFiles;
}
