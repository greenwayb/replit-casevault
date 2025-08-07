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
  // Render SVG element to PNG using server-side rendering with enhanced text support
  static async renderSVGElementToPNG(
    svgElement: SVGElement, 
    options: SVGRenderOptions = {}
  ): Promise<string> {
    // Get SVG content as string
    let svgContent = new XMLSerializer().serializeToString(svgElement);
    
    // Enhance SVG with font definitions for better text rendering
    if (!svgContent.includes('<defs>')) {
      svgContent = svgContent.replace('<svg', `<svg><defs><style type="text/css">
        text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; fill: #374151; }
        .recharts-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; fill: #374151; }
        .recharts-cartesian-axis-tick-value { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; fill: #6B7280; }
        .recharts-legend-item-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; fill: #374151; }
        .recharts-tooltip-wrapper { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      </style></defs><svg`);
    }
    
    // Count text elements for debugging
    const textCount = (svgContent.match(/<text/g) || []).length;
    console.log(`Enhanced SVG rendering: Found ${textCount} text elements`);
    
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
      
      // Use high resolution for readable charts - working configuration
      const enhancedOptions = {
        ...options,
        width: Math.max(800, mainSvg.clientWidth || 600),
        height: Math.max(600, mainSvg.clientHeight || 450),
        format: 'png' as const,
        quality: 90
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

      // Get the SVG data and ensure text elements are preserved
      let svgData = new XMLSerializer().serializeToString(mainSvg);
      
      // Add font definitions to ensure text is rendered properly
      if (!svgData.includes('<defs>')) {
        svgData = svgData.replace('<svg', `<svg><defs><style type="text/css">
          text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; fill: #374151; }
          .recharts-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; fill: #374151; }
          .recharts-cartesian-axis-tick-value { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; fill: #6B7280; }
          .recharts-legend-item-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; fill: #374151; }
        </style></defs><svg`);
      }
      
      console.log(`SVG data sample for ${chartName}:`, svgData.substring(0, 500));
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return null;

      // Use working high-resolution scaling for readable text
      const svgWidth = Math.max(800, mainSvg.clientWidth || 600);
      const svgHeight = Math.max(600, mainSvg.clientHeight || 450);
      canvas.width = svgWidth * 2; // 2x scaling for crisp text
      canvas.height = svgHeight * 2;
      
      // Scale context for high-resolution rendering
      ctx.scale(2, 2);
      
      // Set canvas text rendering properties for better quality
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Count text elements in SVG for debugging
      const textCount = (svgData.match(/<text/g) || []).length;
      console.log(`${chartName}: Found ${textCount} text elements in SVG`);

      const canvgInstance = Canvg.fromString(ctx, svgData, {
        ignoreMouse: true,
        ignoreAnimation: true,
        ignoreDimensions: false,
        ignoreClear: false,
        enableRedraw: false
      });
      await canvgInstance.render();

      // Return high-quality PNG for readable text (working version)
      return canvas.toDataURL('image/png', 0.9);
    } catch (error) {
      console.error(`Fallback capture failed for ${chartName}:`, error);
      return null;
    }
  }
}

export default ClientSVGRenderer;