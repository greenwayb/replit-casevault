import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface BalanceData {
  date: string;
  balance: number;
  formattedDate: string;
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
      
      // Find balance and date columns - prioritize exact "Balance" column match
      let balanceColumnIndex = headers.findIndex(h => h.toLowerCase() === 'balance');
      if (balanceColumnIndex === -1) {
        balanceColumnIndex = headers.findIndex(h => h.includes('balance') || h.includes('amount') || h.includes('total'));
      }
      
      const dateColumnIndex = headers.findIndex(h => 
        h.includes('date') || h.includes('time')
      );

      if (balanceColumnIndex === -1 || dateColumnIndex === -1) return;

      const parsedData: BalanceData[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length <= Math.max(balanceColumnIndex, dateColumnIndex)) continue;

        const dateStr = row[dateColumnIndex]?.trim().replace(/"/g, '');
        const balanceStr = row[balanceColumnIndex]?.trim().replace(/"/g, '').replace(/[$,]/g, '');
        
        if (!dateStr || !balanceStr) continue;

        const balance = parseFloat(balanceStr);
        if (isNaN(balance)) continue;

        let parsedDate: Date;
        try {
          // Try different date formats
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              // Assume DD/MM/YYYY or MM/DD/YYYY format
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

        parsedData.push({
          date: parsedDate.toISOString().split('T')[0], // YYYY-MM-DD format
          balance,
          formattedDate: parsedDate.toLocaleDateString('en-AU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })
        });
      }

      // Sort by date
      parsedData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
        <div className="h-64 w-full">
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
        <div className="mt-4 flex justify-between text-xs text-slate-500">
          <span>Period: {balanceData.length} transactions</span>
          <span>
            {balanceData[0]?.formattedDate} - {balanceData[balanceData.length - 1]?.formattedDate}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}