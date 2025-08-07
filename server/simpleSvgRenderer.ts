import sharp from 'sharp';
import { createCanvas, loadImage } from '@napi-rs/canvas';

export class SimpleSVGRenderer {
  /**
   * Simple SVG to PNG conversion using Canvas
   * More reliable than Puppeteer in containerized environments
   */
  static async renderSVGToPNG(svgContent: string, options: {
    width?: number;
    height?: number;
    scale?: number;
  } = {}): Promise<Buffer> {
    const { width = 800, height = 600, scale = 2 } = options;
    
    try {
      // Create a data URL from SVG content
      const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
      
      // Create canvas
      const canvas = createCanvas(width * scale, height * scale);
      const ctx = canvas.getContext('2d');
      
      // Set white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width * scale, height * scale);
      
      // Load and draw SVG
      const img = await loadImage(svgDataUrl);
      ctx.drawImage(img, 0, 0, width * scale, height * scale);
      
      // Convert to PNG buffer
      const buffer = canvas.toBuffer('image/png');
      
      // Optimize with Sharp
      return await sharp(buffer)
        .png({ compressionLevel: 9 })
        .toBuffer();
        
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Canvas SVG rendering failed:', errorMessage);
      throw new Error(`Canvas rendering failed: ${errorMessage}`);
    }
  }

  /**
   * Fallback method using Sharp directly for simple SVGs
   */
  static async renderSVGToBuffer(svgContent: string, options: {
    width?: number;
    height?: number;
  } = {}): Promise<Buffer> {
    const { width = 800, height = 600 } = options;
    
    try {
      return await sharp(Buffer.from(svgContent))
        .resize(width, height)
        .png()
        .toBuffer();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Sharp SVG rendering failed:', errorMessage);
      throw new Error(`Sharp rendering failed: ${errorMessage}`);
    }
  }
}