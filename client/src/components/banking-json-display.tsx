import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BankingJsonDisplayProps {
  xmlData: string;
}

export function BankingJsonDisplay({ xmlData }: BankingJsonDisplayProps) {
  const jsonData = useMemo(() => {
    if (!xmlData) return null;

    try {
      // Parse XML to extract data
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, 'text/xml');

      const getElementText = (tagName: string, parent = xmlDoc) => {
        const element = parent.getElementsByTagName(tagName)[0];
        return element ? element.textContent?.trim() || '' : '';
      };

      // Extract basic account information
      const accountInfo = {
        institution: getElementText('institution'),
        account_holders: Array.from(xmlDoc.getElementsByTagName('account_holder')).map(
          el => el.textContent?.trim() || ''
        ),
        account_type: getElementText('account_type'),
        start_date: getElementText('start_date'),
        end_date: getElementText('end_date'),
        account_number: getElementText('account_number'),
        account_bsb: getElementText('account_bsb'),
        currency: getElementText('currency'),
        total_credits: parseFloat(getElementText('total_credits')) || 0,
        total_debits: parseFloat(getElementText('total_debits')) || 0
      };

      // Extract transactions
      const transactions = [];
      const transactionNodes = xmlDoc.getElementsByTagName('transaction');
      
      for (let i = 0; i < transactionNodes.length; i++) {
        const transaction = transactionNodes[i];
        const getTransactionText = (tagName: string) => {
          const element = transaction.getElementsByTagName(tagName)[0];
          return element ? element.textContent?.trim() || '' : '';
        };

        transactions.push({
          transaction_date: getTransactionText('transaction_date'),
          transaction_description: getTransactionText('transaction_description'),
          amount: parseFloat(getTransactionText('amount')) || 0,
          transaction_category: getTransactionText('transaction_category'),
          balance: parseFloat(getTransactionText('balance')) || 0
        });
      }

      // Extract inflows
      const inflows = [];
      const inflowNodes = xmlDoc.getElementsByTagName('from');
      for (let i = 0; i < inflowNodes.length; i++) {
        const fromNode = inflowNodes[i];
        const target = fromNode.getElementsByTagName('target')[0]?.textContent?.trim() || '';
        const amount = parseFloat(fromNode.getElementsByTagName('total_amount')[0]?.textContent || '0');
        if (target && amount > 0) {
          inflows.push({ target, total_amount: amount });
        }
      }

      // Extract outflows
      const outflows = [];
      const outflowNodes = xmlDoc.getElementsByTagName('to');
      for (let i = 0; i < outflowNodes.length; i++) {
        const toNode = outflowNodes[i];
        const target = toNode.getElementsByTagName('target')[0]?.textContent?.trim() || '';
        const amount = parseFloat(toNode.getElementsByTagName('total_amount')[0]?.textContent || '0');
        if (target && amount > 0) {
          outflows.push({ target, total_amount: amount });
        }
      }

      // Extract analysis summary
      const analysisSummary = getElementText('analysis_summary');

      return {
        account_info: accountInfo,
        transactions: transactions,
        inflows: inflows,
        outflows: outflows,
        analysis_summary: analysisSummary,
        summary_statistics: {
          total_transactions: transactions.length,
          net_position: accountInfo.total_credits - accountInfo.total_debits,
          average_transaction_amount: transactions.length > 0 
            ? transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / transactions.length 
            : 0,
          largest_credit: Math.max(...transactions.filter(t => t.amount > 0).map(t => t.amount), 0),
          largest_debit: Math.max(...transactions.filter(t => t.amount < 0).map(t => Math.abs(t.amount)), 0)
        }
      };
    } catch (error) {
      console.error('Error parsing XML to JSON:', error);
      return null;
    }
  }, [xmlData]);

  if (!jsonData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>JSON Data</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No XML data available to convert to JSON.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>JSON Data Export</CardTitle>
        <p className="text-sm text-muted-foreground">
          Structured JSON representation of the banking analysis data
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Download button */}
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `banking-analysis-${new Date().toISOString().split('T')[0]}.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Download JSON
          </button>

          {/* JSON display */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
            <pre className="text-xs font-mono whitespace-pre-wrap break-words">
              {JSON.stringify(jsonData, null, 2)}
            </pre>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
              <p className="text-xs text-blue-600 dark:text-blue-400">Transactions</p>
              <p className="font-semibold">{jsonData.summary_statistics.total_transactions}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
              <p className="text-xs text-green-600 dark:text-green-400">Net Position</p>
              <p className="font-semibold">${jsonData.summary_statistics.net_position.toFixed(2)}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded">
              <p className="text-xs text-purple-600 dark:text-purple-400">Avg Transaction</p>
              <p className="font-semibold">${jsonData.summary_statistics.average_transaction_amount.toFixed(2)}</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded">
              <p className="text-xs text-orange-600 dark:text-orange-400">Inflows/Outflows</p>
              <p className="font-semibold">{jsonData.inflows.length}/{jsonData.outflows.length}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}