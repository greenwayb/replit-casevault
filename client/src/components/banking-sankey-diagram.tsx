import React, { useMemo } from 'react';
import { Sankey, ResponsiveContainer, Tooltip } from 'recharts';

interface BankingSankeyDiagramProps {
  xmlData: string;
  accountName: string;
  dateRange: string;
}

export function BankingSankeyDiagram({ xmlData, accountName, dateRange }: BankingSankeyDiagramProps) {
  // Process XML data and create Sankey structure - simplified to prevent recursion
  const processedData = useMemo(() => {
    if (!xmlData) {
      return {
        sankeyData: { nodes: [], links: [] },
        stats: { totalCredits: 0, totalDebits: 0, transactionCount: 0, topInflows: [], topOutflows: [] }
      };
    }

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
      const transactionNodes = xmlDoc.getElementsByTagName('transaction');

      // Get account info
      const getElementText = (tagName: string) => {
        const element = xmlDoc.getElementsByTagName(tagName)[0];
        return element ? element.textContent?.trim() || '' : '';
      };

      const accountNumber = getElementText('account_number');
      const accountDisplayName = accountNumber ? 
        `${accountName} (${accountNumber})` : 
        accountName;

      // Process all transactions
      const inflows = new Map<string, number>();
      const outflows = new Map<string, number>();
      let totalCredits = 0;
      let totalDebits = 0;
      let transactionCount = 0;

      for (let i = 0; i < transactionNodes.length; i++) {
        const transaction = transactionNodes[i];
        const getTextContent = (tagName: string) => {
          const element = transaction.getElementsByTagName(tagName)[0];
          return element ? element.textContent || '' : '';
        };

        const amountStr = getTextContent('amount');
        if (amountStr) {
          const amount = parseFloat(amountStr) || 0;
          const category = getTextContent('transaction_category') || 'Other';
          const transferTarget = getTextContent('transfer_target');
          
          transactionCount++;

          if (amount > 0) {
            totalCredits += amount;
            const source = transferTarget || category || 'Other Income';
            inflows.set(source, (inflows.get(source) || 0) + amount);
          } else {
            const absAmount = Math.abs(amount);
            totalDebits += absAmount;
            const target = transferTarget || category || 'Other Expenses';
            outflows.set(target, (outflows.get(target) || 0) + absAmount);
          }
        }
      }

      // Build Sankey nodes and links
      const nodes: Array<{ name: string; category: string }> = [];
      const links: Array<{ source: number; target: number; value: number }> = [];
      let nodeIndex = 0;
      const nodeMap = new Map<string, number>();

      // Add source nodes (inflows)
      inflows.forEach((amount, source) => {
        nodes.push({ name: source, category: 'inflow' });
        nodeMap.set(source, nodeIndex++);
      });

      // Add account node
      const accountNodeIndex = nodeIndex;
      nodes.push({ name: accountDisplayName, category: 'account' });
      nodeIndex++;

      // Add target nodes (outflows)
      outflows.forEach((amount, target) => {
        nodes.push({ name: target, category: 'outflow' });
        nodeMap.set(target, nodeIndex++);
      });

      // Create links from sources to account
      inflows.forEach((amount, source) => {
        links.push({
          source: nodeMap.get(source)!,
          target: accountNodeIndex,
          value: amount
        });
      });

      // Create links from account to targets
      outflows.forEach((amount, target) => {
        links.push({
          source: accountNodeIndex,
          target: nodeMap.get(target)!,
          value: amount
        });
      });

      // Calculate top flows
      const topInflows = Array.from(inflows.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const topOutflows = Array.from(outflows.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

      return {
        nodes,
        links,
        totalCredits,
        totalDebits,
        transactionCount,
        topInflows,
        topOutflows
      };
    } catch (error) {
      console.error('Error processing Sankey data:', error);
      return {
        nodes: [],
        links: [],
        totalCredits: 0,
        totalDebits: 0,
        transactionCount: 0,
        topInflows: [],
        topOutflows: []
      };
    }
  }, [xmlData, accountName]);

  // Simple static Sankey data structure
  const sankeyChartData = useMemo(() => ({
    nodes: processedData.nodes,
    links: processedData.links
  }), [processedData.nodes, processedData.links]);

  // Custom Sankey components - simplified to prevent recursion
  const CustomNode = React.useCallback(({ payload, ...props }: any) => {
    const { x, y, width, height, index } = props;
    const node = processedData.nodes[index];
    
    if (!node) return null;
    
    let fill = '#8884d8';
    if (node.category === 'inflow') fill = '#82ca9d';
    else if (node.category === 'outflow') fill = '#ffc658';
    else if (node.category === 'account') fill = '#ff7c7c';
    
    const displayName = node.name && node.name.length > 15 ? node.name.substring(0, 13) + '...' : (node.name || '');
    
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#333" strokeWidth={1} rx={4} />
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#333" fontWeight="bold">
          {displayName}
        </text>
      </g>
    );
  }, [processedData.nodes]);

  const CustomTooltip = React.useCallback(({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold">{`${data.source?.name || 'Source'} → ${data.target?.name || 'Target'}`}</p>
          <p className="text-blue-600">{`Amount: $${data.value?.toLocaleString() || 0}`}</p>
        </div>
      );
    }
    return null;
  }, []);

  return (
    <div className="w-full bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {accountName} - Transaction Flow Analysis
        </h1>
        <p className="text-gray-600 mb-4">
          {dateRange} | Credits: ${processedData.totalCredits.toLocaleString()} | Debits: ${processedData.totalDebits.toLocaleString()}
        </p>
        
        {/* Legend */}
        <div className="flex gap-6 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-400 rounded"></div>
            <span className="text-sm">Money In (Inflows)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-400 rounded"></div>
            <span className="text-sm">Bank Account</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-400 rounded"></div>
            <span className="text-sm">Money Out (Outflows)</span>
          </div>
        </div>
        
        {/* Transaction Summary */}
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <h3 className="font-semibold mb-2">Transaction Summary:</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-green-600">Total Credits:</span>
              <br />${processedData.totalCredits.toLocaleString()}
            </div>
            <div>
              <span className="font-medium text-red-600">Total Debits:</span>
              <br />${processedData.totalDebits.toLocaleString()}
            </div>
            <div>
              <span className="font-medium text-blue-600">Transaction Count:</span>
              <br />{processedData.transactionCount.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Sankey Diagram */}
      <div className="bg-white rounded-lg shadow-lg p-4" style={{ height: 'calc(100vh - 300px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={sankeyChartData}
            nodeWidth={120}
            nodePadding={15}
            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
            node={<CustomNode />}
          >
            <Tooltip content={<CustomTooltip />} />
          </Sankey>
        </ResponsiveContainer>
      </div>
      
      {/* Summary statistics */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold text-green-800 mb-2">Top Inflows</h3>
          <ul className="text-sm space-y-1">
            {processedData.topInflows.map(([name, amount]: [string, number], index: number) => {
              const percentage = processedData.totalCredits > 0 ? ((amount / processedData.totalCredits) * 100).toFixed(1) : '0';
              return (
                <li key={index} className="flex justify-between">
                  <span className="truncate mr-2">{name}</span>
                  <span className="text-green-600 font-medium whitespace-nowrap">
                    ${amount.toLocaleString()} ({percentage}%)
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        
        <div className="bg-red-50 p-4 rounded-lg">
          <h3 className="font-semibold text-red-800 mb-2">Top Outflows</h3>
          <ul className="text-sm space-y-1">
            {processedData.topOutflows.map(([name, amount]: [string, number], index: number) => {
              const percentage = processedData.totalDebits > 0 ? ((amount / processedData.totalDebits) * 100).toFixed(1) : '0';
              return (
                <li key={index} className="flex justify-between">
                  <span className="truncate mr-2">{name}</span>
                  <span className="text-red-600 font-medium whitespace-nowrap">
                    ${amount.toLocaleString()} ({percentage}%)
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}