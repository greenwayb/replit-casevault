import { jsPDF } from 'jspdf';
import fs from 'fs/promises';

export class VectorSVGRenderer {
  /**
   * Convert SVG to vector graphics in PDF (best quality, smallest file size)
   * This preserves SVG as vector graphics instead of rasterizing to PNG
   */
  static async renderSVGToVectorPDF(svgContent: string, options: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  } = {}): Promise<jsPDF> {
    const { x = 10, y = 10, width = 180, height = 120 } = options;
    
    const doc = new jsPDF();
    
    try {
      // Parse SVG content to extract vector paths
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgElement = svgDoc.documentElement;
      
      // Get SVG dimensions
      const viewBox = svgElement.getAttribute('viewBox');
      let svgWidth = parseFloat(svgElement.getAttribute('width') || '100');
      let svgHeight = parseFloat(svgElement.getAttribute('height') || '100');
      
      if (viewBox) {
        const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number);
        svgWidth = vbWidth;
        svgHeight = vbHeight;
      }
      
      // Calculate scale to fit specified dimensions
      const scaleX = width / svgWidth;
      const scaleY = height / svgHeight;
      const scale = Math.min(scaleX, scaleY);
      
      // Process SVG elements
      this.processSVGElement(doc, svgElement, x, y, scale);
      
      return doc;
    } catch (error) {
      console.error('Error converting SVG to vector PDF:', error);
      throw error;
    }
  }
  
  private static processSVGElement(doc: jsPDF, element: Element, offsetX: number, offsetY: number, scale: number) {
    const tagName = element.tagName.toLowerCase();
    
    switch (tagName) {
      case 'path':
        this.renderPath(doc, element, offsetX, offsetY, scale);
        break;
      case 'rect':
        this.renderRect(doc, element, offsetX, offsetY, scale);
        break;
      case 'circle':
        this.renderCircle(doc, element, offsetX, offsetY, scale);
        break;
      case 'line':
        this.renderLine(doc, element, offsetX, offsetY, scale);
        break;
      case 'text':
        this.renderText(doc, element, offsetX, offsetY, scale);
        break;
      case 'g':
        // Process group children
        for (const child of Array.from(element.children)) {
          this.processSVGElement(doc, child, offsetX, offsetY, scale);
        }
        break;
    }
  }
  
  private static renderPath(doc: jsPDF, element: Element, offsetX: number, offsetY: number, scale: number) {
    const d = element.getAttribute('d');
    if (!d) return;
    
    const fill = element.getAttribute('fill');
    const stroke = element.getAttribute('stroke');
    const strokeWidth = parseFloat(element.getAttribute('stroke-width') || '1');
    
    // Set styles
    if (fill && fill !== 'none') {
      const color = this.parseColor(fill);
      if (color) doc.setFillColor(color.r, color.g, color.b);
    }
    
    if (stroke && stroke !== 'none') {
      const color = this.parseColor(stroke);
      if (color) doc.setDrawColor(color.r, color.g, color.b);
      doc.setLineWidth(strokeWidth * scale);
    }
    
    // Parse and draw path (simplified - would need full SVG path parser for production)
    // For now, we'll fall back to basic shapes
    this.drawSimplifiedPath(doc, d, offsetX, offsetY, scale);
  }
  
  private static renderRect(doc: jsPDF, element: Element, offsetX: number, offsetY: number, scale: number) {
    const x = parseFloat(element.getAttribute('x') || '0') * scale + offsetX;
    const y = parseFloat(element.getAttribute('y') || '0') * scale + offsetY;
    const width = parseFloat(element.getAttribute('width') || '0') * scale;
    const height = parseFloat(element.getAttribute('height') || '0') * scale;
    
    const fill = element.getAttribute('fill');
    const stroke = element.getAttribute('stroke');
    
    if (fill && fill !== 'none') {
      const color = this.parseColor(fill);
      if (color) {
        doc.setFillColor(color.r, color.g, color.b);
        doc.rect(x, y, width, height, 'F');
      }
    }
    
    if (stroke && stroke !== 'none') {
      const color = this.parseColor(stroke);
      if (color) {
        doc.setDrawColor(color.r, color.g, color.b);
        doc.rect(x, y, width, height, 'S');
      }
    }
  }
  
  private static renderCircle(doc: jsPDF, element: Element, offsetX: number, offsetY: number, scale: number) {
    const cx = parseFloat(element.getAttribute('cx') || '0') * scale + offsetX;
    const cy = parseFloat(element.getAttribute('cy') || '0') * scale + offsetY;
    const r = parseFloat(element.getAttribute('r') || '0') * scale;
    
    const fill = element.getAttribute('fill');
    const stroke = element.getAttribute('stroke');
    
    if (fill && fill !== 'none') {
      const color = this.parseColor(fill);
      if (color) {
        doc.setFillColor(color.r, color.g, color.b);
        doc.circle(cx, cy, r, 'F');
      }
    }
    
    if (stroke && stroke !== 'none') {
      const color = this.parseColor(stroke);
      if (color) {
        doc.setDrawColor(color.r, color.g, color.b);
        doc.circle(cx, cy, r, 'S');
      }
    }
  }
  
  private static renderLine(doc: jsPDF, element: Element, offsetX: number, offsetY: number, scale: number) {
    const x1 = parseFloat(element.getAttribute('x1') || '0') * scale + offsetX;
    const y1 = parseFloat(element.getAttribute('y1') || '0') * scale + offsetY;
    const x2 = parseFloat(element.getAttribute('x2') || '0') * scale + offsetX;
    const y2 = parseFloat(element.getAttribute('y2') || '0') * scale + offsetY;
    
    const stroke = element.getAttribute('stroke');
    const strokeWidth = parseFloat(element.getAttribute('stroke-width') || '1');
    
    if (stroke && stroke !== 'none') {
      const color = this.parseColor(stroke);
      if (color) {
        doc.setDrawColor(color.r, color.g, color.b);
        doc.setLineWidth(strokeWidth * scale);
        doc.line(x1, y1, x2, y2);
      }
    }
  }
  
  private static renderText(doc: jsPDF, element: Element, offsetX: number, offsetY: number, scale: number) {
    const x = parseFloat(element.getAttribute('x') || '0') * scale + offsetX;
    const y = parseFloat(element.getAttribute('y') || '0') * scale + offsetY;
    const text = element.textContent || '';
    
    const fill = element.getAttribute('fill');
    const fontSize = parseFloat(element.getAttribute('font-size') || '12') * scale;
    
    if (fill) {
      const color = this.parseColor(fill);
      if (color) doc.setTextColor(color.r, color.g, color.b);
    }
    
    doc.setFontSize(fontSize);
    doc.text(text, x, y);
  }
  
  private static drawSimplifiedPath(doc: jsPDF, d: string, offsetX: number, offsetY: number, scale: number) {
    // Simplified path drawing - just handle basic move/line commands
    // For production use, implement full SVG path parser
    const commands = d.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || [];
    
    let currentX = 0;
    let currentY = 0;
    
    for (const command of commands) {
      const type = command[0].toUpperCase();
      const coords = command.slice(1).trim().split(/[\s,]+/).map(Number);
      
      switch (type) {
        case 'M':
          currentX = coords[0] * scale + offsetX;
          currentY = coords[1] * scale + offsetY;
          break;
        case 'L':
          const lineX = coords[0] * scale + offsetX;
          const lineY = coords[1] * scale + offsetY;
          doc.line(currentX, currentY, lineX, lineY);
          currentX = lineX;
          currentY = lineY;
          break;
      }
    }
  }
  
  private static parseColor(colorString: string): { r: number; g: number; b: number } | null {
    if (colorString.startsWith('#')) {
      const hex = colorString.slice(1);
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16)
        };
      } else if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16)
        };
      }
    } else if (colorString.startsWith('rgb')) {
      const match = colorString.match(/\d+/g);
      if (match && match.length >= 3) {
        return {
          r: parseInt(match[0]),
          g: parseInt(match[1]),
          b: parseInt(match[2])
        };
      }
    }
    return null;
  }
}