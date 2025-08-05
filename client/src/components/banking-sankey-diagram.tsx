import React, { useState, useMemo } from 'react';
import { Sankey, ResponsiveContainer, Tooltip } from 'recharts';

interface Transaction {
  date: string;
  description: string;
  amount: number;
  balance: number;
  category: string;
  transfer_type: string;
  transfer_target: string;
}

interface BankingSankeyDiagramProps {
  xmlData: string;
  accountName: string;
  dateRange: string;
}

export function BankingSankeyDiagram({ xmlData, accountName, dateRange }: BankingSankeyDiagramProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  // Parse XML data and extract transactions
  const parsedData = useMemo(() => {
    if (!xmlData) return { transactions: [], periodOptions: ['all'], accountDisplayName: accountName };
    
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
      
      // Extract account info
      const getElementText = (tagName: string) => {
        const element = xmlDoc.getElementsByTagName(tagName)[0];
        return element ? element.textContent?.trim() || '' : '';
      };
      
      const accountNumber = getElementText('account_number');
      const accountDisplayName = accountNumber ? 
        `${accountName} (${accountNumber})` : 
        accountName;
      
      // Extract transactions
      const transactions: Transaction[] = [];
      const transactionNodes = xmlDoc.getElementsByTagName('transaction');
      const periods = new Set<string>(['all']);
      
      for (let i = 0; i < transactionNodes.length; i++) {
        const transaction = transactionNodes[i];
        const getTextContent = (tagName: string) => {
          const element = transaction.getElementsByTagName(tagName)[0];
          return element ? element.textContent || '' : '';
        };
        
        const date = getTextContent('transaction_date');
        if (date && date.length >= 7) {
          periods.add(date.substring(0, 7));
        }
        
        transactions.push({
          date: date,
          description: getTextContent('transaction_description'),
          amount: parseFloat(getTextContent('amount')) || 0,
          balance: parseFloat(getTextContent('balance')) || 0,
          category: getTextContent('transaction_category'),
          transfer_type: getTextContent('transfer_type'),
          transfer_target: getTextContent('transfer_target')
        });
      }
      
      return {
        transactions,
        periodOptions: Array.from(periods).sort(),
        accountDisplayName
      };
    } catch (error) {
      console.error('Error parsing XML:', error);
      return { transactions: [], periodOptions: ['all'], accountDisplayName: accountName };
    }
  }, [xmlData, accountName]);

  // Process filtered data for Sankey diagram
  const sankeyData = useMemo(() => {
    const filteredTransactions = selectedPeriod === 'all' 
      ? parsedData.transactions 
      : parsedData.transactions.filter(t => t.date.startsWith(selectedPeriod));

    // Group transactions into flows
    const inflows = new Map<string, number>();
    const outflows = new Map<string, number>();
    let totalCredits = 0;
    let totalDebits = 0;
    
    filteredTransactions.forEach(transaction => {
      const amount = Math.abs(transaction.amount);
      
      if (transaction.amount > 0) {
        totalCredits += amount;
        const source = transaction.transfer_target || transaction.category || 'Other Income';
        inflows.set(source, (inflows.get(source) || 0) + amount);
      } else {
        totalDebits += amount;
        const target = transaction.transfer_target || transaction.category || 'Other Expenses';
        outflows.set(target, (outflows.get(target) || 0) + amount);
      }
    });

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
    nodes.push({ name: parsedData.accountDisplayName, category: 'account' });
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

    // Calculate statistics
    const inflowEntries = Array.from(inflows.entries()).sort((a, b) => b[1] - a[1]);
    const outflowEntries = Array.from(outflows.entries()).sort((a, b) => b[1] - a[1]);
    
    return {
      sankeyData: { nodes, links },
      stats: {
        totalCredits,
        totalDebits,
        netPosition: totalCredits - totalDebits,
        topInflows: inflowEntries.slice(0, 5),
        topOutflows: outflowEntries.slice(0, 5),
        largestInflow: inflowEntries[0] || ['', 0],
        largestOutflow: outflowEntries[0] || ['', 0]
      }
    };
  }, [parsedData, selectedPeriod]);

  // Custom components for Sankey diagram
  const CustomNode = ({ payload, ...props }: any) => {
    const { x, y, width, height, index } = props;
    const node = sankeyData.sankeyData.nodes[index];
    
    if (!node) return null;
    
    let fill = '#8884d8';
    if (node.category === 'inflow') fill = '#82ca9d';
    else if (node.category === 'outflow') fill = '#ffc658';
    else if (node.category === 'account') fill = '#ff7c7c';
    
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#333" strokeWidth={1} rx={4} />
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#333" fontWeight="bold">
          {node.name.length > 20 ? node.name.substring(0, 18) + '...' : node.name}
        </text>
      </g>
    );
  };

  const CustomLink = ({ payload, ...props }: any) => {
    const { sourceX, sourceY, targetX, targetY, sourceControlX, targetControlX, linkWidth } = props;
    return (
      <path
        d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
        fill="none"
        stroke="#8884d8"
        strokeWidth={linkWidth}
        strokeOpacity={0.6}
      />
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
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
  };

  return (
    <div className="w-full bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {accountName} - Transaction Flow Analysis
        </h1>
        <p className="text-gray-600 mb-4">
          {dateRange} | Total Credits: ${sankeyData.stats.totalCredits.toLocaleString()} | Total Debits: ${sankeyData.stats.totalDebits.toLocaleString()}
        </p>
        
        {/* Period selector buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {parsedData.periodOptions.map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                selectedPeriod === period 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              {period === 'all' ? 'All Periods' : new Date(period + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </button>
          ))}
        </div>
        
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
        
        {/* Key insights */}
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <h3 className="font-semibold mb-2">Key Insights:</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-green-600">Largest Inflow:</span>
              <br />{sankeyData.stats.largestInflow[0]} (${sankeyData.stats.largestInflow[1].toLocaleString()})
            </div>
            <div>
              <span className="font-medium text-red-600">Largest Outflow:</span>
              <br />{sankeyData.stats.largestOutflow[0]} (${sankeyData.stats.largestOutflow[1].toLocaleString()})
            </div>
            <div>
              <span className="font-medium text-orange-600">Net Position:</span>
              <br />${sankeyData.stats.netPosition.toLocaleString()} ({sankeyData.stats.netPosition >= 0 ? 'Positive' : 'Negative'})
            </div>
          </div>
        </div>
      </div>

      {/* Sankey Diagram */}
      <div className="bg-white rounded-lg shadow-lg p-4" style={{ height: 'calc(100vh - 300px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={sankeyData.sankeyData}
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
      
      {/* Summary statistics */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold text-green-800 mb-2">Top Inflows</h3>
          <ul className="text-sm space-y-1">
            {sankeyData.stats.topInflows.map(([name, amount], index) => {
              const percentage = sankeyData.stats.totalCredits > 0 ? ((amount / sankeyData.stats.totalCredits) * 100).toFixed(1) : '0';
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
            {sankeyData.stats.topOutflows.map(([name, amount], index) => {
              const percentage = sankeyData.stats.totalDebits > 0 ? ((amount / sankeyData.stats.totalDebits) * 100).toFixed(1) : '0';
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