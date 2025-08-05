import React, { useState, useMemo } from 'react';

interface BankingSankeyDiagramProps {
  xmlData: string;
  accountName: string;
  dateRange: string;
}

export function BankingSankeyDiagram({ xmlData, accountName, dateRange }: BankingSankeyDiagramProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  // Simple data parsing without complex processing
  const periodOptions = useMemo(() => {
    if (!xmlData) return ['all'];
    
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
      const transactionNodes = xmlDoc.getElementsByTagName('transaction');
      
      const periods = new Set<string>(['all']);
      for (let i = 0; i < transactionNodes.length; i++) {
        const dateElement = transactionNodes[i].getElementsByTagName('transaction_date')[0];
        if (dateElement?.textContent) {
          const date = dateElement.textContent.trim();
          if (date.length >= 7) {
            periods.add(date.substring(0, 7));
          }
        }
      }
      
      return Array.from(periods).sort();
    } catch (error) {
      console.error('Error parsing XML:', error);
      return ['all'];
    }
  }, [xmlData]);

  return (
    <div className="w-full bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {accountName} - Transaction Flow Analysis
        </h1>
        <p className="text-gray-600 mb-4">
          Period: {dateRange}
        </p>
        
        {/* Period selector buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {periodOptions.map(period => (
            <button
              key={period}
              onClick={() => {
                console.log('Setting period to:', period);
                setSelectedPeriod(period);
              }}
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
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold mb-2">Current Selection:</h3>
          <p>Period: <span className="font-mono">{selectedPeriod}</span></p>
          <p>Account: <span className="font-mono">{accountName}</span></p>
          <p>Data Size: <span className="font-mono">{xmlData.length} characters</span></p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Sankey Diagram</h2>
        <p className="text-gray-500">
          Sankey visualization temporarily simplified for debugging. 
          <br />
          Period buttons should work without any recursion errors.
        </p>
      </div>
    </div>
  );
}