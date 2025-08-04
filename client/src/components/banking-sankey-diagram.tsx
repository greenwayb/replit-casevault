import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";

interface SankeyNode {
  id: string;
  name: string;
  value: number;
  type: 'source' | 'target' | 'intermediate';
  color?: string;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
  type: 'inflow' | 'outflow';
}

interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  totalInflows: number;
  totalOutflows: number;
  netFlow: number;
}

interface BankingSankeyDiagramProps {
  xmlData?: string;
  documentName: string;
  accountName?: string;
}

export default function BankingSankeyDiagram({ xmlData, documentName, accountName }: BankingSankeyDiagramProps) {
  const [sankeyData, setSankeyData] = useState<SankeyData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!xmlData) return;

    setLoading(true);
    try {
      parseXMLToSankey(xmlData);
    } catch (error) {
      console.error('Error parsing XML for Sankey diagram:', error);
    } finally {
      setLoading(false);
    }
  }, [xmlData]);

  const parseXMLToSankey = (xml: string) => {
    try {
      // Parse XML string (simple approach for now)
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      
      const nodes: SankeyNode[] = [];
      const links: SankeyLink[] = [];
      
      // Add central account node
      const accountNode: SankeyNode = {
        id: 'account',
        name: accountName || 'Bank Account',
        value: 0,
        type: 'intermediate',
        color: '#3b82f6'
      };
      nodes.push(accountNode);

      let totalInflows = 0;
      let totalOutflows = 0;

      // Parse inflows
      const inflowsNode = doc.querySelector('inflows');
      if (inflowsNode) {
        const fromNodes = inflowsNode.querySelectorAll('from');
        fromNodes.forEach((fromNode, index) => {
          const target = fromNode.querySelector('target')?.textContent || `Inflow ${index + 1}`;
          const amount = parseFloat(fromNode.querySelector('total_amount')?.textContent || '0');
          
          if (amount > 0) {
            const sourceId = `inflow_${index}`;
            nodes.push({
              id: sourceId,
              name: target,
              value: amount,
              type: 'source',
              color: '#10b981'
            });
            
            links.push({
              source: sourceId,
              target: 'account',
              value: amount,
              type: 'inflow'
            });
            
            totalInflows += amount;
          }
        });
      }

      // Parse outflows
      const outflowsNode = doc.querySelector('outflows');
      if (outflowsNode) {
        const toNodes = outflowsNode.querySelectorAll('to');
        toNodes.forEach((toNode, index) => {
          const target = toNode.querySelector('target')?.textContent || `Outflow ${index + 1}`;
          const amount = parseFloat(toNode.querySelector('total_amount')?.textContent || '0');
          
          if (amount > 0) {
            const targetId = `outflow_${index}`;
            nodes.push({
              id: targetId,
              name: target,
              value: amount,
              type: 'target',
              color: '#ef4444'
            });
            
            links.push({
              source: 'account',
              target: targetId,
              value: amount,
              type: 'outflow'
            });
            
            totalOutflows += amount;
          }
        });
      }

      const netFlow = totalInflows - totalOutflows;
      accountNode.value = Math.max(totalInflows, totalOutflows);

      setSankeyData({
        nodes,
        links,
        totalInflows,
        totalOutflows,
        netFlow
      });

    } catch (error) {
      console.error('Error parsing XML:', error);
      setSankeyData(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(Math.abs(amount));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Flow Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Analyzing transaction flows...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sankeyData || sankeyData.nodes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Flow Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">No transaction flow data available</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...sankeyData.nodes.map(n => n.value));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Transaction Flow Analysis
          <span className="text-sm font-normal text-muted-foreground">- {documentName}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Total Inflows</span>
            </div>
            <div className="text-xl font-bold text-green-700 dark:text-green-300">
              {formatCurrency(sankeyData.totalInflows)}
            </div>
          </div>
          <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400 mb-1">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm font-medium">Total Outflows</span>
            </div>
            <div className="text-xl font-bold text-red-700 dark:text-red-300">
              {formatCurrency(sankeyData.totalOutflows)}
            </div>
          </div>
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 mb-1">
              <ArrowRight className="h-4 w-4" />
              <span className="text-sm font-medium">Net Flow</span>
            </div>
            <div className={`text-xl font-bold ${sankeyData.netFlow >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {sankeyData.netFlow >= 0 ? '+' : ''}{formatCurrency(sankeyData.netFlow)}
            </div>
          </div>
        </div>

        {/* Simplified Sankey Visualization */}
        <div className="space-y-6">
          {/* Inflows */}
          <div>
            <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-3">Money Coming In</h4>
            <div className="space-y-2">
              {sankeyData.nodes.filter(n => n.type === 'source').map((node) => (
                <div key={node.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">{node.name}</span>
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                        {formatCurrency(node.value)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(node.value / maxValue) * 100}%` }}
                      />
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-green-500" />
                  <div className="w-12 h-8 bg-blue-100 dark:bg-blue-900 rounded border-2 border-blue-300 dark:border-blue-700 flex items-center justify-center">
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Account</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Outflows */}
          <div>
            <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-3">Money Going Out</h4>
            <div className="space-y-2">
              {sankeyData.nodes.filter(n => n.type === 'target').map((node) => (
                <div key={node.id} className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-blue-100 dark:bg-blue-900 rounded border-2 border-blue-300 dark:border-blue-700 flex items-center justify-center">
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Account</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-red-500" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">{node.name}</span>
                      <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                        {formatCurrency(node.value)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(node.value / maxValue) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}