import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { 
  ArrowLeft, 
  Users, 
  Send, 
  History, 
  CheckCircle, 
  Loader2,
  Printer,
  Download,
  Eye,
  FileText,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useMRBDatabase } from '@/hooks/useMRBDatabase';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
import { getStatusDisplayName, getStatusColor, getRoleDisplayName } from '@/data/mockData';
import { WorkflowProgressIndicator } from '@/components/mrb/WorkflowProgressIndicator';
import { PrintPreviewModal } from '@/components/print/PrintPreviewModal';
import { PrinterSettingsModal, loadPrinterSettings, type PrinterSettings } from '@/components/print/PrinterSettingsModal';
import hblLogo from '@/assets/hbl-logo.png';
import type { Database } from '@/integrations/supabase/types';

type MRBRecord = Database['public']['Tables']['mrb_records']['Row'];
type ApprovalHistory = Database['public']['Tables']['mrb_approval_history']['Row'];
type MRBStatus = Database['public']['Enums']['mrb_status'];

export default function MRBCommitteeReview() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { getMRBById, updateMRBStatus, getApprovalHistory } = useMRBDatabase();
  const { currentRole, canEdit } = useRole();
  const { userRole, profile } = useAuth();
  
  const [mrb, setMRB] = useState<MRBRecord | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'review' | 'print'>('review');
  
  // Print refs and state
  const iqcPrintRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>(loadPrinterSettings);
  const [previewContent, setPreviewContent] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  
  const [reviewData, setReviewData] = useState({
    decision: '',
    remarks: '',
  });
  
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      setIsLoading(true);
      
      const [mrbData, historyData] = await Promise.all([
        getMRBById(id),
        getApprovalHistory(id),
      ]);
      
      if (mrbData) {
        setMRB(mrbData);
      }
      
      setApprovalHistory(historyData);
      setIsLoading(false);
    };
    
    loadData();
  }, [id, getMRBById, getApprovalHistory]);

  const canReview = userRole === 'mrb_committee' || userRole === 'admin' || userRole === 'executive';

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateShort = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getDecisionDisplayName = (decision: string | null | undefined) => {
    if (!decision) return '-';
    const decisionMap: Record<string, string> = {
      accept: 'Accept',
      reject: 'Reject',
      partial_accept: 'Partial Accept',
      blocked: 'Blocked',
      use_as_is: 'Use As Is',
      use_with_deviation: 'Use With Deviation',
      rework_required: 'Rework Required',
      return_to_vendor: 'Return to Vendor',
      scrap_material: 'Scrap Material',
      approved: 'Approved',
    };
    return decisionMap[decision] || decision.replace(/_/g, ' ');
  };

  const handleOpenApprovalDialog = () => {
    if (!reviewData.decision) {
      toast({
        title: 'Validation Error',
        description: 'Please select a decision',
        variant: 'destructive',
      });
      return;
    }
    setShowApprovalDialog(true);
  };

  const handleSubmitReview = async () => {
    if (!mrb) return;
    
    setIsSubmitting(true);
    
    try {
      let newStatus: MRBStatus = 'final_approval';
      
      const additionalUpdates: Partial<MRBRecord> = {
        mrb_committee_decision: reviewData.decision,
        mrb_committee_remarks: reviewData.remarks,
        mrb_committee_approved_by: profile?.full_name || profile?.email || 'Unknown',
        mrb_committee_approved_at: new Date().toISOString(),
      };
      
      if (reviewData.decision === 'approve') {
        newStatus = 'approved';
        additionalUpdates.final_decision = 'approved';
        additionalUpdates.closure_status = 'completed';
        additionalUpdates.closed_at = new Date().toISOString();
      }
      
      const success = await updateMRBStatus(
        mrb.id,
        newStatus,
        reviewData.decision === 'approve' ? 'approved' : 'reviewed',
        `MRB Committee ${reviewData.decision}: ${reviewData.remarks || 'No comments'}`,
        additionalUpdates as any
      );
      
      if (success) {
        toast({
          title: 'MRB Committee Review Submitted',
          description: 'Your decision has been recorded successfully.',
        });
        navigate('/worklist');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit review',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setShowApprovalDialog(false);
    }
  };

  // Print functions
  const getPrintStyles = () => `
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10px; color: #000; line-height: 1.3; }
    .print-container { max-width: 210mm; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .header-left { text-align: center; flex: 1; }
    .header-left h1 { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
    .header-left p { font-size: 10px; color: #666; }
    .logo { height: 35px; }
    .title-bar { text-align: center; font-size: 14px; font-weight: bold; padding: 6px; border: 1px solid #000; border-bottom: 2px solid #000; background: #f5f5f5; margin-bottom: 8px; }
    .form-section { border: 1px solid #000; margin-bottom: 8px; }
    .form-row { display: flex; border-bottom: 1px solid #000; }
    .form-row:last-child { border-bottom: none; }
    .form-cell { padding: 4px 8px; border-right: 1px solid #000; min-height: 24px; display: flex; align-items: center; }
    .form-cell:last-child { border-right: none; }
    .form-cell.label { font-weight: normal; width: 120px; flex-shrink: 0; }
    .form-cell.value { flex: 1; font-weight: normal; }
    .section-header { font-weight: bold; padding: 4px 8px; border-bottom: 1px solid #000; background: #f9f9f9; }
    .decision-table { width: 100%; border-collapse: collapse; }
    .decision-table th, .decision-table td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
    .decision-table th { background: #f9f9f9; font-weight: bold; }
    .doc-footer { display: flex; justify-content: space-between; font-size: 9px; margin-top: 16px; padding-top: 8px; border-top: 1px solid #ccc; }
    .committee-decision { border: 2px solid #000; margin-top: 12px; padding: 8px; background: #f5f5f5; }
    .committee-decision h3 { font-size: 12px; font-weight: bold; margin-bottom: 8px; text-align: center; }
    .signature-row { display: flex; justify-content: space-between; margin-top: 16px; padding-top: 8px; }
    .signature-box { text-align: center; width: 30%; }
    .signature-line { border-bottom: 1px solid #000; height: 30px; margin-bottom: 4px; }
  `;

  const handlePrint = () => {
    if (!iqcPrintRef.current) return;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast({
        title: 'Print Blocked',
        description: 'Please allow popups to print the document.',
        variant: 'destructive'
      });
      return;
    }

    const title = `IQC MRB Committee Form - ${mrb?.mrb_number}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            ${getPrintStyles()}
            @page { size: A4 ${printerSettings.orientation}; margin: 10mm; }
            @media print { body { margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
            body { font-family: Arial, sans-serif; margin: 0; padding: 10px; background: white; }
          </style>
        </head>
        <body>
          ${iqcPrintRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 250);
    };

    setTimeout(() => {
      if (!printWindow.closed) {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }
    }, 1000);
  };

  const handleDownloadPDF = async () => {
    if (!iqcPrintRef.current) return;

    const filename = `IQC_MRB_Committee_${mrb?.mrb_number || 'MRB'}.pdf`;

    toast({ 
      title: 'Generating PDF', 
      description: 'Please wait while we generate your PDF...' 
    });

    try {
      const opt = {
        margin: [10, 10, 10, 10],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: printerSettings.orientation }
      };

      await html2pdf().set(opt).from(iqcPrintRef.current).save();
      
      toast({ 
        title: 'PDF Downloaded', 
        description: `${filename} has been downloaded successfully!` 
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ 
        title: 'PDF Error', 
        description: 'Failed to generate PDF. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handlePreview = () => {
    if (!iqcPrintRef.current) return;
    setPreviewContent(iqcPrintRef.current.innerHTML);
    setPreviewTitle(`IQC MRB Committee Form - ${mrb?.mrb_number || 'MRB'}`);
    setShowPreview(true);
  };

  // IQC Print Form Component
  const IQCMRBCommitteeForm = () => (
    <div ref={iqcPrintRef} className="max-w-[210mm] mx-auto bg-white text-black" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10px' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div className="text-center flex-1">
          <h1 className="text-base font-bold">HBL Power Systems Ltd.</h1>
          <p className="text-[10px] text-gray-600">Electronics Group</p>
        </div>
        <img src={hblLogo} alt="HBL Logo" className="h-8" />
      </div>

      {/* Title Bar */}
      <div className="text-center font-bold py-1.5 border border-black border-b-2 bg-gray-100 mb-2 text-sm">
        MRB COMMITTEE REVIEW FORM - INWARD MATERIAL (IQC)
      </div>

      {/* MRB & Material Info */}
      <div className="border border-black mb-2">
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black">MRB No.:</div>
          <div className="flex-1 px-2 py-1 border-r border-black font-medium">{mrb?.mrb_number}</div>
          <div className="w-28 px-2 py-1 border-r border-black">Date:</div>
          <div className="flex-1 px-2 py-1">{formatDateShort(mrb?.created_at)}</div>
        </div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black">Inspection Lot:</div>
          <div className="flex-1 px-2 py-1 border-r border-black font-medium">{mrb?.inspection_lot || '-'}</div>
          <div className="w-28 px-2 py-1 border-r border-black">GRN No:</div>
          <div className="flex-1 px-2 py-1 font-medium">{mrb?.grn_number || '-'}</div>
        </div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black">Material Code:</div>
          <div className="flex-1 px-2 py-1 font-medium">{mrb?.material_number}</div>
        </div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black">Description:</div>
          <div className="flex-1 px-2 py-1 font-medium">{mrb?.material_description}</div>
        </div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black">Vendor:</div>
          <div className="flex-1 px-2 py-1 border-r border-black font-medium">{mrb?.vendor_name || '-'}</div>
          <div className="w-28 px-2 py-1 border-r border-black">PO No:</div>
          <div className="flex-1 px-2 py-1 font-medium">{mrb?.po_number || '-'}</div>
        </div>
        <div className="flex">
          <div className="w-28 px-2 py-1 border-r border-black">Blocked Qty:</div>
          <div className="w-28 px-2 py-1 border-r border-black font-medium text-red-600">{mrb?.blocked_quantity} {mrb?.uom}</div>
          <div className="w-28 px-2 py-1 border-r border-black">Plant:</div>
          <div className="flex-1 px-2 py-1 font-medium">{mrb?.plant}</div>
        </div>
      </div>

      {/* Defect Details */}
      <div className="border border-black mb-2">
        <div className="px-2 py-1 border-b border-black font-bold bg-gray-50">Non-Conformance Details</div>
        <div className="p-2 min-h-[60px]">
          <p><strong>Defect Category:</strong> {mrb?.defect_category || 'N/A'}</p>
          <p><strong>Defect Code:</strong> {mrb?.defect_code || 'N/A'}</p>
          <p className="mt-1"><strong>Description:</strong> {mrb?.defect_description || mrb?.issue_description || 'N/A'}</p>
        </div>
      </div>

      {/* Department Decisions Table */}
      <div className="border border-black mb-2">
        <div className="px-2 py-1 border-b border-black font-bold bg-gray-50 text-center">DEPARTMENT DECISIONS SUMMARY</div>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="border border-black px-2 py-1 bg-gray-50 w-28">Department</th>
              <th className="border border-black px-2 py-1 bg-gray-50">Decision</th>
              <th className="border border-black px-2 py-1 bg-gray-50">Remarks</th>
              <th className="border border-black px-2 py-1 bg-gray-50 w-24">Date</th>
              <th className="border border-black px-2 py-1 bg-gray-50 w-20">Sign</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black px-2 py-2 font-medium">Quality</td>
              <td className="border border-black px-2 py-2">{getDecisionDisplayName(mrb?.quality_decision)}</td>
              <td className="border border-black px-2 py-2 text-[9px]">{mrb?.quality_remarks || '-'}</td>
              <td className="border border-black px-2 py-2 text-center">{formatDateShort(mrb?.quality_approved_at)}</td>
              <td className="border border-black px-2 py-2"></td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-2 font-medium">Engineering</td>
              <td className="border border-black px-2 py-2">{getDecisionDisplayName(mrb?.engineering_decision)}</td>
              <td className="border border-black px-2 py-2 text-[9px]">{mrb?.engineering_remarks || '-'}</td>
              <td className="border border-black px-2 py-2 text-center">{formatDateShort(mrb?.engineering_approved_at)}</td>
              <td className="border border-black px-2 py-2"></td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-2 font-medium">Purchase</td>
              <td className="border border-black px-2 py-2">{mrb?.purchase_action || '-'}</td>
              <td className="border border-black px-2 py-2 text-[9px]">{mrb?.purchase_remarks || '-'}</td>
              <td className="border border-black px-2 py-2 text-center">{formatDateShort(mrb?.purchase_approved_at)}</td>
              <td className="border border-black px-2 py-2"></td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-2 font-medium">Quality Head</td>
              <td className="border border-black px-2 py-2">{mrb?.final_decision || '-'}</td>
              <td className="border border-black px-2 py-2 text-[9px]">{mrb?.final_remarks || '-'}</td>
              <td className="border border-black px-2 py-2 text-center">{formatDateShort(mrb?.final_approved_at)}</td>
              <td className="border border-black px-2 py-2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* MRB Committee Decision Section */}
      <div className="border-2 border-black mb-2 bg-gray-50">
        <div className="px-2 py-1 border-b-2 border-black font-bold bg-gray-100 text-center text-[11px]">
          MRB COMMITTEE DECISION
        </div>
        <div className="p-3">
          <div className="mb-2">
            <strong>Committee Decision:</strong> 
            <span className="ml-2 px-2 py-0.5 border border-black bg-white">
              {mrb?.mrb_committee_decision ? getDecisionDisplayName(mrb.mrb_committee_decision) : '________________'}
            </span>
          </div>
          <div className="mb-2">
            <strong>Remarks:</strong>
            <div className="border border-black bg-white min-h-[40px] mt-1 p-1">
              {mrb?.mrb_committee_remarks || ''}
            </div>
          </div>
          <div className="flex justify-between mt-3">
            <span><strong>Approved By:</strong> {mrb?.mrb_committee_approved_by || '________________'}</span>
            <span><strong>Date:</strong> {formatDateShort(mrb?.mrb_committee_approved_at) || '________________'}</span>
          </div>
        </div>
      </div>

      {/* Final Disposition */}
      <div className="border border-black mb-2">
        <div className="px-2 py-1 border-b border-black font-bold bg-gray-50">Final Disposition</div>
        <div className="grid grid-cols-3 gap-4 p-2">
          {[
            { key: 'use_as_is', label: 'Use As Is' },
            { key: 'rework', label: 'Rework' },
            { key: 'return_to_vendor', label: 'Return to Vendor' },
            { key: 'scrap', label: 'Scrap' },
            { key: 'sort', label: 'Sort' },
            { key: 'others', label: 'Others' },
          ].map(item => {
            const finalDec = mrb?.mrb_committee_decision || mrb?.final_decision || mrb?.engineering_decision;
            const isChecked = finalDec?.toLowerCase().includes(item.key.replace(/_/g, '')) || 
                             (item.key === 'use_as_is' && finalDec === 'accept') ||
                             (item.key === 'scrap' && finalDec === 'reject');
            return (
              <div key={item.key} className="flex items-center gap-2">
                <div className={`w-3 h-3 border border-black ${isChecked ? 'bg-black' : ''}`}></div>
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Signature Row */}
      <div className="flex justify-between mt-4 pt-2">
        <div className="text-center w-[30%]">
          <div className="border-b border-black h-8 mb-1"></div>
          <span className="text-[9px]">MRB Committee Member</span>
        </div>
        <div className="text-center w-[30%]">
          <div className="border-b border-black h-8 mb-1"></div>
          <span className="text-[9px]">Quality Head</span>
        </div>
        <div className="text-center w-[30%]">
          <div className="border-b border-black h-8 mb-1"></div>
          <span className="text-[9px]">Plant Head</span>
        </div>
      </div>

      {/* Document Footer */}
      <div className="flex justify-between text-[9px] mt-4 pt-2 border-t border-gray-200">
        <span>Doc. No.: HBL/QA/MRB/IQC/001</span>
        <span>Rev: 01</span>
        <span>Effective Date: 01-Jan-2024</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading MRB details...</p>
        </div>
      </div>
    );
  }

  if (!mrb) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">MRB Not Found</h2>
          <Button onClick={() => navigate('/worklist')}>
            Go to Worklist
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-muted/30 flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/worklist"><ArrowLeft className="h-5 w-5" /></Link>
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <h1 className="text-xl font-bold text-foreground">
                    MRB Committee Review - {mrb.mrb_number}
                  </h1>
                  <Badge className={getStatusColor(mrb.status)}>
                    {getStatusDisplayName(mrb.status)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Inward Material MRB • Created on {formatDate(mrb.created_at)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6 flex-1 pb-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'review' | 'print')}>
          <TabsList>
            <TabsTrigger value="review" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Review & Decide
            </TabsTrigger>
            <TabsTrigger value="print" className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Print IQC Form
            </TabsTrigger>
          </TabsList>

          <TabsContent value="review" className="space-y-6 mt-4">
            {/* Workflow Progress */}
            <WorkflowProgressIndicator 
              currentStatus={mrb.status} 
              pendingWith={mrb.pending_with}
            />

            {/* MRB Details Summary */}
            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-border bg-muted/30 py-3">
                <CardTitle className="text-base font-semibold">MRB Details</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Inspection Lot</Label>
                    <p className="font-medium">{mrb.inspection_lot || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Material Code</Label>
                    <p className="font-medium font-mono">{mrb.material_number}</p>
                  </div>
                  <div className="space-y-1 lg:col-span-2">
                    <Label className="text-muted-foreground text-xs">Material Description</Label>
                    <p className="font-medium">{mrb.material_description}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Plant</Label>
                    <p className="font-medium">{mrb.plant}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Vendor</Label>
                    <p className="font-medium">{mrb.vendor_name || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Blocked Quantity</Label>
                    <p className="font-medium text-destructive">{mrb.blocked_quantity} {mrb.uom}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">PO Number</Label>
                    <p className="font-medium font-mono">{mrb.po_number || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* All Department Decisions */}
            <Card className="border-border shadow-sm border-primary/20">
              <CardHeader className="border-b border-border bg-primary/5 py-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  All Department Decisions
                </CardTitle>
                <CardDescription>Review all department decisions before making committee decision</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-4 font-semibold border-b">Department</th>
                        <th className="text-left p-4 font-semibold border-b">Decision</th>
                        <th className="text-left p-4 font-semibold border-b">Remarks</th>
                        <th className="text-left p-4 font-semibold border-b">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="p-4 font-medium">Quality</td>
                        <td className="p-4">
                          <Badge variant="outline" className="capitalize">
                            {getDecisionDisplayName(mrb.quality_decision)}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm max-w-xs">{mrb.quality_remarks || '-'}</td>
                        <td className="p-4 text-sm">{formatDate(mrb.quality_approved_at)}</td>
                      </tr>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="p-4 font-medium">Engineering</td>
                        <td className="p-4">
                          <Badge variant="outline" className="capitalize">
                            {getDecisionDisplayName(mrb.engineering_decision)}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm max-w-xs">{mrb.engineering_remarks || '-'}</td>
                        <td className="p-4 text-sm">{formatDate(mrb.engineering_approved_at)}</td>
                      </tr>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="p-4 font-medium">Purchase</td>
                        <td className="p-4">
                          <Badge variant="outline" className="capitalize">
                            {mrb.purchase_action || '-'}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm max-w-xs">{mrb.purchase_remarks || '-'}</td>
                        <td className="p-4 text-sm">{formatDate(mrb.purchase_approved_at)}</td>
                      </tr>
                      <tr className="hover:bg-muted/30">
                        <td className="p-4 font-medium">Quality Head / Plant Head</td>
                        <td className="p-4">
                          <Badge variant="outline" className="capitalize">
                            {mrb.final_decision || '-'}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm max-w-xs">{mrb.final_remarks || '-'}</td>
                        <td className="p-4 text-sm">{formatDate(mrb.final_approved_at)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Approval History */}
            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-border bg-muted/30 py-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Approval History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {approvalHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">No history yet</p>
                ) : (
                  <div className="space-y-4">
                    {approvalHistory.map((item, index) => (
                      <div key={item.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <CheckCircle className="h-4 w-4 text-primary" />
                          </div>
                          {index < approvalHistory.length - 1 && (
                            <div className="w-0.5 h-full bg-border mt-2" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{item.stage}</p>
                            <Badge variant="outline" className="text-xs capitalize">
                              {item.action}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            by <span className="font-medium text-foreground">{(item as any).performer_name || 'Unknown'}</span>
                            {' '}({getRoleDisplayName(item.performed_by_role as any)})
                            {' • '}{formatDate(item.performed_at)}
                          </p>
                          {item.remarks && (
                            <p className="text-sm mt-1 bg-muted/50 p-2 rounded">{item.remarks}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Committee Decision Form */}
            {canReview && mrb.status !== 'approved' && mrb.status !== 'rejected' && mrb.status !== 'closed' && (
              <>
                <Separator />
                <Card className="border-border shadow-sm border-amber-500/30 bg-amber-50/30">
                  <CardHeader className="border-b border-border bg-amber-100/50 py-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-amber-600" />
                      MRB Committee Decision
                    </CardTitle>
                    <CardDescription>Make the final committee decision based on all department inputs</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>
                          Committee Decision <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={reviewData.decision}
                          onValueChange={(value) => setReviewData({ ...reviewData, decision: value })}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select Decision" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border z-50">
                            <SelectItem value="approve">Approve - Accept Material</SelectItem>
                            <SelectItem value="use_as_is">Use As Is</SelectItem>
                            <SelectItem value="use_with_deviation">Use With Deviation</SelectItem>
                            <SelectItem value="rework_required">Rework Required</SelectItem>
                            <SelectItem value="return_to_vendor">Return to Vendor</SelectItem>
                            <SelectItem value="scrap_material">Scrap Material</SelectItem>
                            <SelectItem value="reject">Reject Material</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Committee Remarks</Label>
                      <Textarea
                        value={reviewData.remarks}
                        onChange={(e) => setReviewData({ ...reviewData, remarks: e.target.value })}
                        placeholder="Enter committee decision remarks and justification..."
                        rows={4}
                        className="bg-background resize-none"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button 
                        onClick={handleOpenApprovalDialog}
                        className="gap-2"
                        disabled={isSubmitting}
                      >
                        <Send className="h-4 w-4" />
                        Submit Committee Decision
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="print" className="space-y-6 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      IQC MRB Committee Form
                    </CardTitle>
                    <CardDescription>Print or download the MRB Committee form for Inward Materials</CardDescription>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={handlePreview} variant="outline" className="gap-2">
                      <Eye className="h-4 w-4" />
                      Preview
                    </Button>
                    <Button onClick={() => setShowSettings(true)} variant="outline" size="icon" title="Printer Settings">
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button onClick={handlePrint} className="gap-2">
                      <Printer className="h-4 w-4" />
                      Print
                    </Button>
                    <Button onClick={handleDownloadPDF} variant="secondary" className="gap-2">
                      <Download className="h-4 w-4" />
                      Download PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="bg-white p-8 border rounded-lg overflow-auto">
                <IQCMRBCommitteeForm />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Approval Confirmation Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Committee Decision</DialogTitle>
            <DialogDescription>
              You are about to submit the MRB Committee decision for {mrb.mrb_number}.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Decision</Label>
                <p className="font-medium capitalize">{reviewData.decision?.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Submitted By</Label>
                <p className="font-medium">{profile?.full_name || profile?.email}</p>
              </div>
            </div>
            {reviewData.remarks && (
              <div>
                <Label className="text-muted-foreground">Remarks</Label>
                <p className="text-sm mt-1 bg-muted p-2 rounded">{reviewData.remarks}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitReview} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Confirm Decision'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Preview Modal */}
      <PrintPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        content={previewContent}
        title={previewTitle}
        styles={getPrintStyles()}
        orientation={printerSettings.orientation}
        onPrint={() => { handlePrint(); setShowPreview(false); }}
        onDownloadPDF={() => { handleDownloadPDF(); setShowPreview(false); }}
      />

      {/* Printer Settings Modal */}
      <PrinterSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={printerSettings}
        onSave={setPrinterSettings}
      />
    </div>
  );
}
