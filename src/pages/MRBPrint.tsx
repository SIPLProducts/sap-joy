import { useState, useRef, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
import { Search, Printer, Download, FileText, ClipboardCheck, Eye, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { PrintPreviewModal } from '@/components/print/PrintPreviewModal';
import { PrinterSettingsModal, loadPrinterSettings, type PrinterSettings } from '@/components/print/PrinterSettingsModal';
import hblLogo from '@/assets/hbl-logo.png';
import { usePrintConfig } from '@/hooks/usePlantConfig';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type MRBRecord = Database['public']['Tables']['mrb_records']['Row'];

interface ApproverInfo {
  quality?: string;
  purchase?: string;
  engineering?: string;
  final?: string;
  committee?: string;
}

interface ApprovalHistoryEntry {
  stage: string;
  action: string;
  performed_by: string;
  performed_at: string;
  remarks: string | null;
  performed_by_role: string;
}

const MRBPrint = () => {
  const { toast } = useToast();
  const ncrPrintRef = useRef<HTMLDivElement>(null);
  const mrbPrintRef = useRef<HTMLDivElement>(null);

  const [mrbList, setMrbList] = useState<{ id: string; mrb_number: string; material_description: string }[]>([]);
  const [searchNumber, setSearchNumber] = useState('');
  const [selectedMRBId, setSelectedMRBId] = useState<string>('');
  const [selectedMRB, setSelectedMRB] = useState<MRBRecord | null>(null);
  const [approverNames, setApproverNames] = useState<ApproverInfo>({});
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [activeForm, setActiveForm] = useState<'ncr' | 'mrb'>('ncr');

  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>(loadPrinterSettings);
  const [previewSourceElement, setPreviewSourceElement] = useState<HTMLDivElement | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');

  // Load MRB list for dropdown
  useEffect(() => {
    const loadMRBList = async () => {
      const { data } = await supabase
        .from('mrb_records')
        .select('id, mrb_number, material_description')
        .order('created_at', { ascending: false });
      if (data) setMrbList(data);
    };
    loadMRBList();
  }, []);

  // Fetch full MRB record + approver names + history
  const fetchMRBFromDB = async (id: string) => {
    try {
      const [mrbRes, historyRes] = await Promise.all([
        supabase.from('mrb_records').select('*').eq('id', id).maybeSingle(),
        supabase.from('mrb_approval_history').select('*').eq('mrb_id', id).order('performed_at', { ascending: true }),
      ]);

      if (mrbRes.error) throw mrbRes.error;
      const mrb = mrbRes.data;
      if (!mrb) return;

      setSelectedMRB(mrb);
      setSelectedMRBId(mrb.id);
      setSearchNumber(mrb.mrb_number);
      setApprovalHistory((historyRes.data || []) as ApprovalHistoryEntry[]);

      // Fetch approver profile names
      const approverIds = [
        mrb.quality_approved_by,
        mrb.purchase_approved_by,
        mrb.engineering_approved_by,
        mrb.final_approved_by,
      ].filter(Boolean) as string[];

      const names: ApproverInfo = {};
      if (approverIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', approverIds);

        const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
        names.quality = profileMap.get(mrb.quality_approved_by || '') || '';
        names.purchase = profileMap.get(mrb.purchase_approved_by || '') || '';
        names.engineering = profileMap.get(mrb.engineering_approved_by || '') || '';
        names.final = profileMap.get(mrb.final_approved_by || '') || '';
      }
      names.committee = mrb.mrb_committee_approved_by || '';
      setApproverNames(names);

      toast({ title: 'MRB Loaded', description: `Loaded ${mrb.mrb_number} with all data` });
    } catch (error) {
      console.error('Error fetching MRB:', error);
      toast({ title: 'Error', description: 'Failed to fetch MRB data', variant: 'destructive' });
    }
  };

  const handleSearch = async () => {
    if (!searchNumber.trim()) return;
    const { data } = await supabase
      .from('mrb_records')
      .select('id')
      .ilike('mrb_number', searchNumber.trim())
      .maybeSingle();
    if (data) {
      fetchMRBFromDB(data.id);
    } else {
      toast({ title: 'MRB Not Found', description: 'No MRB found with the entered number', variant: 'destructive' });
    }
  };

  const handleSelectMRB = (id: string) => {
    fetchMRBFromDB(id);
  };

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
    .nc-section { border: 1px solid #000; margin-bottom: 8px; }
    .nc-header { font-weight: bold; padding: 4px 8px; border-bottom: 1px solid #000; background: #f9f9f9; }
    .nc-content { min-height: 80px; padding: 8px; }
    .nc-footer { display: flex; justify-content: space-between; padding: 4px 8px; border-top: 1px solid #000; }
    .mrb-check { text-align: center; padding: 8px; font-weight: bold; border: 1px solid #000; margin-bottom: 8px; }
    .instructions-section { border: 1px solid #000; margin-bottom: 8px; }
    .instructions-title { text-align: center; font-weight: bold; padding: 6px; border-bottom: 1px solid #000; background: #f5f5f5; }
    .instructions-table { width: 100%; border-collapse: collapse; }
    .instructions-table th, .instructions-table td { border: 1px solid #000; padding: 4px 8px; text-align: left; }
    .instructions-table th { background: #f9f9f9; font-weight: bold; text-align: center; }
    .disposition-section { border: 1px solid #000; margin-bottom: 8px; }
    .disposition-header { font-weight: bold; padding: 4px 8px; border-bottom: 1px solid #000; background: #f5f5f5; }
    .disposition-options { display: grid; grid-template-columns: 1fr 1fr 1fr; padding: 8px; }
    .disposition-item { display: flex; align-items: center; gap: 6px; padding: 4px 0; }
    .checkbox { width: 12px; height: 12px; border: 1px solid #000; display: inline-block; }
    .checkbox.checked { background: #000; position: relative; }
    .checkbox.checked::after { content: '✓'; color: #fff; font-size: 10px; position: absolute; top: -2px; left: 1px; }
    .approvals-section { border: 1px solid #000; margin-bottom: 8px; }
    .approvals-header { font-weight: bold; padding: 4px 8px; border-bottom: 1px solid #000; background: #f5f5f5; }
    .approvals-table { width: 100%; border-collapse: collapse; }
    .approvals-table th, .approvals-table td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
    .approvals-table th { background: #f9f9f9; font-weight: bold; }
    .ncr-status { border: 1px solid #000; margin-bottom: 8px; padding: 8px; }
    .ncr-status-header { font-weight: bold; margin-bottom: 6px; }
    .ncr-status-comments { border-bottom: 1px dotted #000; min-height: 40px; margin-bottom: 8px; padding: 4px; }
    .ncr-status-boxes { display: flex; gap: 16px; }
    .status-box { border: 1px solid #000; padding: 4px 16px; font-weight: bold; }
    .status-box.active { background: #e0e0e0; }
    .doc-footer { display: flex; justify-content: space-between; font-size: 9px; margin-top: 16px; padding-top: 8px; border-top: 1px solid #ccc; }
  `;

  const handlePrint = (formType: 'ncr' | 'mrb', orientation: 'portrait' | 'landscape' = 'portrait') => {
    const printRef = formType === 'ncr' ? ncrPrintRef : mrbPrintRef;
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast({ title: 'Print Blocked', description: 'Please allow popups to print.', variant: 'destructive' });
      return;
    }
    const title = formType === 'ncr' ? `NCR Report - ${selectedMRB?.mrb_number}` : `MRB Form - ${selectedMRB?.mrb_number}`;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${getPrintStyles()}@page{size:A4 ${orientation};margin:10mm;}@media print{body{margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}}body{font-family:Arial,sans-serif;margin:0;padding:10px;background:white;}</style></head><body>${printRef.current.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.onload = () => { setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 250); };
    setTimeout(() => { if (!printWindow.closed) { printWindow.focus(); printWindow.print(); printWindow.close(); } }, 1000);
  };

  const handleDownloadPDF = async (formType: 'ncr' | 'mrb', orientation: 'portrait' | 'landscape' = 'portrait') => {
    const printRef = formType === 'ncr' ? ncrPrintRef : mrbPrintRef;
    if (!printRef.current) return;
    const filename = formType === 'ncr' ? `NCR_Report_${selectedMRB?.mrb_number || 'MRB'}.pdf` : `MRB_Form_${selectedMRB?.mrb_number || 'MRB'}.pdf`;
    toast({ title: 'Generating PDF', description: 'Please wait...' });
    try {
      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation }
      }).from(printRef.current).save();
      toast({ title: 'PDF Downloaded', description: `${filename} downloaded!` });
    } catch (error) {
      console.error('PDF error:', error);
      toast({ title: 'PDF Error', description: 'Failed to generate PDF.', variant: 'destructive' });
    }
  };

  const handlePreview = (formType: 'ncr' | 'mrb') => {
    const printRef = formType === 'ncr' ? ncrPrintRef : mrbPrintRef;
    if (!printRef.current) return;
    const title = formType === 'ncr' ? `NCR Report - ${selectedMRB?.mrb_number}` : `MRB Form - ${selectedMRB?.mrb_number}`;
    setPreviewContent(printRef.current.innerHTML);
    setPreviewTitle(title);
    setShowPreview(true);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getDecisionDisplayName = (decision: string | null | undefined) => {
    if (!decision) return '';
    const map: Record<string, string> = {
      accept: 'Accept', reject: 'Reject', partial_accept: 'Partial Accept', blocked: 'Blocked',
      use_as_is: 'Use As Is', use_with_deviation: 'Use With Deviation', rework_required: 'Rework Required',
      return_to_vendor: 'Return to Vendor', scrap_material: 'Scrap Material', approved: 'Approved', rejected: 'Rejected',
    };
    return map[decision] || decision;
  };

  const getDispositionChecked = (decision: string | null | undefined) => ({
    use_as_is: decision === 'use_as_is' || decision === 'accept' || decision === 'approved',
    sort: false,
    return_to_vendor: decision === 'return_to_vendor',
    rework: decision === 'rework_required',
    scrap: decision === 'scrap_material' || decision === 'reject' || decision === 'rejected',
    others: decision === 'use_with_deviation' || decision === 'partial_accept',
  });

  const { config: printConfig } = usePrintConfig(selectedMRB?.plant || '');

  // NCR (IQC) Report
  const NCRReport = () => (
    <div ref={ncrPrintRef} className="max-w-[210mm] mx-auto bg-white text-black" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10px' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div className="text-center flex-1">
          <h1 className="text-base font-bold">{printConfig?.company_name || 'HBL Power Systems Ltd.'}</h1>
          <p className="text-[10px] text-gray-600">{printConfig?.division_name || 'Electronics Group'}</p>
        </div>
        <img src={hblLogo} alt="HBL Logo" className="h-8" />
      </div>

      <div className="text-center font-bold py-1.5 border border-black border-b-2 bg-gray-100 mb-2 text-sm">
        NON-CONFORMANCE REPORT (IQC)
      </div>

      {/* GRN & NC Report Info */}
      <div className="border border-black mb-2">
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">GRN No.:</div>
          <div className="flex-1 px-2 py-1 border-r border-black font-medium">{selectedMRB?.grn_number || '—'}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">NC Report No:</div>
          <div className="flex-1 px-2 py-1 font-medium">{selectedMRB?.mrb_number}</div>
        </div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">GRN Date:</div>
          <div className="flex-1 px-2 py-1 border-r border-black">{formatDate(selectedMRB?.created_at)}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">NC Report Date:</div>
          <div className="flex-1 px-2 py-1">{formatDate(selectedMRB?.quality_approved_at || selectedMRB?.created_at)}</div>
        </div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Inspection Lot:</div>
          <div className="flex-1 px-2 py-1 border-r border-black font-medium">{selectedMRB?.inspection_lot || '—'}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Source:</div>
          <div className="flex-1 px-2 py-1 font-medium">{selectedMRB?.source === 'shop_floor' ? 'Shop Floor' : 'Quality Inspection'}</div>
        </div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Supplier Name:</div>
          <div className="flex-1 px-2 py-1 font-medium">{selectedMRB?.vendor_name || '—'}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Vendor Code:</div>
          <div className="flex-1 px-2 py-1 font-medium">{selectedMRB?.vendor_code || '—'}</div>
        </div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">P.O. No.:</div>
          <div className="flex-1 px-2 py-1 border-r border-black font-medium">{selectedMRB?.po_number || '—'}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Item Code:</div>
          <div className="flex-1 px-2 py-1 font-medium">{selectedMRB?.material_number}</div>
        </div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Item Desc.:</div>
          <div className="flex-1 px-2 py-1 font-medium">{selectedMRB?.material_description}</div>
        </div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Plant:</div>
          <div className="flex-1 px-2 py-1 font-medium">{selectedMRB?.plant}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">UOM:</div>
          <div className="flex-1 px-2 py-1 font-medium">{selectedMRB?.uom || 'EA'}</div>
        </div>
        <div className="flex">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Total Qty:</div>
          <div className="flex-1 px-2 py-1 border-r border-black font-medium">{selectedMRB?.total_quantity} {selectedMRB?.uom}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Accepted Qty:</div>
          <div className="flex-1 px-2 py-1 border-r border-black font-medium">{selectedMRB?.accepted_quantity ?? 0}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Rejected Qty:</div>
          <div className="flex-1 px-2 py-1 border-r border-black font-medium">{selectedMRB?.rejected_quantity ?? 0}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Blocked Qty:</div>
          <div className="flex-1 px-2 py-1 font-medium">{selectedMRB?.blocked_quantity ?? 0}</div>
        </div>
      </div>

      {/* Quality Decision */}
      <div className="border border-black mb-2">
        <div className="px-2 py-1 border-b border-black font-bold bg-gray-50 text-[10px]">Quality Decision</div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Decision:</div>
          <div className="flex-1 px-2 py-1 font-medium">{getDecisionDisplayName(selectedMRB?.quality_decision)}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Approved By:</div>
          <div className="flex-1 px-2 py-1 font-medium">{approverNames.quality || '—'}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Date:</div>
          <div className="flex-1 px-2 py-1">{formatDate(selectedMRB?.quality_approved_at)}</div>
        </div>
        <div className="px-2 py-1">
          <span className="text-[9px] font-bold">Remarks: </span>
          <span>{selectedMRB?.quality_remarks || '—'}</span>
        </div>
      </div>

      {/* Non-Conformance Details */}
      <div className="border border-black mb-2">
        <div className="px-2 py-1 border-b border-black font-bold bg-gray-50 text-[10px]">Non-Conformance Details</div>
        <div className="p-2 text-[10px] space-y-1">
          <div className="flex gap-8">
            <span><strong>Defect Category:</strong> {selectedMRB?.defect_category || '—'}</span>
            <span><strong>Defect Code:</strong> {selectedMRB?.defect_code || '—'}</span>
          </div>
          <p><strong>Description:</strong> {selectedMRB?.defect_description || selectedMRB?.quality_remarks || '—'}</p>
          {selectedMRB?.source === 'shop_floor' && (
            <>
              <p><strong>Issue Identified By:</strong> {selectedMRB?.issue_identified_by || '—'}</p>
              <p><strong>Issue Description:</strong> {selectedMRB?.issue_description || '—'}</p>
              <p><strong>Impact on Production:</strong> {selectedMRB?.impact_on_production || '—'}</p>
              <p><strong>Production Order:</strong> {selectedMRB?.production_order_number || '—'}</p>
            </>
          )}
        </div>
      </div>

      {/* Engineering & Purchase Decisions */}
      <div className="border border-black mb-2">
        <div className="px-2 py-1 border-b border-black font-bold bg-gray-50 text-[10px]">Engineering Decision</div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Decision:</div>
          <div className="flex-1 px-2 py-1 font-medium">{getDecisionDisplayName(selectedMRB?.engineering_decision)}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Approved By:</div>
          <div className="flex-1 px-2 py-1 font-medium">{approverNames.engineering || '—'}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Date:</div>
          <div className="flex-1 px-2 py-1">{formatDate(selectedMRB?.engineering_approved_at)}</div>
        </div>
        <div className="px-2 py-1 border-b border-black">
          <span className="text-[9px] font-bold">Remarks: </span><span>{selectedMRB?.engineering_remarks || '—'}</span>
        </div>
        <div className="px-2 py-1">
          <span className="text-[9px] font-bold">Technical Ref: </span><span>{selectedMRB?.technical_reference_number || '—'}</span>
        </div>
      </div>

      <div className="border border-black mb-2">
        <div className="px-2 py-1 border-b border-black font-bold bg-gray-50 text-[10px]">Purchase Decision</div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Action:</div>
          <div className="flex-1 px-2 py-1 font-medium">{selectedMRB?.purchase_action || '—'}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Approved By:</div>
          <div className="flex-1 px-2 py-1 font-medium">{approverNames.purchase || '—'}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Date:</div>
          <div className="flex-1 px-2 py-1">{formatDate(selectedMRB?.purchase_approved_at)}</div>
        </div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Vendor Resp.:</div>
          <div className="flex-1 px-2 py-1">{selectedMRB?.vendor_responsibility || '—'}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Replacement:</div>
          <div className="flex-1 px-2 py-1">{selectedMRB?.vendor_replacement_required ? 'Yes' : 'No'}</div>
        </div>
        <div className="px-2 py-1">
          <span className="text-[9px] font-bold">Remarks: </span><span>{selectedMRB?.purchase_remarks || '—'}</span>
        </div>
      </div>

      {/* Final Decision */}
      <div className="border border-black mb-2">
        <div className="px-2 py-1 border-b border-black font-bold bg-gray-50 text-[10px]">Final Decision</div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Decision:</div>
          <div className="flex-1 px-2 py-1 font-bold">{getDecisionDisplayName(selectedMRB?.final_decision)}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Approved By:</div>
          <div className="flex-1 px-2 py-1 font-medium">{approverNames.final || '—'}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Date:</div>
          <div className="flex-1 px-2 py-1">{formatDate(selectedMRB?.final_approved_at)}</div>
        </div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Final Acc Qty:</div>
          <div className="flex-1 px-2 py-1">{selectedMRB?.final_approved_quantity ?? '—'}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Final Rej Qty:</div>
          <div className="flex-1 px-2 py-1">{selectedMRB?.final_rejected_quantity ?? '—'}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Deviation No:</div>
          <div className="flex-1 px-2 py-1">{selectedMRB?.deviation_approval_number || '—'}</div>
        </div>
        <div className="px-2 py-1">
          <span className="text-[9px] font-bold">Remarks: </span><span>{selectedMRB?.final_remarks || '—'}</span>
        </div>
      </div>

      {/* SAP Status */}
      <div className="border border-black mb-2">
        <div className="flex">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px] font-bold">Status:</div>
          <div className="flex-1 px-2 py-1 font-bold uppercase">{selectedMRB?.status}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px] font-bold">SAP Sync:</div>
          <div className="flex-1 px-2 py-1 font-medium">{selectedMRB?.sap_stock_update_status || 'pending'}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px] font-bold">Closure:</div>
          <div className="flex-1 px-2 py-1 font-medium">{selectedMRB?.closure_status || 'open'}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between text-[9px] mt-4 pt-2 border-t border-gray-200">
        <span>Doc. No.: {printConfig?.ncr_doc_number || 'HBL/QA/NCR/001'}</span>
        <span>Rev: {printConfig?.ncr_revision || '02'}</span>
        <span>Effective Date: {printConfig?.ncr_effective_date || '01-Jan-2024'}</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  );

  // MRB Committee Form
  const MRBCommitteeForm = () => (
    <div ref={mrbPrintRef} className="max-w-[210mm] mx-auto bg-white text-black" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10px' }}>
      <div className="text-center py-2 border border-black mb-2 font-bold">
        Material Review Board (If applicable) <span className="underline">{selectedMRB?.mrb_committee_required ? 'Yes' : 'No'}</span>
        <div className="text-[9px] font-normal mt-1">MRB Number: {selectedMRB?.mrb_number}</div>
      </div>

      {/* Material Summary */}
      <div className="border border-black mb-2">
        <div className="px-2 py-1 border-b border-black font-bold bg-gray-50 text-[10px]">Material Summary</div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Material:</div>
          <div className="flex-1 px-2 py-1 font-medium">{selectedMRB?.material_number} - {selectedMRB?.material_description}</div>
        </div>
        <div className="flex border-b border-black">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Vendor:</div>
          <div className="flex-1 px-2 py-1">{selectedMRB?.vendor_name || '—'} ({selectedMRB?.vendor_code || '—'})</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Plant:</div>
          <div className="flex-1 px-2 py-1">{selectedMRB?.plant}</div>
        </div>
        <div className="flex">
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Total Qty:</div>
          <div className="flex-1 px-2 py-1">{selectedMRB?.total_quantity} {selectedMRB?.uom}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">Blocked Qty:</div>
          <div className="flex-1 px-2 py-1">{selectedMRB?.blocked_quantity ?? 0}</div>
          <div className="w-28 px-2 py-1 border-r border-black text-[9px]">P.O.:</div>
          <div className="flex-1 px-2 py-1">{selectedMRB?.po_number || '—'}</div>
        </div>
      </div>

      {/* Detailed Instructions */}
      <div className="border border-black mb-2">
        <div className="text-center font-bold py-1 border-b border-black bg-gray-100 text-[10px]">
          DETAILED INSTRUCTIONS OF MRB
        </div>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="border border-black px-2 py-1 bg-gray-50 w-10 text-center text-[9px]">S.No.</th>
              <th className="border border-black px-2 py-1 bg-gray-50 text-[9px]">Department</th>
              <th className="border border-black px-2 py-1 bg-gray-50 text-[9px]">Decision / Remarks</th>
              <th className="border border-black px-2 py-1 bg-gray-50 w-28 text-center text-[9px]">Name</th>
              <th className="border border-black px-2 py-1 bg-gray-50 w-24 text-center text-[9px]">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black px-2 py-2 text-center">1</td>
              <td className="border border-black px-2 py-2">Quality</td>
              <td className="border border-black px-2 py-2">{getDecisionDisplayName(selectedMRB?.quality_decision)}{selectedMRB?.quality_remarks ? ` — ${selectedMRB.quality_remarks}` : ''}</td>
              <td className="border border-black px-2 py-2 text-center">{approverNames.quality || ''}</td>
              <td className="border border-black px-2 py-2 text-center">{formatDate(selectedMRB?.quality_approved_at)}</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-2 text-center">2</td>
              <td className="border border-black px-2 py-2">Engineering</td>
              <td className="border border-black px-2 py-2">{getDecisionDisplayName(selectedMRB?.engineering_decision)}{selectedMRB?.engineering_remarks ? ` — ${selectedMRB.engineering_remarks}` : ''}</td>
              <td className="border border-black px-2 py-2 text-center">{approverNames.engineering || ''}</td>
              <td className="border border-black px-2 py-2 text-center">{formatDate(selectedMRB?.engineering_approved_at)}</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-2 text-center">3</td>
              <td className="border border-black px-2 py-2">Purchase</td>
              <td className="border border-black px-2 py-2">{selectedMRB?.purchase_action || ''}{selectedMRB?.purchase_remarks ? ` — ${selectedMRB.purchase_remarks}` : ''}</td>
              <td className="border border-black px-2 py-2 text-center">{approverNames.purchase || ''}</td>
              <td className="border border-black px-2 py-2 text-center">{formatDate(selectedMRB?.purchase_approved_at)}</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-2 text-center">4</td>
              <td className="border border-black px-2 py-2">Final Approval</td>
              <td className="border border-black px-2 py-2">{getDecisionDisplayName(selectedMRB?.final_decision)}{selectedMRB?.final_remarks ? ` — ${selectedMRB.final_remarks}` : ''}</td>
              <td className="border border-black px-2 py-2 text-center">{approverNames.final || ''}</td>
              <td className="border border-black px-2 py-2 text-center">{formatDate(selectedMRB?.final_approved_at)}</td>
            </tr>
            {selectedMRB?.mrb_committee_decision && (
              <tr>
                <td className="border border-black px-2 py-2 text-center">5</td>
                <td className="border border-black px-2 py-2">MRB Committee</td>
                <td className="border border-black px-2 py-2">{selectedMRB.mrb_committee_decision}{selectedMRB?.mrb_committee_remarks ? ` — ${selectedMRB.mrb_committee_remarks}` : ''}</td>
                <td className="border border-black px-2 py-2 text-center">{approverNames.committee || ''}</td>
                <td className="border border-black px-2 py-2 text-center">{formatDate(selectedMRB?.mrb_committee_approved_at)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Disposition */}
      <div className="border border-black mb-2">
        <div className="px-2 py-1 border-b border-black font-bold bg-gray-50 text-[10px]">Disposition of NC Material</div>
        <div className="grid grid-cols-3 gap-4 p-2">
          {(() => {
            const checked = getDispositionChecked(selectedMRB?.final_decision || selectedMRB?.engineering_decision);
            return (
              <>
                <div className="flex items-center gap-2"><div className={`w-3 h-3 border border-black ${checked.use_as_is ? 'bg-black' : ''}`} /><span>Use As Is</span></div>
                <div className="flex items-center gap-2"><div className={`w-3 h-3 border border-black ${checked.sort ? 'bg-black' : ''}`} /><span>Sort</span></div>
                <div className="flex items-center gap-2"><div className={`w-3 h-3 border border-black ${checked.return_to_vendor ? 'bg-black' : ''}`} /><span>Return to Vendor</span></div>
                <div className="flex items-center gap-2"><div className={`w-3 h-3 border border-black ${checked.rework ? 'bg-black' : ''}`} /><span>Rework</span></div>
                <div className="flex items-center gap-2"><div className={`w-3 h-3 border border-black ${checked.scrap ? 'bg-black' : ''}`} /><span>Scrap</span></div>
                <div className="flex items-center gap-2"><div className={`w-3 h-3 border border-black ${checked.others ? 'bg-black' : ''}`} /><span>Others</span></div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Approval History */}
      {approvalHistory.length > 0 && (
        <div className="border border-black mb-2">
          <div className="px-2 py-1 border-b border-black font-bold bg-gray-50 text-[10px]">Approval History</div>
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="border border-black px-2 py-1 bg-gray-50 text-[9px]">Stage</th>
                <th className="border border-black px-2 py-1 bg-gray-50 text-[9px]">Action</th>
                <th className="border border-black px-2 py-1 bg-gray-50 text-[9px]">Role</th>
                <th className="border border-black px-2 py-1 bg-gray-50 text-[9px]">Date</th>
                <th className="border border-black px-2 py-1 bg-gray-50 text-[9px]">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {approvalHistory.map((h, i) => (
                <tr key={i}>
                  <td className="border border-black px-2 py-1 text-[9px]">{h.stage}</td>
                  <td className="border border-black px-2 py-1 text-[9px] capitalize">{h.action}</td>
                  <td className="border border-black px-2 py-1 text-[9px]">{h.performed_by_role}</td>
                  <td className="border border-black px-2 py-1 text-[9px]">{formatDate(h.performed_at)}</td>
                  <td className="border border-black px-2 py-1 text-[9px]">{h.remarks || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* NCR Status */}
      <div className="border border-black mb-2 p-2">
        <div className="font-bold mb-1 text-[10px]">NCR Close out comments:</div>
        <div className="min-h-[30px] border-b border-dotted border-black mb-2 p-1 text-[10px]">
          {selectedMRB?.final_remarks || selectedMRB?.mrb_committee_remarks || ''}
        </div>
        <div className="flex gap-4">
          <div className={`border border-black px-4 py-1 font-bold text-[10px] ${selectedMRB?.status === 'closed' || selectedMRB?.status === 'approved' ? 'bg-gray-200' : ''}`}>CLOSED</div>
          <div className={`border border-black px-4 py-1 font-bold text-[10px] ${selectedMRB?.status !== 'closed' && selectedMRB?.status !== 'approved' ? 'bg-gray-200' : ''}`}>OPEN</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between text-[9px] mt-4 pt-2 border-t border-gray-200">
        <span>Doc. No.: {printConfig?.mrb_doc_number || 'HBL/QA/MRB/001'}</span>
        <span>Rev: {printConfig?.mrb_revision || '02'}</span>
        <span>Effective Date: {printConfig?.mrb_effective_date || '01-Jan-2024'}</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            MRB Print Forms
          </CardTitle>
          <CardDescription>
            Generate HBL standard Non-Conformance Report and MRB Committee forms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Search by MRB Number</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter MRB Number"
                  value={searchNumber}
                  onChange={(e) => setSearchNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} variant="secondary">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Or Select from List</Label>
              <Select value={selectedMRBId} onValueChange={handleSelectMRB}>
                <SelectTrigger>
                  <SelectValue placeholder="Select MRB" />
                </SelectTrigger>
                <SelectContent>
                  {mrbList.map((mrb) => (
                    <SelectItem key={mrb.id} value={mrb.id}>
                      {mrb.mrb_number} - {mrb.material_description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Print Forms */}
      {selectedMRB && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Print Forms - {selectedMRB.mrb_number}</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeForm} onValueChange={(v) => setActiveForm(v as 'ncr' | 'mrb')}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <TabsList>
                  <TabsTrigger value="ncr" className="flex items-center gap-1.5 text-xs sm:text-sm">
                    <FileText className="h-3.5 w-3.5" />
                    NCR Report
                  </TabsTrigger>
                  <TabsTrigger value="mrb" className="flex items-center gap-1.5 text-xs sm:text-sm">
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    MRB Form
                  </TabsTrigger>
                </TabsList>

                <div className="flex gap-1.5 flex-wrap items-center">
                  <Button onClick={() => handlePreview(activeForm)} variant="outline" size="sm" className="gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </Button>
                  <Button onClick={() => setShowSettings(true)} variant="outline" size="sm" className="h-8 w-8 p-0" title="Printer Settings">
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                  <Button onClick={() => handlePrint(activeForm, printerSettings.orientation)} size="sm" className="gap-1.5">
                    <Printer className="h-3.5 w-3.5" />
                    Print
                  </Button>
                  <Button onClick={() => handleDownloadPDF(activeForm, printerSettings.orientation)} variant="secondary" size="sm" className="gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                </div>
              </div>

              <TabsContent value="ncr" className="bg-white p-4 sm:p-8 border rounded-lg overflow-auto">
                <NCRReport />
              </TabsContent>

              <TabsContent value="mrb" className="bg-white p-4 sm:p-8 border rounded-lg overflow-auto">
                <MRBCommitteeForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <PrintPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        content={previewContent}
        title={previewTitle}
        styles={getPrintStyles()}
        orientation={printerSettings.orientation}
        onPrint={() => { handlePrint(activeForm, printerSettings.orientation); setShowPreview(false); }}
        onDownloadPDF={() => { handleDownloadPDF(activeForm, printerSettings.orientation); setShowPreview(false); }}
      />

      <PrinterSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={printerSettings}
        onSave={setPrinterSettings}
      />
    </div>
  );
};

export default MRBPrint;
