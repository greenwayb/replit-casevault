import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Search, Download, Filter, MessageCircle, MessageSquare, Save, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Transaction {
  id?: number;
  transactionDate: string;
  description: string;
  amount: string;
  balance?: string;
  category?: string;
  status: 'none' | 'query';
  comments?: string;
}

interface BankingTransactionsTableProps {
  documentId: number;
  xmlData: string;
}

export function BankingTransactionsTable({ documentId, xmlData }: BankingTransactionsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'none' | 'query'>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Parse transactions from XML data
  const xmlTransactions = useMemo(() => {
    if (!xmlData) return [];

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
      const transactions: Transaction[] = [];
      const transactionNodes = xmlDoc.getElementsByTagName('transaction');

      for (let i = 0; i < transactionNodes.length; i++) {
        const transaction = transactionNodes[i];
        const getTransactionText = (tagName: string) => {
          const element = transaction.getElementsByTagName(tagName)[0];
          return element ? element.textContent?.trim() || '' : '';
        };

        transactions.push({
          transactionDate: getTransactionText('transaction_date'),
          description: getTransactionText('transaction_description'),
          amount: getTransactionText('amount'),
          balance: getTransactionText('balance'),
          category: getTransactionText('transaction_category'),
          status: 'none',
          comments: ''
        });
      }

      return transactions.sort((a, b) => 
        new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
      );
    } catch (error) {
      console.error('Error parsing XML transaction data:', error);
      return [];
    }
  }, [xmlData]);

  // Fetch existing transaction statuses from database
  const { data: savedTransactions = [] } = useQuery({
    queryKey: ['/api/transactions', documentId],
    enabled: !!documentId,
  });

  // Merge XML data with saved statuses
  const transactions = useMemo(() => {
    const savedStatusMap = new Map(
      (savedTransactions as Transaction[]).map((t: Transaction) => [`${t.transactionDate}-${t.description}-${t.amount}`, t])
    );

    return xmlTransactions.map((xmlTxn, index) => {
      const key = `${xmlTxn.transactionDate}-${xmlTxn.description}-${xmlTxn.amount}`;
      const savedTxn = savedStatusMap.get(key);
      
      return {
        ...xmlTxn,
        id: savedTxn?.id || undefined,
        status: (savedTxn?.status as 'none' | 'query') || 'none',
        comments: savedTxn?.comments || '',
        rowIndex: index + 1
      };
    });
  }, [xmlTransactions, savedTransactions]);

  // Filter transactions based on search and status
  const filteredTransactions = useMemo(() => {
    return transactions.filter(txn => {
      const matchesSearch = !searchTerm || 
        txn.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.amount.includes(searchTerm);
      
      const matchesStatus = statusFilter === 'all' || txn.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchTerm, statusFilter]);

  // Update transaction status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ transactionData, newStatus }: { 
      transactionData: Transaction, 
      newStatus: 'none' | 'query' 
    }) => {
      const payload = {
        documentId,
        transactionDate: transactionData.transactionDate,
        description: transactionData.description,
        amount: transactionData.amount,
        balance: transactionData.balance || '',
        category: transactionData.category || '',
        status: newStatus,
        comments: transactionData.comments || ''
      };

      if (transactionData.id) {
        // Update existing transaction
        return await apiRequest(`/api/transactions/${transactionData.id}`, 'PUT', { status: newStatus });
      } else {
        // Create new transaction record
        return await apiRequest('/api/transactions', 'POST', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions', documentId] });
      toast({
        title: "Transaction status updated",
        description: "The change has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (transaction: Transaction, newStatus: 'none' | 'query') => {
    updateStatusMutation.mutate({ transactionData: transaction, newStatus });
  };

  // Comment update mutation
  const updateCommentMutation = useMutation({
    mutationFn: async ({ transactionData, newComment }: { 
      transactionData: Transaction, 
      newComment: string 
    }) => {
      const payload = {
        documentId,
        transactionDate: transactionData.transactionDate,
        description: transactionData.description,
        amount: transactionData.amount,
        balance: transactionData.balance || '',
        category: transactionData.category || '',
        status: transactionData.status,
        comments: newComment
      };

      if (transactionData.id) {
        // Update existing transaction
        return await apiRequest(`/api/transactions/${transactionData.id}`, 'PUT', { comments: newComment });
      } else {
        // Create new transaction record
        return await apiRequest('/api/transactions', 'POST', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions', documentId] });
      setIsCommentDialogOpen(false);
      setSelectedTransaction(null);
      setCommentText('');
      toast({
        title: "Comment updated",
        description: "The comment has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenCommentDialog = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setCommentText(transaction.comments || '');
    setIsCommentDialogOpen(true);
  };

  const handleSaveComment = () => {
    if (selectedTransaction) {
      updateCommentMutation.mutate({ 
        transactionData: selectedTransaction, 
        newComment: commentText 
      });
    }
  };

  const handleCancelComment = () => {
    setIsCommentDialogOpen(false);
    setSelectedTransaction(null);
    setCommentText('');
  };

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return amount;
    
    const formatted = Math.abs(num).toFixed(2);
    return num < 0 ? `-$${formatted}` : `$${formatted}`;
  };

  const getStatusBadge = (status: 'none' | 'query') => {
    switch (status) {
      case 'query':
        return <Badge variant="destructive">Query</Badge>;
      case 'none':
      default:
        return <Badge variant="secondary">None</Badge>;
    }
  };

  if (!xmlData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Table</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No transaction data available. Please run AI analysis first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Transaction Table ({filteredTransactions.length} transactions)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardTitle>
        
        {/* Filters */}
        <div className="flex gap-4 mt-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={(value: 'all' | 'none' | 'query') => setStatusFilter(value)}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="query">Query</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction, index) => (
                <TableRow key={`${transaction.transactionDate}-${transaction.description}-${index}`}>
                  <TableCell className="font-mono text-sm">
                    {transaction.rowIndex}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {new Date(transaction.transactionDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate" title={transaction.description}>
                      {transaction.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {transaction.category || '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className={parseFloat(transaction.amount) < 0 ? 'text-red-600' : 'text-green-600'}>
                      {formatAmount(transaction.amount)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {transaction.balance ? formatAmount(transaction.balance) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(transaction.status)}
                      <Select
                        value={transaction.status}
                        onValueChange={(value: 'none' | 'query') => handleStatusChange(transaction, value)}
                        disabled={updateStatusMutation.isPending}
                      >
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="query">Query</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenCommentDialog(transaction)}
                      className="h-8 w-8 p-0"
                    >
                      {transaction.comments && transaction.comments.trim() ? (
                        <MessageSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <MessageCircle className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredTransactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'No transactions match your filters'
                      : 'No transactions found'
                    }
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {filteredTransactions.length > 0 && (
          <div className="flex justify-between items-center mt-4 text-sm text-muted-foreground">
            <div>
              Showing {filteredTransactions.length} of {transactions.length} transactions
            </div>
            <div className="flex gap-4">
              <span>Queries: {filteredTransactions.filter(t => t.status === 'query').length}</span>
              <span>None: {filteredTransactions.filter(t => t.status === 'none').length}</span>
            </div>
          </div>
        )}
      </CardContent>

      {/* Comment Dialog */}
      <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transaction Comment</DialogTitle>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">
                  <strong>Date:</strong> {new Date(selectedTransaction.transactionDate).toLocaleDateString()}
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  <strong>Description:</strong> {selectedTransaction.description}
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Amount:</strong> {formatAmount(selectedTransaction.amount)}
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Comment (max 5000 characters)</label>
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Enter your comment here..."
                  className="min-h-32 resize-none"
                  maxLength={5000}
                />
                <div className="text-xs text-gray-500 text-right">
                  {commentText.length}/5000 characters
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelComment}
                  disabled={updateCommentMutation.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveComment}
                  disabled={updateCommentMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateCommentMutation.isPending ? 'Saving...' : 'Save Comment'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}