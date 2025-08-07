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

      // Look for ResponsiveContainer or Recharts chart components
      const chartContainer = containerRef.current.querySelector('[data-testid="transaction-chart"]') || 
                           containerRef.current.querySelector('.recharts-wrapper') ||
                           containerRef.current;

      // Find all SVG elements within the chart container
      const svgElements = chartContainer.querySelectorAll('svg');
      console.log(`Found ${svgElements.length} SVG elements in ${chartName} container`);
      
      if (svgElements.length === 0) {
        console.log(`No SVGs found in ${chartName} container at all`);
        return null;
      }

      // Find the largest/main SVG (usually the chart itself)
      let mainSvg = svgElements[0] as SVGElement;
      let maxArea = 0;
      
      svgElements.forEach(svg => {
        const rect = (svg as SVGElement).getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > maxArea) {
          maxArea = area;
          mainSvg = svg as SVGElement;
        }
      });

      console.log(`Using main SVG for ${chartName}, dimensions:`, {
        width: mainSvg.clientWidth,
        height: mainSvg.clientHeight,
        viewBox: mainSvg.getAttribute('viewBox'),
        bbox: mainSvg.getBoundingClientRect()
      });
      
      // Use high resolution for text readability, then compress
      const enhancedOptions = {
        ...options,
        width: Math.max(1000, mainSvg.clientWidth || 800),  // High resolution for text
        height: Math.max(700, mainSvg.clientHeight || 600), // High resolution for text
        format: 'png' as const,
        quality: 90  // High quality for text readability
      };
      
      return await this.renderSVGElementToPNG(mainSvg, enhancedOptions);

    } catch (error) {
      console.warn(`Server-side rendering failed for ${chartName}, falling back to Canvg:`, error);
      
      // Fallback to original Canvg method
      return this.fallbackCanvgCapture(containerRef, chartName);
    }
  }

  // Fallback Canvg method with enhanced chart element detection
  private static async fallbackCanvgCapture(
    containerRef: React.RefObject<HTMLDivElement>,
    chartName: string
  ): Promise<string | null> {
    try {
      const { Canvg } = await import('canvg');
      
      if (!containerRef.current) return null;
      
      // Look for ResponsiveContainer or main chart SVG
      const chartContainer = containerRef.current.querySelector('[data-testid="transaction-chart"]') || 
                           containerRef.current.querySelector('.recharts-wrapper') ||
                           containerRef.current;
      
      const svgElements = chartContainer.querySelectorAll('svg');
      if (svgElements.length === 0) return null;

      // Find the largest SVG (main chart)
      let mainSvg = svgElements[0] as SVGElement;
      let maxArea = 0;
      
      svgElements.forEach(svg => {
        const rect = (svg as SVGElement).getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > maxArea) {
          maxArea = area;
          mainSvg = svg as SVGElement;
        }
      });

      console.log(`Fallback: Found main SVG for ${chartName}:`, {
        width: mainSvg.clientWidth,
        height: mainSvg.clientHeight,
        elements: mainSvg.children.length
      });

      const svgData = new XMLSerializer().serializeToString(mainSvg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return null;

      // Use high resolution for text readability with 2x scaling
      const svgWidth = Math.max(1000, mainSvg.clientWidth || 800);
      const svgHeight = Math.max(700, mainSvg.clientHeight || 600);
      canvas.width = svgWidth * 1.5; // Scale up for crisp text
      canvas.height = svgHeight * 1.5;
      
      // Scale context for high-resolution rendering
      ctx.scale(1.5, 1.5);

      const canvgInstance = Canvg.fromString(ctx, svgData);
      await canvgInstance.render();

      // Return high-resolution image with smart compression for PDF use
      // First get high quality PNG for text readability
      const highQualityPng = canvas.toDataURL('image/png', 0.95);
      
      // For PDF use, also create a compressed JPEG version to reduce file size
      // while maintaining text readability
      const compressedJpeg = canvas.toDataURL('image/jpeg', 0.85);
      
      // Return the JPEG version for smaller file sizes in PDFs
      return compressedJpeg;
    } catch (error) {
      console.error(`Fallback capture failed for ${chartName}:`, error);
      return null;
    }
  }
}

export default ClientSVGRenderer;