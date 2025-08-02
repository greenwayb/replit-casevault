import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ComposedChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface BalanceData {
  date: string;
  balance: number;
  formattedDate: string;
  credits: number;
  debits: number;
}

interface BankingBalanceChartProps {
  csvData?: string;
  documentName: string;
  accountName?: string;
}

export default function BankingBalanceChart({ csvData, documentName, accountName }: BankingBalanceChartProps) {
  const [balanceData, setBalanceData] = useState<BalanceData[]>([]);
  const [totalChange, setTotalChange] = useState(0);
  const [percentChange, setPercentChange] = useState(0);

  useEffect(() => {
    if (!csvData) return;

    try {
      // Parse CSV data to extract balance information
      const lines = csvData.split('\n').filter(line => line.trim());
      if (lines.length < 2) return; // Need at least header + 1 data row

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Find required columns
      const dateColumnIndex = headers.findIndex(h => h.includes('date') || h.includes('time'));
      const balanceColumnIndex = headers.findIndex(h => h.toLowerCase() === 'balance' || h.includes('balance'));
      const amountColumnIndex = headers.findIndex(h => h.includes('amount') || h.includes('credit') || h.includes('debit'));
      const descriptionColumnIndex = headers.findIndex(h => h.includes('description') || h.includes('reference') || h.includes('details'));

      if (dateColumnIndex === -1 || balanceColumnIndex === -1) return;

      // Parse all transactions
      const transactions: Array<{
        date: string;
        balance: number;
        amount: number;
        description: string;
      }> = [];
      
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length <= Math.max(dateColumnIndex, balanceColumnIndex)) continue;

        const dateStr = row[dateColumnIndex]?.trim().replace(/"/g, '');
        const balanceStr = row[balanceColumnIndex]?.trim().replace(/"/g, '').replace(/[$,]/g, '');
        const amountStr = amountColumnIndex !== -1 ? row[amountColumnIndex]?.trim().replace(/"/g, '').replace(/[$,]/g, '') : '0';
        const description = descriptionColumnIndex !== -1 ? row[descriptionColumnIndex]?.trim().replace(/"/g, '') : '';
        
        if (!dateStr || !balanceStr) continue;

        const balance = parseFloat(balanceStr);
        const amount = parseFloat(amountStr) || 0;
        if (isNaN(balance)) continue;

        let parsedDate: Date;
        try {
          // Try different date formats
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              parsedDate = new Date(parts[2], parseInt(parts[1]) - 1, parseInt(parts[0]));
            } else {
              parsedDate = new Date(dateStr);
            }
          } else {
            parsedDate = new Date(dateStr);
          }
          
          if (isNaN(parsedDate.getTime())) continue;
        } catch {
          continue;
        }

        transactions.push({
          date: parsedDate.toISOString().split('T')[0],
          balance,
          amount,
          description
        });
      }

      // Sort by date
      transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Group by day and calculate end-of-day balances with daily credits/debits
      const dailyData = new Map<string, { balance: number; credits: number; debits: number; formattedDate: string }>();
      
      transactions.forEach(transaction => {
        const existing = dailyData.get(transaction.date);
        const isCredit = transaction.amount >= 0;
        
        const parsedDate = new Date(transaction.date);
        const formattedDate = parsedDate.toLocaleDateString('en-AU', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });

        if (existing) {
          // Update end-of-day balance and accumulate credits/debits
          existing.balance = transaction.balance; // Last balance of the day
          if (isCredit) {
            existing.credits += Math.abs(transaction.amount);
          } else {
            existing.debits += Math.abs(transaction.amount);
          }
        } else {
          dailyData.set(transaction.date, {
            balance: transaction.balance,
            credits: isCredit ? Math.abs(transaction.amount) : 0,
            debits: isCredit ? 0 : Math.abs(transaction.amount),
            formattedDate
          });
        }
      });

      // Convert to array format
      const parsedData: BalanceData[] = Array.from(dailyData.entries()).map(([date, data]) => ({
        date,
        balance: data.balance,
        credits: data.credits,
        debits: data.debits,
        formattedDate: data.formattedDate
      }));

      // Calculate total change and percentage
      if (parsedData.length > 1) {
        const firstBalance = parsedData[0].balance;
        const lastBalance = parsedData[parsedData.length - 1].balance;
        const change = lastBalance - firstBalance;
        const percent = firstBalance !== 0 ? (change / Math.abs(firstBalance)) * 100 : 0;
        
        setTotalChange(change);
        setPercentChange(percent);
      }

      setBalanceData(parsedData);
    } catch (error) {
      console.error('Error parsing CSV data for balance chart:', error);
    }
  }, [csvData]);

  if (!balanceData || balanceData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>Account Balance Trend</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">No balance data available to display chart</p>
            <p className="text-xs text-slate-400 mt-1">Upload a banking statement with transaction data to see balance trends</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatTooltipValue = (value: number) => {
    return formatCurrency(value);
  };

  const isPositiveTrend = totalChange >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>Account Balance Trend</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            {isPositiveTrend ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span className={`font-semibold ${isPositiveTrend ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalChange)} ({percentChange.toFixed(1)}%)
            </span>
          </div>
        </CardTitle>
        {accountName && (
          <p className="text-sm text-slate-600">{accountName}</p>
        )}
      </CardHeader>
      <CardContent>
        <div>
        {/* End-of-Day Balance Line Chart */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-slate-700 mb-3">End-of-Day Balance</h4>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={balanceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="formattedDate"
                  tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                labelFormatter={(label) => `Date: ${label}`}
                formatter={(value: number) => [formatTooltipValue(value), 'Balance']}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="balance" 
                stroke="#2563eb" 
                strokeWidth={2}
                dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#2563eb' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Credits and Debits Bar Chart */}
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Daily Activity</h4>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={balanceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="formattedDate"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  labelFormatter={(label) => `Date: ${label}`}
                  formatter={(value: number, name: string) => [
                    formatTooltipValue(value), 
                    name === 'credits' ? 'Credits' : 'Debits'
                  ]}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar 
                  dataKey="credits" 
                  stackId="activity"
                  fill="#10b981" 
                  name="credits"
                />
                <Bar 
                  dataKey="debits" 
                  stackId="activity"
                  fill="#ef4444"
                  name="debits"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-4 flex justify-between text-xs text-slate-500">
          <span>Period: {balanceData.length} days</span>
          <span>
            {balanceData[0]?.formattedDate} - {balanceData[balanceData.length - 1]?.formattedDate}
          </span>
        </div>
        </div>
        </div>
      </CardContent>
    </Card>
  );
}