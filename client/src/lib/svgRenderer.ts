// Client-side utility for server-side SVG rendering
import { apiRequest } from './queryClient';

export interface SVGRenderOptions {
  width?: number;
  height?: number;
  scale?: number;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
}

export class ClientSVGRenderer {
  // Render SVG element to PNG using server-side rendering
  static async renderSVGElementToPNG(
    svgElement: SVGElement, 
    options: SVGRenderOptions = {}
  ): Promise<string> {
    // Get SVG content as string
    const svgContent = new XMLSerializer().serializeToString(svgElement);
    
    // Extract dimensions from SVG if not provided
    const width = options.width || svgElement.clientWidth || 800;
    const height = options.height || svgElement.clientHeight || 600;
    
    return this.renderSVGContentToPNG(svgContent, { ...options, width, height });
  }

  // Render SVG string to PNG using server-side rendering
  static async renderSVGContentToPNG(
    svgContent: string, 
    options: SVGRenderOptions = {}
  ): Promise<string> {
    const response = await fetch('/api/render/svg-to-png', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        svgContent,
        ...options
      }),
    });

    if (!response.ok) {
      throw new Error(`SVG rendering failed: ${response.statusText}`);
    }

    // Convert response to base64 data URL
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const bytes = Array.from(uint8Array);
    const base64 = btoa(String.fromCharCode.apply(null, bytes));
    return `data:image/png;base64,${base64}`;
  }

  // Render chart data to PNG using server-side rendering
  static async renderChartToPNG(
    chartData: any,
    chartType: 'sankey' | 'line',
    options: SVGRenderOptions = {}
  ): Promise<string> {
    const response = await fetch('/api/render/svg-to-png', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chartData,
        chartType,
        ...options
      }),
    });

    if (!response.ok) {
      throw new Error(`Chart rendering failed: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const bytes = Array.from(uint8Array);
    const base64 = btoa(String.fromCharCode.apply(null, bytes));
    return `data:image/png;base64,${base64}`;
  }

  // Enhanced chart capture with fallback to Canvg
  static async captureChart(
    containerRef: React.RefObject<HTMLDivElement>,
    chartName: string,
    options: SVGRenderOptions = {}
  ): Promise<string | null> {
    try {
      console.log(`Starting ${chartName} capture with server-side rendering...`);
      
      if (!containerRef.current) {
        console.log(`No ${chartName} container ref available`);
        return null;
      }

      // Wait a moment for chart to fully render
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Find SVG element within the container
      const svgElement = containerRef.current.querySelector('svg');
      if (!svgElement) {
        console.log(`No SVG found in ${chartName} container, checking for nested SVGs...`);
        
        // Check for nested containers or Recharts components
        const allSvgs = containerRef.current.querySelectorAll('svg');
        console.log(`Found ${allSvgs.length} SVG elements in container`);
        
        if (allSvgs.length === 0) {
          console.log(`No SVGs found in ${chartName} container at all`);
          return null;
        }
        
        // Use the first/largest SVG found
        const targetSvg = allSvgs[0] as SVGElement;
        return await this.renderSVGElementToPNG(targetSvg, options);
      }

      console.log(`Found SVG for ${chartName}, dimensions:`, {
        width: svgElement.clientWidth,
        height: svgElement.clientHeight,
        viewBox: svgElement.getAttribute('viewBox')
      });
      
      return await this.renderSVGElementToPNG(svgElement, options);

    } catch (error) {
      console.warn(`Server-side rendering failed for ${chartName}, falling back to Canvg:`, error);
      
      // Fallback to original Canvg method
      return this.fallbackCanvgCapture(containerRef, chartName);
    }
  }

  // Fallback Canvg method (existing implementation)
  private static async fallbackCanvgCapture(
    containerRef: React.RefObject<HTMLDivElement>,
    chartName: string
  ): Promise<string | null> {
    try {
      const { Canvg } = await import('canvg');
      
      if (!containerRef.current) return null;
      
      const svgElement = containerRef.current.querySelector('svg');
      if (!svgElement) return null;

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return null;

      const svgWidth = svgElement.clientWidth || 800;
      const svgHeight = svgElement.clientHeight || 400;
      canvas.width = svgWidth;
      canvas.height = svgHeight;

      const canvgInstance = Canvg.fromString(ctx, svgData);
      await canvgInstance.render();

      return canvas.toDataURL('image/png', 0.9);
    } catch (error) {
      console.error(`Fallback capture failed for ${chartName}:`, error);
      return null;
    }
  }
}

export default ClientSVGRenderer;