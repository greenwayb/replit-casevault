import React, { useState, useMemo } from 'react';

interface BankingSankeyDiagramProps {
  xmlData: string;
  accountName: string;
  dateRange: string;
}

export function BankingSankeyDiagram({ xmlData, accountName, dateRange }: BankingSankeyDiagramProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  // Extract period options from XML data
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

  // Simple transaction processing for basic stats
  const basicStats = useMemo(() => {
    if (!xmlData) return { totalCredits: 0, totalDebits: 0, transactionCount: 0 };
    
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
      const transactionNodes = xmlDoc.getElementsByTagName('transaction');
      
      let totalCredits = 0;
      let totalDebits = 0;
      let transactionCount = 0;
      
      for (let i = 0; i < transactionNodes.length; i++) {
        const transaction = transactionNodes[i];
        const amountElement = transaction.getElementsByTagName('amount')[0];
        const dateElement = transaction.getElementsByTagName('transaction_date')[0];
        
        if (amountElement?.textContent && dateElement?.textContent) {
          const date = dateElement.textContent.trim();
          
          // Filter by selected period
          if (selectedPeriod === 'all' || date.startsWith(selectedPeriod)) {
            const amount = parseFloat(amountElement.textContent) || 0;
            transactionCount++;
            
            if (amount > 0) {
              totalCredits += amount;
            } else {
              totalDebits += Math.abs(amount);
            }
          }
        }
      }
      
      return { totalCredits, totalDebits, transactionCount };
    } catch (error) {
      console.error('Error calculating stats:', error);
      return { totalCredits: 0, totalDebits: 0, transactionCount: 0 };
    }
  }, [xmlData, selectedPeriod]);

  return (
    <div className="w-full bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {accountName} - Transaction Flow Analysis
        </h1>
        <p className="text-gray-600 mb-4">
          {dateRange} | Credits: ${basicStats.totalCredits.toLocaleString()} | Debits: ${basicStats.totalDebits.toLocaleString()}
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
        
        {/* Basic stats */}
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <h3 className="font-semibold mb-2">Transaction Summary ({selectedPeriod}):</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-green-600">Total Credits:</span>
              <br />${basicStats.totalCredits.toLocaleString()}
            </div>
            <div>
              <span className="font-medium text-red-600">Total Debits:</span>
              <br />${basicStats.totalDebits.toLocaleString()}
            </div>
            <div>
              <span className="font-medium text-blue-600">Transaction Count:</span>
              <br />{basicStats.transactionCount.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Sankey Diagram Placeholder</h2>
        <p className="text-gray-500 mb-4">
          Advanced Sankey visualization will be restored once the period filtering is confirmed working.
        </p>
        <div className="text-sm text-gray-400">
          Current period: {selectedPeriod}<br />
          Data size: {xmlData.length} characters<br />
          Available periods: {periodOptions.join(', ')}
        </div>
      </div>
    </div>
  );
}