import { useState, useRef } from 'react';
import { Search, Printer, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMRB } from '@/contexts/MRBContext';
import { useInwardMRB } from '@/contexts/InwardMRBContext';
import { MRBRecord } from '@/types/mrb';
import { useToast } from '@/hooks/use-toast';
import hblLogo from '@/assets/hbl-logo.png';

const MRBPrint = () => {
  const { mrbRecords, getMRBById } = useMRB();
  const { inwardMRBRecords, getInwardMRBById } = useInwardMRB();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  
  // Combine all MRB records
  const allMRBs = [...mrbRecords, ...inwardMRBRecords];
  
  // Find a sample MRB with comprehensive data for demo (prefer MRB-2024-0004 which has full workflow)
  const sampleMRB = allMRBs.find(m => m.mrbNumber === 'MRB-2024-0004') || allMRBs.find(m => m.status === 'final_approval' || m.status === 'closed') || allMRBs[0];
  
  const [searchNumber, setSearchNumber] = useState(sampleMRB?.mrbNumber || '');
  const [selectedMRBId, setSelectedMRBId] = useState<string>(sampleMRB?.id || '');
  const [selectedMRB, setSelectedMRB] = useState<MRBRecord | null>(sampleMRB || null);

  const handleSearch = () => {
    const found = allMRBs.find(
      mrb => mrb.mrbNumber.toLowerCase() === searchNumber.toLowerCase()
    );
    if (found) {
      setSelectedMRB(found);
      setSelectedMRBId(found.id);
      toast({ title: 'MRB Found', description: `Loaded ${found.mrbNumber}` });
    } else {
      toast({ 
        title: 'MRB Not Found', 
        description: 'No MRB found with the entered number',
        variant: 'destructive'
      });
    }
  };

  const handleSelectMRB = (id: string) => {
    const mrb = getMRBById(id) || getInwardMRBById(id);
    if (mrb) {
      setSelectedMRB(mrb);
      setSelectedMRBId(id);
      setSearchNumber(mrb.mrbNumber);
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
          <title>Non-Conformance Report (IQC) - ${selectedMRB?.mrbNumber}</title>
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

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getDecisionDisplayName = (decision: string | undefined) => {
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

  const getDispositionChecked = (decision: string | undefined) => {
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
                      {mrb.mrbNumber} - {mrb.materialDescription}
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
                  <div className="flex-1 px-2 py-1 border-r border-black font-medium">{selectedMRB.grnNumber || '_________________'}</div>
                  <div className="w-28 px-2 py-1 border-r border-black">NC Report No:</div>
                  <div className="flex-1 px-2 py-1 font-medium">{selectedMRB.mrbNumber}</div>
                </div>
                <div className="flex border-b border-black">
                  <div className="w-24 px-2 py-1 border-r border-black">GRN DATE:</div>
                  <div className="flex-1 px-2 py-1 border-r border-black">{formatDate(selectedMRB.createdAt) || '_________________'}</div>
                  <div className="w-28 px-2 py-1 border-r border-black">NC Report Date:</div>
                  <div className="flex-1 px-2 py-1">{formatDate(selectedMRB.createdAt)}</div>
                </div>
                <div className="flex border-b border-black">
                  <div className="w-24 px-2 py-1 border-r border-black">DC / INV No:</div>
                  <div className="flex-1 px-2 py-1 border-r border-black">{selectedMRB.poNumber || '_________________'}</div>
                  <div className="w-28 px-2 py-1 border-r border-black">DC / INV Date:</div>
                  <div className="flex-1 px-2 py-1">_________________</div>
                </div>
                <div className="flex border-b border-black">
                  <div className="w-24 px-2 py-1 border-r border-black">Supplier Name:</div>
                  <div className="flex-1 px-2 py-1 font-medium">{selectedMRB.vendorName}</div>
                </div>
                <div className="flex border-b border-black">
                  <div className="w-24 px-2 py-1 border-r border-black">P O No.:</div>
                  <div className="flex-1 px-2 py-1 border-r border-black font-medium">{selectedMRB.poNumber || '_________________'}</div>
                  <div className="w-28 px-2 py-1 border-r border-black">Item Code:</div>
                  <div className="flex-1 px-2 py-1 font-medium">{selectedMRB.materialNumber}</div>
                </div>
                <div className="flex border-b border-black">
                  <div className="w-28 px-2 py-1 border-r border-black">Item Desc. & Make:</div>
                  <div className="flex-1 px-2 py-1 font-medium">{selectedMRB.materialDescription}</div>
                </div>
                <div className="flex">
                  <div className="w-24 px-2 py-1 border-r border-black">Received Qty:</div>
                  <div className="w-24 px-2 py-1 border-r border-black font-medium">{selectedMRB.totalQuantity} {selectedMRB.uom}</div>
                  <div className="w-24 px-2 py-1 border-r border-black">Accepted Qty:</div>
                  <div className="w-24 px-2 py-1 border-r border-black font-medium">{selectedMRB.acceptedQuantity} {selectedMRB.uom}</div>
                  <div className="w-24 px-2 py-1 border-r border-black">Rejected Qty:</div>
                  <div className="flex-1 px-2 py-1 font-medium">{selectedMRB.rejectedQuantity} {selectedMRB.uom}</div>
                </div>
              </div>

              {/* Non-Conformance Details */}
              <div className="border border-black mb-2">
                <div className="px-2 py-1 border-b border-black font-bold bg-gray-50">Non-Conformance Details:-</div>
                <div className="min-h-[80px] p-2 text-[10px]">
                  <p><strong>Defect Category:</strong> {selectedMRB.defectCategory || 'N/A'}</p>
                  <p><strong>Defect Code:</strong> {selectedMRB.defectCode || 'N/A'}</p>
                  <p className="mt-1"><strong>Description:</strong></p>
                  <p>{selectedMRB.defectDescription || selectedMRB.qualityRemarks || 'N/A'}</p>
                </div>
                <div className="flex justify-between px-2 py-1 border-t border-black">
                  <span>Initiator Name: {selectedMRB.qualityApprovedBy || '_________________'}</span>
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
                      <td className="border border-black px-2 py-3">{selectedMRB.engineeringRemarks || ''}</td>
                      <td className="border border-black px-2 py-3 text-center">{selectedMRB.engineeringApprovedBy || ''}</td>
                      <td className="border border-black px-2 py-3 text-center">{formatDate(selectedMRB.engineeringApprovedAt)}</td>
                    </tr>
                    <tr>
                      <td className="border border-black px-2 py-3 text-center">2</td>
                      <td className="border border-black px-2 py-3">{selectedMRB.purchaseRemarks || ''}</td>
                      <td className="border border-black px-2 py-3 text-center">{selectedMRB.purchaseApprovedBy || ''}</td>
                      <td className="border border-black px-2 py-3 text-center">{formatDate(selectedMRB.purchaseApprovedAt)}</td>
                    </tr>
                    <tr>
                      <td className="border border-black px-2 py-3 text-center">3</td>
                      <td className="border border-black px-2 py-3">{selectedMRB.finalRemarks || ''}</td>
                      <td className="border border-black px-2 py-3 text-center">{selectedMRB.finalApprovedBy || ''}</td>
                      <td className="border border-black px-2 py-3 text-center">{formatDate(selectedMRB.finalApprovedAt)}</td>
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

              {/* Document Footer Page 1 */}
              <div className="flex justify-between text-[9px] text-gray-600 mt-4">
                <span>EG-QC-FT-25 Rev2</span>
                <span>Page 1 of 2</span>
              </div>

              {/* Page 2 */}
              <div style={{ pageBreakBefore: 'always' }} className="pt-4">
                {/* Header Page 2 */}
                <div className="flex justify-between items-center mb-2">
                  <div className="text-center flex-1">
                    <h1 className="text-base font-bold">HBL Power Systems Ltd.</h1>
                    <p className="text-[10px] text-gray-600">Electronics Group</p>
                  </div>
                  <img src={hblLogo} alt="HBL Logo" className="h-8" />
                </div>

                {/* Title Bar Page 2 */}
                <div className="text-center font-bold py-1.5 border border-black border-b-2 bg-gray-100 mb-2 text-sm">
                  NON-CONFORMANCE REPORT (IQC)
                </div>

                {/* Material/Product Disposition */}
                <div className="border border-black mb-2">
                  <div className="px-2 py-1 font-bold border-b border-black bg-gray-50">Material/Product Disposition:</div>
                  <div className="grid grid-cols-3 gap-2 p-2">
                    {(() => {
                      const checked = getDispositionChecked(selectedMRB.finalDecision || selectedMRB.qualityDecision);
                      return (
                        <>
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 border border-black inline-block ${checked.use_as_is ? 'bg-black' : ''}`}></span>
                            <span>Use as Is (documented rationale required)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 border border-black inline-block ${checked.sort ? 'bg-black' : ''}`}></span>
                            <span>Sort(attach instructions)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 border border-black inline-block ${checked.return_to_vendor ? 'bg-black' : ''}`}></span>
                            <span>Return to supplier</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 border border-black inline-block ${checked.rework ? 'bg-black' : ''}`}></span>
                            <span>Rework(attach instructions)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 border border-black inline-block ${checked.scrap ? 'bg-black' : ''}`}></span>
                            <span>Scrap(attach scrap report)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 border border-black inline-block ${checked.others ? 'bg-black' : ''}`}></span>
                            <span>Others(attach instructions)</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Material Review Board Approvals */}
                <div className="border border-black mb-2">
                  <div className="px-2 py-1 font-bold border-b border-black bg-gray-50">Material Review Board Approvals:</div>
                  <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th className="border border-black px-2 py-1 bg-gray-50 text-left w-40">Department</th>
                        <th className="border border-black px-2 py-1 bg-gray-50">Name</th>
                        <th className="border border-black px-2 py-1 bg-gray-50 w-24">Sign</th>
                        <th className="border border-black px-2 py-1 bg-gray-50 w-24">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-black px-2 py-2 font-medium">R & D / Safety Engineering</td>
                        <td className="border border-black px-2 py-2">{selectedMRB.engineeringApprovedBy || ''}</td>
                        <td className="border border-black px-2 py-2"></td>
                        <td className="border border-black px-2 py-2">{formatDate(selectedMRB.engineeringApprovedAt)}</td>
                      </tr>
                      <tr>
                        <td className="border border-black px-2 py-2 font-medium">RE Operations</td>
                        <td className="border border-black px-2 py-2"></td>
                        <td className="border border-black px-2 py-2"></td>
                        <td className="border border-black px-2 py-2"></td>
                      </tr>
                      <tr>
                        <td className="border border-black px-2 py-2 font-medium">I & C</td>
                        <td className="border border-black px-2 py-2"></td>
                        <td className="border border-black px-2 py-2"></td>
                        <td className="border border-black px-2 py-2"></td>
                      </tr>
                      <tr>
                        <td className="border border-black px-2 py-2 font-medium">Quality Assurance</td>
                        <td className="border border-black px-2 py-2">{selectedMRB.qualityApprovedBy || ''}</td>
                        <td className="border border-black px-2 py-2"></td>
                        <td className="border border-black px-2 py-2">{formatDate(selectedMRB.qualityApprovedAt)}</td>
                      </tr>
                      <tr>
                        <td className="border border-black px-2 py-2 font-medium">Quality Control</td>
                        <td className="border border-black px-2 py-2"></td>
                        <td className="border border-black px-2 py-2"></td>
                        <td className="border border-black px-2 py-2"></td>
                      </tr>
                      <tr>
                        <td className="border border-black px-2 py-2 font-medium">Purchase</td>
                        <td className="border border-black px-2 py-2">{selectedMRB.purchaseApprovedBy || ''}</td>
                        <td className="border border-black px-2 py-2"></td>
                        <td className="border border-black px-2 py-2">{formatDate(selectedMRB.purchaseApprovedAt)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* NCR Status */}
                <div className="border border-black mb-2 p-2">
                  <div className="font-bold mb-2">NCR Status:</div>
                  <div className="mb-2">
                    <span>Comments:-</span>
                    <div className="border-b border-dotted border-black min-h-[30px] mt-1 px-1">
                      {selectedMRB.finalRemarks || ''}
                    </div>
                  </div>
                  <div className="flex gap-4 mt-2">
                    <div className={`border border-black px-4 py-1 ${selectedMRB.status !== 'closed' ? 'bg-gray-200 font-bold' : ''}`}>
                      Open
                    </div>
                    <div className={`border border-black px-4 py-1 ${selectedMRB.status === 'closed' ? 'bg-gray-200 font-bold' : ''}`}>
                      Close
                    </div>
                  </div>
                </div>

                {/* Quality Control Footer */}
                <div className="flex justify-between items-end py-2 mt-4">
                  <div className="flex items-end gap-2">
                    <span>Quality Control:</span>
                    <div className="border-b border-black w-40 h-5"></div>
                    <span className="text-[9px]">Name and Sign</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span>Date:</span>
                    <div className="border-b border-black w-32 h-5"></div>
                  </div>
                </div>

                {/* Document Footer Page 2 */}
                <div className="flex justify-between text-[9px] text-gray-600 mt-8 pt-4 border-t border-gray-300">
                  <span>EG-QC-FT-25 Rev2</span>
                  <span>Page 2 of 2</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MRBPrint;
