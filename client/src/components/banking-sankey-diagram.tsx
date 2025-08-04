import React, { useState, useEffect } from "react";
import { Sankey, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";

// Custom Node Component
const CustomNode = (props: any) => {
  const { payload, x, y, width, height } = props;
  const isInflow = payload.name && payload.name.includes('Inflow') || payload.type === 'source';
  const isOutflow = payload.name && payload.name.includes('Outflow') || payload.type === 'target';
  const isAccount = payload.name && (payload.name.includes('Account') || payload.type === 'intermediate');

  let color = '#6b7280'; // default gray
  if (isInflow) color = '#10b981'; // green for inflows
  else if (isOutflow) color = '#ef4444'; // red for outflows  
  else if (isAccount) color = '#3b82f6'; // blue for account

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        rx={4}
        ry={4}
        stroke="#ffffff"
        strokeWidth={2}
      />
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={12}
        fontWeight={600}
        fill="#ffffff"
      >
        {payload.name && payload.name.length > 15 ? 
          payload.name.substring(0, 12) + '...' : 
          payload.name
        }
      </text>
    </g>
  );
};

// Custom Link Component
const CustomLink = (props: any) => {
  const { payload, sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX } = props;
  const isInflow = payload && payload.type === 'inflow';
  const color = isInflow ? '#10b981' : '#ef4444';
  const opacity = 0.6;

  const pathData = `
    M${sourceX},${sourceY}
    C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
  `;

  return (
    <path
      d={pathData}
      stroke={color}
      strokeWidth={Math.max(2, Math.min(50, payload.value / 1000))}
      fill="none"
      opacity={opacity}
    />
  );
};

// Custom Tooltip Component
const CustomTooltip = (props: any) => {
  const { active, payload } = props;
  
  if (!active || !payload || !payload[0]) return null;

  const data = payload[0].payload;
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(Math.abs(amount));
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
      <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
        {data.name}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Amount: <span className="font-medium">{formatCurrency(data.value)}</span>
      </p>
    </div>
  );
};

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
  const [error, setError] = useState<string | null>(null);

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
      if (!xml || xml.trim().length === 0) {
        console.warn('Empty XML data provided to Sankey parser');
        return;
      }

      // Parse XML string
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      
      // Check for parsing errors
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        console.error('XML parsing error:', parseError.textContent);
        setError(`XML parsing error: ${parseError.textContent}`);
        return;
      }
      
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

      // Validate that we have some data
      if (nodes.length === 1 && links.length === 0) {
        console.warn('No transaction flows found in XML data');
        setError('No transaction flows found in the analysis data');
        return;
      }

    } catch (error: any) {
      console.error('Error parsing XML for Sankey:', error);
      setError(`Failed to parse transaction data: ${error.message}`);
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

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Flow Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-red-600 mb-2">Analysis Error</div>
              <div className="text-sm text-muted-foreground">{error}</div>
            </div>
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

        {/* Enhanced Sankey Diagram */}
        <div className="bg-white dark:bg-gray-950 rounded-lg shadow-lg p-4 mb-6" style={{ height: 'calc(100vh - 300px)', minHeight: '500px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={{
                nodes: sankeyData.nodes.map((node, index) => ({
                  name: node.name,
                  value: node.value,
                  type: node.type
                })),
                links: sankeyData.links.map(link => {
                  // Find the node indices for source and target
                  const sourceIndex = sankeyData.nodes.findIndex(n => n.id === link.source);
                  const targetIndex = sankeyData.nodes.findIndex(n => n.id === link.target);
                  return {
                    source: sourceIndex >= 0 ? sourceIndex : 0,
                    target: targetIndex >= 0 ? targetIndex : 0,
                    value: link.value,
                    type: link.type
                  };
                })
              }}
              nodeWidth={150}
              nodePadding={20}
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
              link={<CustomLink />}
              node={<CustomNode />}
            >
              <Tooltip content={<CustomTooltip />} />
            </Sankey>
          </ResponsiveContainer>
        </div>

        {/* Detailed Flow Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Inflows */}
          <div>
            <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-3">Money Coming In</h4>
            <div className="space-y-2">
              {sankeyData.nodes.filter(n => n.type === 'source').map((node) => (
                <div key={node.id} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 rounded">
                  <span className="text-sm font-medium">{node.name}</span>
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                    {formatCurrency(node.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Outflows */}
          <div>
            <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-3">Money Going Out</h4>
            <div className="space-y-2">
              {sankeyData.nodes.filter(n => n.type === 'target').map((node) => (
                <div key={node.id} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950 rounded">
                  <span className="text-sm font-medium">{node.name}</span>
                  <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                    {formatCurrency(node.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}