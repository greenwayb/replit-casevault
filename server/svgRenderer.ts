import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

export class SVGRenderer {
  private static browser: any = null;

  // Initialize browser instance (reuse across requests)
  private static async getBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-sync',
          '--single-process', // Try single process mode for Replit
          '--no-zygote'
        ],
        timeout: 10000,
        protocolTimeout: 10000
      });
    }
    return this.browser;
  }

  // Render SVG to high-quality PNG
  static async renderSVGToPNG(svgContent: string, options: {
    width?: number;
    height?: number;
    scale?: number;
  } = {}): Promise<Buffer> {
    const { width = 800, height = 600, scale = 2 } = options;
    
    let browser;
    let page;
    
    try {
      browser = await this.getBrowser();
      page = await browser.newPage();
      
      // Set shorter timeouts for Replit environment
      await page.setDefaultTimeout(5000);
      await page.setDefaultNavigationTimeout(5000);
      
      await page.setViewport({ 
        width: width * scale, 
        height: height * scale,
        deviceScaleFactor: scale
      });

      // Create a complete HTML page with the SVG and enhanced text rendering
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              background: white; 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }
            svg { 
              max-width: 100%; 
              height: auto; 
              display: block; 
              font-family: inherit;
            }
            svg text {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif !important;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              text-rendering: optimizeLegibility;
              fill: #374151 !important;
              font-size: 12px !important;
              visibility: visible !important;
              opacity: 1 !important;
            }
            .recharts-text {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif !important;
              fill: #374151 !important;
              font-size: 12px !important;
              visibility: visible !important;
              opacity: 1 !important;
            }
            .recharts-cartesian-axis-tick-value {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif !important;
              fill: #6B7280 !important;
              font-size: 11px !important;
              visibility: visible !important;
              opacity: 1 !important;
            }
            .recharts-legend-item-text {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif !important;
              fill: #374151 !important;
              font-size: 14px !important;
              visibility: visible !important;
              opacity: 1 !important;
            }
            .recharts-layer text {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif !important;
              fill: #374151 !important;
              font-size: 12px !important;
              visibility: visible !important;
              opacity: 1 !important;
            }
          </style>
        </head>
        <body>
          ${svgContent}
        </body>
        </html>
      `;

      await page.setContent(html, { 
        waitUntil: 'networkidle0',  // Wait for network to be idle
        timeout: 8000 
      });
      
      // Wait for SVG elements to fully render
      await page.waitForTimeout(1500);
      
      // Ensure fonts are loaded
      await page.evaluate(() => {
        return document.fonts.ready;
      });
      
      // Take high-quality screenshot of the SVG
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: true,
        omitBackground: false,
        captureBeyondViewport: false,
        encoding: 'binary'
      });

      return screenshot as Buffer;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Puppeteer rendering failed:', errorMessage);
      throw new Error(`Puppeteer rendering failed: ${errorMessage}`);
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.warn('Error closing page:', errorMessage);
        }
      }
    }
  }

  // Render React chart components to SVG then PNG
  static async renderChartToPNG(chartData: any, chartType: 'sankey' | 'line', options: {
    width?: number;
    height?: number;
    scale?: number;
  } = {}): Promise<Buffer> {
    const { width = 800, height = 600, scale = 2 } = options;
    
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    
    try {
      await page.setViewport({ 
        width: width * scale, 
        height: height * scale,
        deviceScaleFactor: scale
      });

      // Create HTML page with Recharts rendering
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
          <script src="https://unpkg.com/recharts@2.8.0/lib/index.js"></script>
          <style>
            body { margin: 0; padding: 20px; background: white; font-family: Arial, sans-serif; }
            .chart-container { width: ${width}px; height: ${height}px; }
          </style>
        </head>
        <body>
          <div id="chart-container" class="chart-container"></div>
          <script>
            const { ResponsiveContainer, Sankey, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Line } = Recharts;
            const chartData = ${JSON.stringify(chartData)};
            
            function renderChart() {
              if ('${chartType}' === 'sankey') {
                return React.createElement(ResponsiveContainer, { width: '100%', height: '100%' },
                  React.createElement(Sankey, {
                    data: chartData,
                    nodeWidth: 20,
                    nodePadding: 50,
                    margin: { top: 20, right: 20, bottom: 20, left: 20 }
                  })
                );
              } else {
                return React.createElement(ResponsiveContainer, { width: '100%', height: '100%' },
                  React.createElement(LineChart, { data: chartData },
                    React.createElement(CartesianGrid, { strokeDasharray: '3 3' }),
                    React.createElement(XAxis, { dataKey: 'date' }),
                    React.createElement(YAxis),
                    React.createElement(Tooltip),
                    React.createElement(Line, { type: 'monotone', dataKey: 'balance', stroke: '#2563eb' })
                  )
                );
              }
            }
            
            const chartElement = React.createElement('div', { style: { width: '100%', height: '100%' } }, renderChart());
            ReactDOM.render(chartElement, document.getElementById('chart-container'));
          </script>
        </body>
        </html>
      `;

      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Wait for chart to render
      await page.waitForTimeout(2000);
      
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: true,
        omitBackground: false
      });

      return screenshot as Buffer;
    } finally {
      await page.close();
    }
  }

  // Optimize PNG with Sharp
  static async optimizePNG(pngBuffer: Buffer, options: {
    quality?: number;
    format?: 'png' | 'jpeg' | 'webp';
  } = {}): Promise<Buffer> {
    const { quality = 90, format = 'png' } = options;
    
    let processor = sharp(pngBuffer);
    
    if (format === 'jpeg') {
      processor = processor.jpeg({ quality });
    } else if (format === 'webp') {
      processor = processor.webp({ quality });
    } else {
      processor = processor.png({ compressionLevel: 9 });
    }
    
    return await processor.toBuffer();
  }

  // Clean up browser instance
  static async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Graceful shutdown
process.on('SIGINT', () => SVGRenderer.cleanup());
process.on('SIGTERM', () => SVGRenderer.cleanup());