import { useState, useRef } from 'react';
import { Search, Printer, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMRB } from '@/contexts/MRBContext';
import { useInwardMRB } from '@/contexts/InwardMRBContext';
import { useToast } from '@/hooks/use-toast';
import hblLogo from '@/assets/hbl-logo.png';
import type { Database } from '@/integrations/supabase/types';

type MRBRecord = Database['public']['Tables']['mrb_records']['Row'];

const MRBPrint = () => {
  const { mrbRecords, getMRBById } = useMRB();
  const { inwardMRBRecords } = useInwardMRB();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  
  // Combine all MRB records
  const allMRBs = [...mrbRecords, ...inwardMRBRecords];
  
  // Find a sample MRB with comprehensive data for demo (prefer MRB-2024-0004 which has full workflow)
  const sampleMRB = allMRBs.find(m => m.mrb_number === 'MRB-2024-0004') || allMRBs.find(m => m.status === 'final_approval' || m.status === 'closed') || allMRBs[0];
  
  const [searchNumber, setSearchNumber] = useState(sampleMRB?.mrb_number || '');
  const [selectedMRBId, setSelectedMRBId] = useState<string>(sampleMRB?.id || '');
  const [selectedMRB, setSelectedMRB] = useState<MRBRecord | null>(sampleMRB || null);

  const handleSearch = () => {
    const found = allMRBs.find(
      mrb => mrb.mrb_number.toLowerCase() === searchNumber.toLowerCase()
    );
    if (found) {
      setSelectedMRB(found);
      setSelectedMRBId(found.id);
      toast({ title: 'MRB Found', description: `Loaded ${found.mrb_number}` });
    } else {
      toast({ 
        title: 'MRB Not Found', 
        description: 'No MRB found with the entered number',
        variant: 'destructive'
      });
    }
  };

  const handleSelectMRB = (id: string) => {
    const mrb = getMRBById(id) || inwardMRBRecords.find(m => m.id === id);
    if (mrb) {
      setSelectedMRB(mrb);
      setSelectedMRBId(id);
      setSearchNumber(mrb.mrb_number);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    
    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Non-Conformance Report (IQC) - ${selectedMRB?.mrb_number}</title>
          <style>
            @page { size: A4; margin: 10mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 10px; color: #000; line-height: 1.3; }
            .print-container { max-width: 210mm; margin: 0 auto; }
            
            /* Header styles */
            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              margin-bottom: 8px;
            }
            .header-left { text-align: center; flex: 1; }
            .header-left h1 { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
            .header-left p { font-size: 10px; color: #666; }
            .logo { height: 35px; }
            
            /* Title bar */
            .title-bar { 
              text-align: center; 
              font-size: 14px; 
              font-weight: bold; 
              padding: 6px; 
              border: 1px solid #000;
              border-bottom: 2px solid #000;
              background: #f5f5f5;
              margin-bottom: 8px;
            }
            
            /* Form sections */
            .form-section { 
              border: 1px solid #000; 
              margin-bottom: 8px; 
            }
            .form-row { 
              display: flex; 
              border-bottom: 1px solid #000; 
            }
            .form-row:last-child { border-bottom: none; }
            .form-cell { 
              padding: 4px 8px; 
              border-right: 1px solid #000; 
              min-height: 24px;
              display: flex;
              align-items: center;
            }
            .form-cell:last-child { border-right: none; }
            .form-cell.label { 
              font-weight: normal; 
              width: 120px; 
              flex-shrink: 0;
            }
            .form-cell.value { 
              flex: 1; 
              font-weight: normal;
            }
            .form-cell.half { width: 50%; }
            
            /* Quantity row */
            .qty-row { display: flex; border-bottom: 1px solid #000; }
            .qty-cell { 
              flex: 1; 
              padding: 4px 8px; 
              border-right: 1px solid #000;
              text-align: center;
            }
            .qty-cell:last-child { border-right: none; }
            
            /* NC Details section */
            .nc-section { 
              border: 1px solid #000; 
              margin-bottom: 8px;
            }
            .nc-header { 
              font-weight: bold; 
              padding: 4px 8px; 
              border-bottom: 1px solid #000;
              background: #f9f9f9;
            }
            .nc-content { 
              min-height: 80px; 
              padding: 8px; 
            }
            .nc-footer { 
              display: flex; 
              justify-content: space-between; 
              padding: 4px 8px;
              border-top: 1px solid #000;
            }
            
            /* MRB Check */
            .mrb-check { 
              text-align: center; 
              padding: 8px; 
              font-weight: bold; 
              border: 1px solid #000;
              margin-bottom: 8px;
            }
            
            /* Instructions Table */
            .instructions-section { 
              border: 1px solid #000; 
              margin-bottom: 8px;
            }
            .instructions-title { 
              text-align: center; 
              font-weight: bold; 
              padding: 6px; 
              border-bottom: 1px solid #000;
              background: #f5f5f5;
            }
            .instructions-table { width: 100%; border-collapse: collapse; }
            .instructions-table th, 
            .instructions-table td { 
              border: 1px solid #000; 
              padding: 4px 8px; 
              text-align: left; 
            }
            .instructions-table th { 
              background: #f9f9f9; 
              font-weight: bold;
              text-align: center;
            }
            .instructions-table td { min-height: 30px; }
            
            /* Disposition Section */
            .disposition-section { 
              border: 1px solid #000; 
              margin-bottom: 8px;
            }
            .disposition-header { 
              font-weight: bold; 
              padding: 4px 8px; 
              border-bottom: 1px solid #000;
              background: #f5f5f5;
            }
            .disposition-options { 
              display: grid; 
              grid-template-columns: 1fr 1fr 1fr; 
              padding: 8px; 
            }
            .disposition-item { 
              display: flex; 
              align-items: center; 
              gap: 6px; 
              padding: 4px 0;
            }
            .checkbox { 
              width: 12px; 
              height: 12px; 
              border: 1px solid #000; 
              display: inline-block;
            }
            .checkbox.checked { 
              background: #000;
              position: relative;
            }
            .checkbox.checked::after {
              content: '✓';
              color: #fff;
              font-size: 10px;
              position: absolute;
              top: -2px;
              left: 1px;
            }
            
            /* MRB Approvals Table */
            .approvals-section { 
              border: 1px solid #000; 
              margin-bottom: 8px;
            }
            .approvals-header { 
              font-weight: bold; 
              padding: 4px 8px; 
              border-bottom: 1px solid #000;
              background: #f5f5f5;
            }
            .approvals-table { width: 100%; border-collapse: collapse; }
            .approvals-table th, 
            .approvals-table td { 
              border: 1px solid #000; 
              padding: 6px 8px; 
              text-align: left; 
            }
            .approvals-table th { background: #f9f9f9; font-weight: bold; }
            
            /* NCR Status */
            .ncr-status { 
              border: 1px solid #000; 
              margin-bottom: 8px;
              padding: 8px;
            }
            .ncr-status-header { font-weight: bold; margin-bottom: 6px; }
            .ncr-status-comments { 
              border-bottom: 1px dotted #000; 
              min-height: 40px; 
              margin-bottom: 8px;
              padding: 4px;
            }
            .ncr-status-boxes { display: flex; gap: 16px; }
            .status-box { 
              border: 1px solid #000; 
              padding: 4px 16px; 
              font-weight: bold;
            }
            .status-box.active { background: #e0e0e0; }
            
            /* Quality Control Footer */
            .qc-footer { 
              display: flex; 
              justify-content: space-between; 
              padding: 8px 0;
              margin-top: 8px;
            }
            .qc-signature { display: flex; gap: 8px; align-items: flex-end; }
            .signature-line { 
              border-bottom: 1px solid #000; 
              width: 150px; 
              height: 20px;
            }
            
            /* Document footer */
            .doc-footer { 
              display: flex; 
              justify-content: space-between; 
              font-size: 9px; 
              margin-top: 16px;
              padding-top: 8px;
              border-top: 1px solid #ccc;
            }
            
            /* Page break */
            .page-break { page-break-before: always; }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownloadPDF = () => {
    handlePrint();
    toast({ 
      title: 'Print Dialog Opened', 
      description: 'Select "Save as PDF" in the print dialog to download as PDF' 
    });
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getDecisionDisplayName = (decision: string | null | undefined) => {
    if (!decision) return '';
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
    };
    return decisionMap[decision] || decision;
  };

  const getDispositionChecked = (decision: string | null | undefined) => {
    const dispositions = {
      use_as_is: decision === 'use_as_is' || decision === 'accept',
      sort: false,
      return_to_vendor: decision === 'return_to_vendor',
      rework: decision === 'rework_required',
      scrap: decision === 'scrap_material' || decision === 'reject',
      others: decision === 'use_with_deviation' || decision === 'partial_accept',
    };
    return dispositions;
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Non-Conformance Report (IQC) Print
          </CardTitle>
          <CardDescription>
            Generate HBL standard Non-Conformance Report format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Search by MRB Number</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter MRB Number (e.g., MRB-2024-0001)"
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
                  {allMRBs.map((mrb) => (
                    <SelectItem key={mrb.id} value={mrb.id}>
                      {mrb.mrb_number} - {mrb.material_description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedMRB && (
            <div className="flex gap-2 mt-4">
              <Button onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button onClick={handleDownloadPDF} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download as PDF
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Preview - HBL Non-Conformance Report Format */}
      {selectedMRB && (
        <Card>
          <CardHeader>
            <CardTitle>Print Preview - Non-Conformance Report (IQC)</CardTitle>
          </CardHeader>
          <CardContent className="bg-white p-8 overflow-auto">
            <div ref={printRef} className="max-w-[210mm] mx-auto bg-white text-black" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10px' }}>
              
              {/* Page 1 */}
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
                NON-CONFORMANCE REPORT (IQC)
              </div>

              {/* GRN & NC Report Info */}
              <div className="border border-black mb-2">
                <div className="flex border-b border-black">
                  <div className="w-24 px-2 py-1 border-r border-black">GRN No.:</div>
                  <div className="flex-1 px-2 py-1 border-r border-black font-medium">{selectedMRB.grn_number || '_________________'}</div>
                  <div className="w-28 px-2 py-1 border-r border-black">NC Report No:</div>
                  <div className="flex-1 px-2 py-1 font-medium">{selectedMRB.mrb_number}</div>
                </div>
                <div className="flex border-b border-black">
                  <div className="w-24 px-2 py-1 border-r border-black">GRN DATE:</div>
                  <div className="flex-1 px-2 py-1 border-r border-black">{formatDate(selectedMRB.created_at) || '_________________'}</div>
                  <div className="w-28 px-2 py-1 border-r border-black">NC Report Date:</div>
                  <div className="flex-1 px-2 py-1">{formatDate(selectedMRB.created_at)}</div>
                </div>
                <div className="flex border-b border-black">
                  <div className="w-24 px-2 py-1 border-r border-black">DC / INV No:</div>
                  <div className="flex-1 px-2 py-1 border-r border-black">{selectedMRB.po_number || '_________________'}</div>
                  <div className="w-28 px-2 py-1 border-r border-black">DC / INV Date:</div>
                  <div className="flex-1 px-2 py-1">_________________</div>
                </div>
                <div className="flex border-b border-black">
                  <div className="w-24 px-2 py-1 border-r border-black">Supplier Name:</div>
                  <div className="flex-1 px-2 py-1 font-medium">{selectedMRB.vendor_name}</div>
                </div>
                <div className="flex border-b border-black">
                  <div className="w-24 px-2 py-1 border-r border-black">P O No.:</div>
                  <div className="flex-1 px-2 py-1 border-r border-black font-medium">{selectedMRB.po_number || '_________________'}</div>
                  <div className="w-28 px-2 py-1 border-r border-black">Item Code:</div>
                  <div className="flex-1 px-2 py-1 font-medium">{selectedMRB.material_number}</div>
                </div>
                <div className="flex border-b border-black">
                  <div className="w-28 px-2 py-1 border-r border-black">Item Desc. & Make:</div>
                  <div className="flex-1 px-2 py-1 font-medium">{selectedMRB.material_description}</div>
                </div>
                <div className="flex">
                  <div className="w-24 px-2 py-1 border-r border-black">Received Qty:</div>
                  <div className="w-24 px-2 py-1 border-r border-black font-medium">{selectedMRB.total_quantity} {selectedMRB.uom}</div>
                  <div className="w-24 px-2 py-1 border-r border-black">Accepted Qty:</div>
                  <div className="w-24 px-2 py-1 border-r border-black font-medium">{selectedMRB.accepted_quantity ?? 0} {selectedMRB.uom}</div>
                  <div className="w-24 px-2 py-1 border-r border-black">Rejected Qty:</div>
                  <div className="flex-1 px-2 py-1 font-medium">{selectedMRB.rejected_quantity ?? 0} {selectedMRB.uom}</div>
                </div>
              </div>

              {/* Non-Conformance Details */}
              <div className="border border-black mb-2">
                <div className="px-2 py-1 border-b border-black font-bold bg-gray-50">Non-Conformance Details:-</div>
                <div className="min-h-[80px] p-2 text-[10px]">
                  <p><strong>Defect Category:</strong> {selectedMRB.defect_category || 'N/A'}</p>
                  <p><strong>Defect Code:</strong> {selectedMRB.defect_code || 'N/A'}</p>
                  <p className="mt-1"><strong>Description:</strong></p>
                  <p>{selectedMRB.defect_description || selectedMRB.quality_remarks || 'N/A'}</p>
                </div>
                <div className="flex justify-between px-2 py-1 border-t border-black">
                  <span>Initiator Name: {selectedMRB.quality_approved_by || '_________________'}</span>
                  <span>Sign: _________________</span>
                </div>
              </div>

              {/* MRB Applicable */}
              <div className="text-center py-2 border border-black mb-2 font-bold">
                Material Review Board (If applicable) <span className="underline">Yes</span> / No
                <div className="text-[9px] font-normal mt-1">Initiator has to tick</div>
              </div>

              {/* Detailed Instructions of MRB */}
              <div className="border border-black mb-2">
                <div className="text-center font-bold py-1 border-b border-black bg-gray-100">
                  DETAILED INSTRUCTIONS OF MRB
                </div>
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th className="border border-black px-2 py-1 bg-gray-50 w-12 text-center">S. No.</th>
                      <th className="border border-black px-2 py-1 bg-gray-50">Instructions</th>
                      <th className="border border-black px-2 py-1 bg-gray-50 w-32 text-center">Responsibility<br/>Name & Sign</th>
                      <th className="border border-black px-2 py-1 bg-gray-50 w-24 text-center">Target Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black px-2 py-3 text-center">1</td>
                      <td className="border border-black px-2 py-3">{selectedMRB.engineering_remarks || ''}</td>
                      <td className="border border-black px-2 py-3 text-center">{selectedMRB.engineering_approved_by || ''}</td>
                      <td className="border border-black px-2 py-3 text-center">{formatDate(selectedMRB.engineering_approved_at)}</td>
                    </tr>
                    <tr>
                      <td className="border border-black px-2 py-3 text-center">2</td>
                      <td className="border border-black px-2 py-3">{selectedMRB.purchase_remarks || ''}</td>
                      <td className="border border-black px-2 py-3 text-center">{selectedMRB.purchase_approved_by || ''}</td>
                      <td className="border border-black px-2 py-3 text-center">{formatDate(selectedMRB.purchase_approved_at)}</td>
                    </tr>
                    <tr>
                      <td className="border border-black px-2 py-3 text-center">3</td>
                      <td className="border border-black px-2 py-3">{selectedMRB.final_remarks || ''}</td>
                      <td className="border border-black px-2 py-3 text-center">{selectedMRB.final_approved_by || ''}</td>
                      <td className="border border-black px-2 py-3 text-center">{formatDate(selectedMRB.final_approved_at)}</td>
                    </tr>
                    <tr>
                      <td className="border border-black px-2 py-3 text-center">4</td>
                      <td className="border border-black px-2 py-3"></td>
                      <td className="border border-black px-2 py-3"></td>
                      <td className="border border-black px-2 py-3"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Disposition of NC Material */}
              <div className="border border-black mb-2">
                <div className="px-2 py-1 border-b border-black font-bold bg-gray-50">Disposition of NC Material</div>
                <div className="grid grid-cols-3 gap-4 p-2">
                  {(() => {
                    const checked = getDispositionChecked(selectedMRB.final_decision || selectedMRB.engineering_decision);
                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 border border-black ${checked.use_as_is ? 'bg-black' : ''}`}></div>
                          <span>Use As Is</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 border border-black ${checked.sort ? 'bg-black' : ''}`}></div>
                          <span>Sort</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 border border-black ${checked.return_to_vendor ? 'bg-black' : ''}`}></div>
                          <span>Return to Vendor</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 border border-black ${checked.rework ? 'bg-black' : ''}`}></div>
                          <span>Rework</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 border border-black ${checked.scrap ? 'bg-black' : ''}`}></div>
                          <span>Scrap</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 border border-black ${checked.others ? 'bg-black' : ''}`}></div>
                          <span>Others</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* MRB Committee Approvals */}
              <div className="border border-black mb-2">
                <div className="px-2 py-1 border-b border-black font-bold bg-gray-50">MRB Committee Approval</div>
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th className="border border-black px-2 py-1 bg-gray-50">Department</th>
                      <th className="border border-black px-2 py-1 bg-gray-50">Name</th>
                      <th className="border border-black px-2 py-1 bg-gray-50">Decision</th>
                      <th className="border border-black px-2 py-1 bg-gray-50">Date</th>
                      <th className="border border-black px-2 py-1 bg-gray-50">Signature</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black px-2 py-2">Quality</td>
                      <td className="border border-black px-2 py-2">{selectedMRB.quality_approved_by || ''}</td>
                      <td className="border border-black px-2 py-2">{getDecisionDisplayName(selectedMRB.quality_decision)}</td>
                      <td className="border border-black px-2 py-2">{formatDate(selectedMRB.quality_approved_at)}</td>
                      <td className="border border-black px-2 py-2"></td>
                    </tr>
                    <tr>
                      <td className="border border-black px-2 py-2">Engineering</td>
                      <td className="border border-black px-2 py-2">{selectedMRB.engineering_approved_by || ''}</td>
                      <td className="border border-black px-2 py-2">{getDecisionDisplayName(selectedMRB.engineering_decision)}</td>
                      <td className="border border-black px-2 py-2">{formatDate(selectedMRB.engineering_approved_at)}</td>
                      <td className="border border-black px-2 py-2"></td>
                    </tr>
                    <tr>
                      <td className="border border-black px-2 py-2">Purchase</td>
                      <td className="border border-black px-2 py-2">{selectedMRB.purchase_approved_by || ''}</td>
                      <td className="border border-black px-2 py-2">{selectedMRB.purchase_action || ''}</td>
                      <td className="border border-black px-2 py-2">{formatDate(selectedMRB.purchase_approved_at)}</td>
                      <td className="border border-black px-2 py-2"></td>
                    </tr>
                    <tr>
                      <td className="border border-black px-2 py-2">Final Approver</td>
                      <td className="border border-black px-2 py-2">{selectedMRB.final_approved_by || ''}</td>
                      <td className="border border-black px-2 py-2">{selectedMRB.final_decision || ''}</td>
                      <td className="border border-black px-2 py-2">{formatDate(selectedMRB.final_approved_at)}</td>
                      <td className="border border-black px-2 py-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* NCR Status */}
              <div className="border border-black mb-2 p-2">
                <div className="font-bold mb-1">NCR Close out comments:</div>
                <div className="min-h-[40px] border-b border-dotted border-black mb-2 p-1">
                  {selectedMRB.closure_status || selectedMRB.final_remarks || ''}
                </div>
                <div className="flex gap-4">
                  <div className={`border border-black px-4 py-1 font-bold ${selectedMRB.status === 'closed' || selectedMRB.status === 'approved' ? 'bg-gray-200' : ''}`}>
                    CLOSED
                  </div>
                  <div className={`border border-black px-4 py-1 font-bold ${selectedMRB.status !== 'closed' && selectedMRB.status !== 'approved' ? 'bg-gray-200' : ''}`}>
                    OPEN
                  </div>
                </div>
              </div>

              {/* Quality Control Signature */}
              <div className="flex justify-between pt-4 border-t border-gray-300 mt-4">
                <div className="flex items-end gap-2">
                  <span>Quality Control:</span>
                  <div className="border-b border-black w-36 h-5"></div>
                </div>
                <div className="flex items-end gap-2">
                  <span>Date:</span>
                  <div className="border-b border-black w-24 h-5"></div>
                </div>
              </div>

              {/* Document Footer */}
              <div className="flex justify-between text-[9px] mt-4 pt-2 border-t border-gray-200">
                <span>Doc. No.: HBL/QA/NCR/001</span>
                <span>Rev: 02</span>
                <span>Effective Date: 01-Jan-2024</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MRBPrint;