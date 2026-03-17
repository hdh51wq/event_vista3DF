export async function applyLogoToFurniture(
  furnitureImageSrc: string,
  logoSrc: string,
  options: {
    x: number; // pixel position X on canvas
    y: number; // pixel position Y on canvas
    sizePercent: number; // 0.10 to 0.40
    opacity: number; // 0.5 to 1.0
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const furniture = new Image();
    furniture.crossOrigin = "anonymous";
    furniture.onload = () => {
      canvas.width = furniture.naturalWidth;
      canvas.height = furniture.naturalHeight;
      ctx.drawImage(furniture, 0, 0);
      const logo = new Image();
      logo.onload = () => {
        const logoW = canvas.width * options.sizePercent;
        const logoH = (logo.naturalHeight / logo.naturalWidth) * logoW;
        ctx.globalAlpha = options.opacity;
        ctx.drawImage(logo, options.x, options.y, logoW, logoH);
        ctx.globalAlpha = 1;
        resolve(canvas.toDataURL("image/png"));
      };
      logo.onerror = reject;
      logo.src = logoSrc;
    };
    furniture.onerror = reject;
    furniture.src = furnitureImageSrc;
  });
}

