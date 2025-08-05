import React, { useState, useMemo } from 'react';
import { Sankey, ResponsiveContainer, Tooltip } from 'recharts';

interface BankingSankeyDiagramProps {
  xmlData: string;
  accountName: string;
  dateRange: string;
}

export function BankingSankeyDiagram({ xmlData, accountName, dateRange }: BankingSankeyDiagramProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  // Pre-process ALL period data once - no dependencies on selectedPeriod
  const allPeriodData = useMemo(() => {
    if (!xmlData) return {};
    
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
      
      // Group transactions by period
      const periodGroups: { [key: string]: any[] } = { 'all': [] };
      
      for (let i = 0; i < transactionNodes.length; i++) {
        const transaction = transactionNodes[i];
        const getTextContent = (tagName: string) => {
          const element = transaction.getElementsByTagName(tagName)[0];
          return element ? element.textContent || '' : '';
        };
        
        const date = getTextContent('transaction_date');
        const amountStr = getTextContent('amount');
        
        if (date && amountStr) {
          const amount = parseFloat(amountStr) || 0;
          const category = getTextContent('transaction_category') || 'Other';
          const transferTarget = getTextContent('transfer_target');
          
          const transactionData = {
            date,
            amount,
            category,
            transferTarget
          };
          
          // Add to 'all' period
          periodGroups['all'].push(transactionData);
          
          // Add to specific month period
          const period = date.substring(0, 7);
          if (!periodGroups[period]) {
            periodGroups[period] = [];
          }
          periodGroups[period].push(transactionData);
        }
      }
      
      // Create Sankey data for each period
      const periodData: { [key: string]: any } = {};
      
      Object.keys(periodGroups).forEach(period => {
        const transactions = periodGroups[period];
        
        const inflows = new Map<string, number>();
        const outflows = new Map<string, number>();
        let totalCredits = 0;
        let totalDebits = 0;
        
        transactions.forEach(transaction => {
          if (transaction.amount > 0) {
            totalCredits += transaction.amount;
            const source = transaction.transferTarget || transaction.category || 'Other Income';
            inflows.set(source, (inflows.get(source) || 0) + transaction.amount);
          } else {
            const absAmount = Math.abs(transaction.amount);
            totalDebits += absAmount;
            const target = transaction.transferTarget || transaction.category || 'Other Expenses';
            outflows.set(target, (outflows.get(target) || 0) + absAmount);
          }
        });
        
        // Build Sankey structure
        const nodes: Array<{ name: string; category: string }> = [];
        const links: Array<{ source: number; target: number; value: number }> = [];
        let nodeIndex = 0;
        const nodeMap = new Map<string, number>();
        
        // Add source nodes
        inflows.forEach((amount, source) => {
          nodes.push({ name: source, category: 'inflow' });
          nodeMap.set(source, nodeIndex++);
        });
        
        // Add account node
        const accountNodeIndex = nodeIndex;
        nodes.push({ name: accountDisplayName, category: 'account' });
        nodeIndex++;
        
        // Add target nodes
        outflows.forEach((amount, target) => {
          nodes.push({ name: target, category: 'outflow' });
          nodeMap.set(target, nodeIndex++);
        });
        
        // Create links
        inflows.forEach((amount, source) => {
          links.push({
            source: nodeMap.get(source)!,
            target: accountNodeIndex,
            value: amount
          });
        });
        
        outflows.forEach((amount, target) => {
          links.push({
            source: accountNodeIndex,
            target: nodeMap.get(target)!,
            value: amount
          });
        });
        
        const topInflows = Array.from(inflows.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const topOutflows = Array.from(outflows.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
        
        periodData[period] = {
          sankeyData: { nodes, links },
          stats: {
            totalCredits,
            totalDebits,
            transactionCount: transactions.length,
            topInflows,
            topOutflows
          }
        };
      });
      
      return {
        periodData,
        periodOptions: Object.keys(periodGroups).sort()
      };
    } catch (error) {
      console.error('Error processing data:', error);
      return {};
    }
  }, [xmlData, accountName]);

  // Simply get the current period's pre-processed data
  const currentData = allPeriodData.periodData?.[selectedPeriod] || {
    sankeyData: { nodes: [], links: [] },
    stats: { totalCredits: 0, totalDebits: 0, transactionCount: 0, topInflows: [], topOutflows: [] }
  };

  const periodOptions = allPeriodData.periodOptions || ['all'];

  const CustomNode = ({ payload, ...props }: any) => {
    const { x, y, width, height, index } = props;
    const node = currentData.sankeyData.nodes[index];
    
    if (!node) return null;
    
    let fill = '#8884d8';
    if (node.category === 'inflow') fill = '#82ca9d';
    else if (node.category === 'outflow') fill = '#ffc658';
    else if (node.category === 'account') fill = '#ff7c7c';
    
    const displayName = node.name.length > 15 ? node.name.substring(0, 13) + '...' : node.name;
    
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#333" strokeWidth={1} rx={4} />
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#333" fontWeight="bold">
          {displayName}
        </text>
      </g>
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
          {dateRange} | Credits: ${currentData.stats.totalCredits.toLocaleString()} | Debits: ${currentData.stats.totalDebits.toLocaleString()}
        </p>
        
        {/* Period selector buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {periodOptions.map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                selectedPeriod === period 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              {period === 'all' ? 'All Periods' : period}
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
        
        {/* Transaction Summary */}
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <h3 className="font-semibold mb-2">Transaction Summary ({selectedPeriod}):</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-green-600">Total Credits:</span>
              <br />${currentData.stats.totalCredits.toLocaleString()}
            </div>
            <div>
              <span className="font-medium text-red-600">Total Debits:</span>
              <br />${currentData.stats.totalDebits.toLocaleString()}
            </div>
            <div>
              <span className="font-medium text-blue-600">Transaction Count:</span>
              <br />{currentData.stats.transactionCount.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Sankey Diagram */}
      <div className="bg-white rounded-lg shadow-lg p-4" style={{ height: 'calc(100vh - 300px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={currentData.sankeyData}
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
            {currentData.stats.topInflows.map(([name, amount]: [string, number], index: number) => {
              const percentage = currentData.stats.totalCredits > 0 ? ((amount / currentData.stats.totalCredits) * 100).toFixed(1) : '0';
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
            {currentData.stats.topOutflows.map(([name, amount]: [string, number], index: number) => {
              const percentage = currentData.stats.totalDebits > 0 ? ((amount / currentData.stats.totalDebits) * 100).toFixed(1) : '0';
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