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

  // First, parse the base data without filtering (no circular dependency)
  const { transactions, periodOptions, accountDisplayName, inflowsFromXML, outflowsFromXML } = useMemo(() => {
    // Parse XML to extract transactions and account info
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
    
    // Extract account information from XML
    const getElementText = (tagName: string, parent = xmlDoc) => {
      const element = parent.getElementsByTagName(tagName)[0];
      return element ? element.textContent?.trim() || '' : '';
    };
    
    const accountNumber = getElementText('account_number');
    const accountDisplayName = accountNumber ? 
      `${accountName}\n(${accountNumber})` : 
      accountName;
    
    const transactions: Transaction[] = [];
    const transactionNodes = xmlDoc.getElementsByTagName('transaction');
    
    for (let i = 0; i < transactionNodes.length; i++) {
      const transaction = transactionNodes[i];
      const getTextContent = (tagName: string) => {
        const element = transaction.getElementsByTagName(tagName)[0];
        return element ? element.textContent || '' : '';
      };
      
      transactions.push({
        date: getTextContent('transaction_date'),
        description: getTextContent('transaction_description'),
        amount: parseFloat(getTextContent('amount')) || 0,
        balance: parseFloat(getTextContent('balance')) || 0,
        category: getTextContent('transaction_category'),
        transfer_type: getTextContent('transfer_type'),
        transfer_target: getTextContent('transfer_target')
      });
    }

    // Generate period options based on available transaction dates  
    const periods = new Set(['all']);
    transactions.forEach(t => {
      if (t.date) {
        const yearMonth = t.date.substring(0, 7); // YYYY-MM format
        periods.add(yearMonth);
      }
    });
    const availablePeriods = Array.from(periods).sort();

    // Also extract inflows/outflows from XML structure
    const inflowsFromXML = new Map<string, number>();
    const outflowsFromXML = new Map<string, number>();
    
    // Parse inflows section
    const inflowNodes = xmlDoc.getElementsByTagName('from');
    for (let i = 0; i < inflowNodes.length; i++) {
      const fromNode = inflowNodes[i];
      const target = fromNode.getElementsByTagName('target')[0]?.textContent?.trim() || '';
      const amount = parseFloat(fromNode.getElementsByTagName('total_amount')[0]?.textContent || '0');
      if (target && amount > 0) {
        inflowsFromXML.set(target, amount);
      }
    }
    
    // Parse outflows section  
    const outflowNodes = xmlDoc.getElementsByTagName('to');
    for (let i = 0; i < outflowNodes.length; i++) {
      const toNode = outflowNodes[i];
      const target = toNode.getElementsByTagName('target')[0]?.textContent?.trim() || '';
      const amount = parseFloat(toNode.getElementsByTagName('total_amount')[0]?.textContent || '0');
      // Handle negative outflow amounts by converting to positive
      const positiveAmount = Math.abs(amount);
      if (target && positiveAmount > 0) {
        outflowsFromXML.set(target, positiveAmount);
      }
    }

    return {
      transactions,
      periodOptions: availablePeriods,
      accountDisplayName,
      inflowsFromXML,
      outflowsFromXML
    };
  }, [xmlData, accountName]);

  // Second, process the filtered data (this safely depends on selectedPeriod)
  const { sankeyData, summaryStats } = useMemo(() => {
    // Filter transactions based on selected period
    let filteredTransactions = transactions;
    if (selectedPeriod !== 'all') {
      const year = selectedPeriod.slice(0, 4);
      const month = selectedPeriod.slice(5, 7);
      filteredTransactions = transactions.filter(t => t.date.startsWith(`${year}-${month}`));
    }

    // Group transactions by type and target (fallback if XML structure doesn't have inflows/outflows)
    const inflows = new Map<string, number>();
    const outflows = new Map<string, number>();
    let totalCredits = 0;
    let totalDebits = 0;
    
    // Use XML inflows/outflows if available, otherwise parse transactions
    if (inflowsFromXML.size > 0 || outflowsFromXML.size > 0) {
      // If using XML data and we have a period filter, we need to recalculate from filtered transactions
      if (selectedPeriod !== 'all') {
        // Recalculate from filtered transactions instead of using XML totals
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
      } else {
        // Use the structured inflow/outflow data from XML for "all" period
        inflowsFromXML.forEach((amount, source) => {
          inflows.set(source, amount);
          totalCredits += amount;
        });
        
        outflowsFromXML.forEach((amount, target) => {
          outflows.set(target, amount);
          totalDebits += amount;
        });
      }
    } else {
      // Fallback to transaction-by-transaction analysis using filtered transactions
      filteredTransactions.forEach(transaction => {
        const amount = Math.abs(transaction.amount);
        
        if (transaction.amount > 0) {
          // Inflow
          totalCredits += amount;
          const source = transaction.transfer_target || transaction.category || 'Other Income';
          inflows.set(source, (inflows.get(source) || 0) + amount);
        } else {
          // Outflow  
          totalDebits += amount;
          const target = transaction.transfer_target || transaction.category || 'Other Expenses';
          outflows.set(target, (outflows.get(target) || 0) + amount);
        }
      });
    }

    // Create nodes and links for Sankey
    const nodes: Array<{ name: string; category: string }> = [];
    const links: Array<{ source: number; target: number; value: number }> = [];
    
    let nodeIndex = 0;
    const nodeMap = new Map<string, number>();
    
    // Add inflow nodes
    Array.from(inflows.entries()).forEach(([source, amount]) => {
      nodes.push({ name: source, category: 'inflow' });
      nodeMap.set(source, nodeIndex++);
    });
    
    // Add central account node (with account number if available)
    const accountNodeIndex = nodeIndex;
    nodes.push({ name: accountDisplayName, category: 'account' });
    nodeMap.set(accountDisplayName, nodeIndex++);
    
    // Add outflow nodes
    Array.from(outflows.entries()).forEach(([target, amount]) => {
      nodes.push({ name: target, category: 'outflow' });
      nodeMap.set(target, nodeIndex++);
    });
    
    // Create links from inflows to account
    Array.from(inflows.entries()).forEach(([source, amount]) => {
      links.push({
        source: nodeMap.get(source)!,
        target: accountNodeIndex,
        value: amount
      });
    });
    
    // Create links from account to outflows
    Array.from(outflows.entries()).forEach(([target, amount]) => {
      links.push({
        source: accountNodeIndex,
        target: nodeMap.get(target)!,
        value: amount
      });
    });

    // Calculate summary statistics
    const sortedInflows = Array.from(inflows.entries()).sort((a, b) => b[1] - a[1]);
    const sortedOutflows = Array.from(outflows.entries()).sort((a, b) => b[1] - a[1]);
    const netPosition = totalCredits - totalDebits;
    
    return { 
      sankeyData: { nodes, links },
      summaryStats: {
        totalCredits,
        totalDebits,
        netPosition,
        topInflows: sortedInflows.slice(0, 5),
        topOutflows: sortedOutflows.slice(0, 5),
        largestInflow: sortedInflows[0] || ['', 0],
        largestOutflow: sortedOutflows[0] || ['', 0]
      }
    };
  }, [transactions, selectedPeriod, accountDisplayName, inflowsFromXML, outflowsFromXML]);

  // Custom node component
  const CustomNode = ({ payload, ...props }: any) => {
    const { x, y, width, height, index } = props;
    const node = sankeyData.nodes[index];
    
    let fill = '#8884d8';
    if (node.category === 'inflow') fill = '#82ca9d';
    else if (node.category === 'outflow') fill = '#ffc658';
    else if (node.category === 'account') fill = '#ff7c7c';
    
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={fill}
          stroke="#333"
          strokeWidth={1}
          rx={4}
        />
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fill="#333"
          fontWeight="bold"
        >
          {node.name.length > 20 ? node.name.substring(0, 18) + '...' : node.name}
        </text>
      </g>
    );
  };

  // Custom link component
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

  // Custom tooltip
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
          {accountName} - Money Flow Analysis
        </h1>
        <p className="text-gray-600 mb-4">
          {dateRange} | Total Credits: ${summaryStats.totalCredits.toLocaleString()} | Total Debits: ${summaryStats.totalDebits.toLocaleString()}
        </p>
        
        {/* Period selector buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {periodOptions.map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded text-sm ${
                selectedPeriod === period 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {period === 'all' ? 'All Period' : new Date(period + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
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
              <br />{summaryStats.largestInflow[0]} (${summaryStats.largestInflow[1].toLocaleString()})
            </div>
            <div>
              <span className="font-medium text-red-600">Largest Outflow:</span>
              <br />{summaryStats.largestOutflow[0]} (${summaryStats.largestOutflow[1].toLocaleString()})
            </div>
            <div>
              <span className="font-medium text-orange-600">Net Position:</span>
              <br />${summaryStats.netPosition.toLocaleString()} ({summaryStats.netPosition >= 0 ? 'Positive' : 'Negative'})
            </div>
          </div>
        </div>
      </div>

      {/* Sankey Diagram */}
      <div className="bg-white rounded-lg shadow-lg p-4" style={{ height: 'calc(100vh - 300px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={sankeyData}
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
            {summaryStats.topInflows.map(([name, amount], index) => {
              const percentage = ((amount / summaryStats.totalCredits) * 100).toFixed(1);
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
            {summaryStats.topOutflows.map(([name, amount], index) => {
              const percentage = ((amount / summaryStats.totalDebits) * 100).toFixed(1);
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