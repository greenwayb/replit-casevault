import { useState } from "react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Building, User, CreditCard, Calendar } from "lucide-react";

const bankingConfirmationSchema = z.object({
  accountHolderName: z.string().min(1, "Account holder name is required"),
  accountName: z.string().min(1, "Account type is required"),
  financialInstitution: z.string().min(1, "Financial institution is required"),
  accountNumber: z.string().optional(),
  bsbSortCode: z.string().optional(),
  transactionDateFrom: z.string().optional(),
  transactionDateTo: z.string().optional(),
});

type BankingConfirmationFormData = z.infer<typeof bankingConfirmationSchema>;

interface BankingInfo {
  accountHolderName: string;
  accountName: string;
  financialInstitution: string;
  accountNumber?: string;
  bsbSortCode?: string;
  transactionDateFrom?: string;
  transactionDateTo?: string;
}

interface BankingConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankingInfo: BankingInfo;
  onConfirm: (confirmedInfo: BankingInfo) => void;
  onReject: () => void;
  documentId?: number;
  isManualReview?: boolean;
  selectedFile?: File | null;
}

export default function BankingConfirmationModal({
  open,
  onOpenChange,
  bankingInfo,
  onConfirm,
  onReject,
  documentId,
  isManualReview = false,
  selectedFile = null
}: BankingConfirmationModalProps) {
  const form = useForm<BankingConfirmationFormData>({
    resolver: zodResolver(bankingConfirmationSchema),
    defaultValues: {
      accountHolderName: bankingInfo.accountHolderName || '',
      accountName: bankingInfo.accountName || '',
      financialInstitution: bankingInfo.financialInstitution || '',
      accountNumber: bankingInfo.accountNumber || '',
      bsbSortCode: bankingInfo.bsbSortCode || '',
      transactionDateFrom: bankingInfo.transactionDateFrom || '',
      transactionDateTo: bankingInfo.transactionDateTo || '',
    },
  });

  // Reset form values when bankingInfo changes
  React.useEffect(() => {
    form.reset({
      accountHolderName: bankingInfo.accountHolderName || '',
      accountName: bankingInfo.accountName || '',
      financialInstitution: bankingInfo.financialInstitution || '',
      accountNumber: bankingInfo.accountNumber || '',
      bsbSortCode: bankingInfo.bsbSortCode || '',
      transactionDateFrom: bankingInfo.transactionDateFrom || '',
      transactionDateTo: bankingInfo.transactionDateTo || '',
    });
  }, [bankingInfo, form]);

  const onSubmit = (data: BankingConfirmationFormData) => {
    onConfirm({
      accountHolderName: data.accountHolderName,
      accountName: data.accountName,
      financialInstitution: data.financialInstitution,
      accountNumber: data.accountNumber || undefined,
      bsbSortCode: data.bsbSortCode || undefined,
      transactionDateFrom: data.transactionDateFrom || undefined,
      transactionDateTo: data.transactionDateTo || undefined,
    });
    onOpenChange(false);
  };

  const handleReject = () => {
    onReject();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-blue-600" />
            {isManualReview ? 'Manual Banking Document Review' : 'Confirm Banking Information'}
          </DialogTitle>
          <DialogDescription>
            {isManualReview 
              ? 'AI processing failed. Please manually review the document and enter the banking information below.'
              : 'Please review and confirm the extracted banking information. You can edit any field if needed.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-6 flex-1 overflow-hidden">
          {/* Form Section */}
          <div className="overflow-y-auto">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="accountHolderName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Account Holder Name
                        </FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., John Smith" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Account Type
                        </FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Business Transaction Account" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="financialInstitution"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          Institution
                        </FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Commonwealth Bank" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., 1234567890" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bsbSortCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>BSB/Sort Code</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., 063-000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="transactionDateFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Start Date
                        </FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="transactionDateTo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          End Date
                        </FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="transactionDateFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Period From
                        </FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReject}
                  >
                    {isManualReview ? 'Skip Banking Info' : 'Reject & Continue'}
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Confirm & Save
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          {/* PDF Preview Section - always show */}
          <div className="border-l border-gray-200 pl-6 overflow-hidden">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Document Preview</h3>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full">
              {documentId ? (
                <iframe
                  src={`/api/documents/${documentId}/view`}
                  className="w-full h-full rounded-lg min-h-[600px]"
                  title="Document Preview"
                />
              ) : selectedFile ? (
                <iframe
                  src={URL.createObjectURL(selectedFile)}
                  className="w-full h-full rounded-lg min-h-[600px]"
                  title="Document Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">No document available for preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}