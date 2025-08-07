import React, { useState, useMemo } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BankingTransactionChartProps {
  xmlData: string;
  accountName: string;
}

export function BankingTransactionChart({ xmlData, accountName }: BankingTransactionChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  const { dailyData, summaryStats, keyEvents } = useMemo(() => {
    if (!xmlData) {
      return { dailyData: [], summaryStats: null, keyEvents: [] };
    }

    try {
      // Parse XML to extract transactions
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
      
      const transactions = [];
      const transactionNodes = xmlDoc.getElementsByTagName('transaction');
      
      for (let i = 0; i < transactionNodes.length; i++) {
        const transaction = transactionNodes[i];
        const getTransactionText = (tagName: string) => {
          const element = transaction.getElementsByTagName(tagName)[0];
          return element ? element.textContent?.trim() || '' : '';
        };

        const date = getTransactionText('transaction_date');
        const amount = parseFloat(getTransactionText('amount')) || 0;
        const balance = parseFloat(getTransactionText('balance')) || 0;

        if (date) {
          transactions.push({
            date,
            amount,
            balance,
            description: getTransactionText('transaction_description'),
            category: getTransactionText('transaction_category')
          });
        }
      }

      // Sort transactions by date
      transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Group by date and calculate daily totals
      const dailyMap = new Map();
      
      transactions.forEach(transaction => {
        const date = transaction.date;
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            credits: 0,
            debits: 0,
            balance: transaction.balance,
            transactions: []
          });
        }
        
        const dayData = dailyMap.get(date);
        if (transaction.amount > 0) {
          dayData.credits += transaction.amount;
        } else {
          dayData.debits += Math.abs(transaction.amount);
        }
        dayData.balance = transaction.balance; // Use the latest balance for the day
        dayData.transactions.push(transaction);
      });

      const dailyArray = Array.from(dailyMap.values());

      // Filter based on selected period
      let filteredData = dailyArray;
      if (selectedPeriod !== 'all') {
        const year = selectedPeriod.slice(0, 4);
        const month = selectedPeriod.slice(5, 7);
        filteredData = dailyArray.filter(d => d.date.startsWith(`${year}-${month}`));
      }

      // Format data for chart
      const chartData = filteredData.map(d => ({
        ...d,
        dateDisplay: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: d.date,
        debitsNeg: -d.debits, // For stacked chart visualization
        netChange: d.credits - d.debits
      }));

      // Calculate summary statistics
      const totalCredits = dailyArray.reduce((sum, d) => sum + d.credits, 0);
      const totalDebits = dailyArray.reduce((sum, d) => sum + d.debits, 0);
      const startingBalance = dailyArray.length > 0 ? dailyArray[0].balance - (dailyArray[0].credits - dailyArray[0].debits) : 0;
      const endingBalance = dailyArray.length > 0 ? dailyArray[dailyArray.length - 1].balance : 0;

      const stats = {
        startingBalance,
        endingBalance,
        totalCredits,
        totalDebits,
        netChange: totalCredits - totalDebits,
        transactionCount: transactions.length
      };

      // Identify key events
      const events: Array<{date: string, label: string, balance: number}> = [];
      let previousBalance = startingBalance;
      
      dailyArray.forEach(day => {
        if (previousBalance >= 0 && day.balance < 0) {
          events.push({
            date: day.date,
            label: 'Account went negative',
            balance: day.balance
          });
        }
        
        if (day.debits > 5000) {
          events.push({
            date: day.date,
            label: 'Large spending day',
            balance: day.balance
          });
        }
        
        if (day.credits > 4000) {
          events.push({
            date: day.date,
            label: 'Large deposit received',
            balance: day.balance
          });
        }
        
        previousBalance = day.balance;
      });

      return { dailyData: chartData, summaryStats: stats, keyEvents: events };
    } catch (error) {
      console.error('Error processing transaction data:', error);
      return { dailyData: [], summaryStats: null, keyEvents: [] };
    }
  }, [xmlData, selectedPeriod]);

  // Generate period options based on available data
  const periodOptions = useMemo(() => {
    const periods = new Set(['all']);
    dailyData.forEach(d => {
      const yearMonth = d.fullDate.substring(0, 7); // YYYY-MM format
      periods.add(yearMonth);
    });
    return Array.from(periods).sort();
  }, [dailyData]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold mb-2">{`Date: ${label}`}</p>
          <p className="text-blue-600">{`End of Day Balance: $${data.balance.toLocaleString()}`}</p>
          <p className="text-green-600">{`Credits: $${data.credits.toLocaleString()}`}</p>
          <p className="text-red-600">{`Debits: $${data.debits.toLocaleString()}`}</p>
          <p className="text-gray-600">{`Net Change: $${data.netChange.toLocaleString()}`}</p>
          <p className="text-sm text-gray-500">{`Transactions: ${data.transactions?.length || 0}`}</p>
        </div>
      );
    }
    return null;
  };

  if (!summaryStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No transaction data available for charting.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {accountName} - Daily Balance & Transaction Analysis
          </CardTitle>
          <p className="text-muted-foreground">
            Line shows end-of-day balance | Bars show daily credits (green) and debits (red)
          </p>
        </CardHeader>
        <CardContent>
          {/* Period selector */}
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

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Starting Balance</h3>
              <p className={`text-xl font-bold ${summaryStats.startingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${summaryStats.startingBalance.toLocaleString()}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Ending Balance</h3>
              <p className={`text-xl font-bold ${summaryStats.endingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${summaryStats.endingBalance.toLocaleString()}
              </p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Total Credits</h3>
              <p className="text-xl font-bold text-green-600">
                ${summaryStats.totalCredits.toLocaleString()}
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Total Debits</h3>
              <p className="text-xl font-bold text-red-600">
                ${summaryStats.totalDebits.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Chart */}
      <Card>
        <CardContent className="p-6">
          <div style={{ height: '600px' }}>
            <ResponsiveContainer width="100%" height="100%" data-testid="transaction-chart">
              <ComposedChart
                data={dailyData}
                margin={{ top: 20, right: 30, left: 40, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="dateDisplay" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                />
                <YAxis 
                  yAxisId="balance"
                  orientation="left"
                  domain={['dataMin - 2000', 'dataMax + 2000']}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                  fontSize={12}
                />
                <YAxis 
                  yAxisId="transactions"
                  orientation="right"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(value) => `$${Math.abs(value).toLocaleString()}`}
                  fontSize={12}
                />
                
                {/* Reference line at zero for balance */}
                <ReferenceLine 
                  yAxisId="balance" 
                  y={0} 
                  stroke="#666" 
                  strokeDasharray="2 2" 
                  label={{ value: "Zero Balance", position: "top" }}
                />
                
                {/* Transaction bars */}
                <Bar 
                  yAxisId="transactions"
                  dataKey="credits" 
                  fill="#22c55e" 
                  name="Credits"
                  radius={[2, 2, 0, 0]}
                />
                <Bar 
                  yAxisId="transactions"
                  dataKey="debitsNeg" 
                  fill="#ef4444" 
                  name="Debits"
                  radius={[0, 0, 2, 2]}
                />
                
                {/* Balance line */}
                <Line 
                  yAxisId="balance"
                  type="monotone" 
                  dataKey="balance" 
                  stroke="#2563eb" 
                  strokeWidth={3}
                  dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                  name="End of Day Balance"
                />
                
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="top" 
                  height={36}
                  iconType="rect"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Key insights */}
      {keyEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Key Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {keyEvents.map((event, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <span className="text-sm">{event.label}:</span>
                  <div className="text-right">
                    <span className="font-medium text-sm">
                      {new Date(event.date).toLocaleDateString()}
                    </span>
                    <p className={`text-xs ${event.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Balance: ${event.balance.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}