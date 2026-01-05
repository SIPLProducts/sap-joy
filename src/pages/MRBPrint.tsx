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
  
  const [searchNumber, setSearchNumber] = useState('');
  const [selectedMRBId, setSelectedMRBId] = useState<string>('');
  const [selectedMRB, setSelectedMRB] = useState<MRBRecord | null>(null);

  // Combine all MRB records
  const allMRBs = [...mrbRecords, ...inwardMRBRecords];

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
          <title>MRB Print - ${selectedMRB?.mrbNumber}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.4; }
            .print-container { max-width: 210mm; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a365d; padding-bottom: 12px; margin-bottom: 16px; }
            .logo { height: 40px; }
            .title-section { text-align: center; flex: 1; }
            .title { font-size: 18px; font-weight: bold; color: #1a365d; margin-bottom: 4px; }
            .subtitle { font-size: 12px; color: #4a5568; }
            .mrb-info { text-align: right; font-size: 10px; }
            .mrb-number { font-size: 14px; font-weight: bold; color: #1a365d; }
            .section { margin-bottom: 16px; page-break-inside: avoid; }
            .section-title { font-size: 12px; font-weight: bold; background: #edf2f7; padding: 6px 10px; border-left: 4px solid #1a365d; margin-bottom: 8px; color: #1a365d; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
            .field { padding: 4px 0; }
            .field-label { font-size: 9px; color: #718096; text-transform: uppercase; font-weight: 600; }
            .field-value { font-size: 11px; color: #1a1a1a; margin-top: 2px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            .table th, .table td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; font-size: 10px; }
            .table th { background: #f7fafc; font-weight: 600; color: #4a5568; }
            .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
            .signature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 16px; }
            .signature-box { text-align: center; }
            .signature-line { border-top: 1px solid #1a1a1a; margin-top: 40px; padding-top: 6px; font-size: 10px; }
            .audit-footer { display: flex; justify-content: space-between; font-size: 9px; color: #718096; margin-top: 16px; padding-top: 8px; border-top: 1px dashed #e2e8f0; }
            .status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
            .status-green { background: #c6f6d5; color: #22543d; }
            .status-yellow { background: #fefcbf; color: #744210; }
            .status-red { background: #fed7d7; color: #822727; }
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
    // For PDF download, we'll use the browser's print to PDF functionality
    handlePrint();
    toast({ 
      title: 'Print Dialog Opened', 
      description: 'Select "Save as PDF" in the print dialog to download as PDF' 
    });
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusDisplayName = (status: string) => {
    const statusMap: Record<string, string> = {
      draft: 'Draft',
      quality_review: 'Quality Review',
      purchase_review: 'Purchase Review',
      engineering_review: 'Engineering Review',
      final_approval: 'Final Approval',
      approved: 'Approved',
      rejected: 'Rejected',
      closed: 'Closed',
    };
    return statusMap[status] || status;
  };

  const getDecisionDisplayName = (decision: string | undefined) => {
    if (!decision) return 'N/A';
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

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            MRB Print
          </CardTitle>
          <CardDescription>
            Generate professional, audit-ready MRB print document
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

      {/* Print Preview */}
      {selectedMRB && (
        <Card>
          <CardHeader>
            <CardTitle>Print Preview</CardTitle>
          </CardHeader>
          <CardContent className="bg-white p-8 overflow-auto">
            <div ref={printRef} className="max-w-[210mm] mx-auto bg-white text-foreground">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-primary pb-3 mb-4">
                <img src={hblLogo} alt="HBL Logo" className="h-10" />
                <div className="text-center flex-1">
                  <h1 className="text-lg font-bold text-primary">MATERIAL REVIEW BOARD (MRB)</h1>
                  <p className="text-xs text-muted-foreground">HBL Power Systems Limited</p>
                </div>
                <div className="text-right text-xs">
                  <div className="text-sm font-bold text-primary">{selectedMRB.mrbNumber}</div>
                  <div className="text-muted-foreground">Plant: {selectedMRB.plant}</div>
                  <div className="text-muted-foreground">Date: {formatDate(selectedMRB.createdAt)}</div>
                </div>
              </div>

              {/* Section 1: Material & GRN Details */}
              <div className="mb-4">
                <h2 className="text-xs font-bold bg-muted px-2 py-1 border-l-4 border-primary mb-2 text-primary">
                  1. MATERIAL & GRN DETAILS
                </h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs px-2">
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">Material Number:</span>
                    <span className="font-medium">{selectedMRB.materialNumber}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">GRN Number:</span>
                    <span className="font-medium">{selectedMRB.grnNumber || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">Material Description:</span>
                    <span className="font-medium">{selectedMRB.materialDescription}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">Inspection Lot:</span>
                    <span className="font-medium">{selectedMRB.inspectionLot || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">Vendor Code:</span>
                    <span className="font-medium">{selectedMRB.vendor}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">PO Number:</span>
                    <span className="font-medium">{selectedMRB.poNumber || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">Vendor Name:</span>
                    <span className="font-medium">{selectedMRB.vendorName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">Source:</span>
                    <span className="font-medium">{selectedMRB.source === 'quality_inspection' ? 'Quality Inspection' : 'Shop Floor'}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Quantity Details */}
              <div className="mb-4">
                <h2 className="text-xs font-bold bg-muted px-2 py-1 border-l-4 border-primary mb-2 text-primary">
                  2. QUANTITY DETAILS
                </h2>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border border-border px-2 py-1 text-left">Total Qty</th>
                      <th className="border border-border px-2 py-1 text-left">Accepted Qty</th>
                      <th className="border border-border px-2 py-1 text-left">Rejected Qty</th>
                      <th className="border border-border px-2 py-1 text-left">Blocked Qty</th>
                      <th className="border border-border px-2 py-1 text-left">UoM</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-border px-2 py-1">{selectedMRB.totalQuantity}</td>
                      <td className="border border-border px-2 py-1">{selectedMRB.acceptedQuantity}</td>
                      <td className="border border-border px-2 py-1">{selectedMRB.rejectedQuantity}</td>
                      <td className="border border-border px-2 py-1">{selectedMRB.blockedQuantity}</td>
                      <td className="border border-border px-2 py-1">{selectedMRB.uom}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 3: Quality Inspection Details */}
              <div className="mb-4">
                <h2 className="text-xs font-bold bg-muted px-2 py-1 border-l-4 border-primary mb-2 text-primary">
                  3. QUALITY INSPECTION DETAILS
                </h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs px-2">
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">Quality Decision:</span>
                    <span className="font-medium">{getDecisionDisplayName(selectedMRB.qualityDecision)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">Defect Category:</span>
                    <span className="font-medium capitalize">{selectedMRB.defectCategory || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">Defect Code:</span>
                    <span className="font-medium">{selectedMRB.defectCode || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">Approved By:</span>
                    <span className="font-medium">{selectedMRB.qualityApprovedBy || 'N/A'}</span>
                  </div>
                  <div className="col-span-2 py-1 border-b border-muted">
                    <span className="text-muted-foreground">Defect Description:</span>
                    <p className="font-medium mt-1">{selectedMRB.defectDescription || 'N/A'}</p>
                  </div>
                  <div className="col-span-2 py-1 border-b border-muted">
                    <span className="text-muted-foreground">Quality Remarks:</span>
                    <p className="font-medium mt-1">{selectedMRB.qualityRemarks || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Section 4: Department Review Details */}
              <div className="mb-4">
                <h2 className="text-xs font-bold bg-muted px-2 py-1 border-l-4 border-primary mb-2 text-primary">
                  4. DEPARTMENT REVIEW DETAILS
                </h2>
                
                {/* Engineering Review */}
                {(selectedMRB.engineeringDecision || selectedMRB.engineeringRemarks) && (
                  <div className="mb-3 px-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Engineering Review</h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                      <div className="flex justify-between py-1 border-b border-muted">
                        <span className="text-muted-foreground">Decision:</span>
                        <span className="font-medium">{getDecisionDisplayName(selectedMRB.engineeringDecision)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-muted">
                        <span className="text-muted-foreground">Approved By:</span>
                        <span className="font-medium">{selectedMRB.engineeringApprovedBy || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-muted">
                        <span className="text-muted-foreground">Tech Ref Number:</span>
                        <span className="font-medium">{selectedMRB.technicalReferenceNumber || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-muted">
                        <span className="text-muted-foreground">Approved Date:</span>
                        <span className="font-medium">{formatDate(selectedMRB.engineeringApprovedAt)}</span>
                      </div>
                      <div className="col-span-2 py-1 border-b border-muted">
                        <span className="text-muted-foreground">Remarks:</span>
                        <p className="font-medium mt-1">{selectedMRB.engineeringRemarks || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Purchase Review */}
                {(selectedMRB.purchaseAction || selectedMRB.purchaseRemarks) && (
                  <div className="mb-3 px-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Purchase Review</h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                      <div className="flex justify-between py-1 border-b border-muted">
                        <span className="text-muted-foreground">Vendor Responsibility:</span>
                        <span className="font-medium">{selectedMRB.vendorResponsibility || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-muted">
                        <span className="text-muted-foreground">Approved By:</span>
                        <span className="font-medium">{selectedMRB.purchaseApprovedBy || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-muted">
                        <span className="text-muted-foreground">Replacement Required:</span>
                        <span className="font-medium">{selectedMRB.vendorReplacementRequired ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-muted">
                        <span className="text-muted-foreground">Expected Replacement:</span>
                        <span className="font-medium">{formatDate(selectedMRB.expectedReplacementDate)}</span>
                      </div>
                      <div className="col-span-2 py-1 border-b border-muted">
                        <span className="text-muted-foreground">Purchase Action:</span>
                        <p className="font-medium mt-1">{selectedMRB.purchaseAction || 'N/A'}</p>
                      </div>
                      <div className="col-span-2 py-1 border-b border-muted">
                        <span className="text-muted-foreground">Remarks:</span>
                        <p className="font-medium mt-1">{selectedMRB.purchaseRemarks || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* No reviews yet */}
                {!selectedMRB.engineeringDecision && !selectedMRB.engineeringRemarks && 
                 !selectedMRB.purchaseAction && !selectedMRB.purchaseRemarks && (
                  <p className="text-xs text-muted-foreground italic px-2">No department reviews recorded yet.</p>
                )}
              </div>

              {/* Section 5: Final MRB Decision */}
              <div className="mb-4">
                <h2 className="text-xs font-bold bg-muted px-2 py-1 border-l-4 border-primary mb-2 text-primary">
                  5. FINAL MRB DECISION
                </h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs px-2">
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">Current Status:</span>
                    <span className="font-medium">{getStatusDisplayName(selectedMRB.status)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">Final Decision:</span>
                    <span className="font-medium capitalize">{selectedMRB.finalDecision || 'Pending'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">Final Approved Qty:</span>
                    <span className="font-medium">{selectedMRB.finalApprovedQuantity ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">Final Rejected Qty:</span>
                    <span className="font-medium">{selectedMRB.finalRejectedQuantity ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">Deviation Number:</span>
                    <span className="font-medium">{selectedMRB.deviationApprovalNumber || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-muted">
                    <span className="text-muted-foreground">Approved By:</span>
                    <span className="font-medium">{selectedMRB.finalApprovedBy || 'N/A'}</span>
                  </div>
                  <div className="col-span-2 py-1 border-b border-muted">
                    <span className="text-muted-foreground">Final Remarks:</span>
                    <p className="font-medium mt-1">{selectedMRB.finalRemarks || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Section 6: Attachments Summary */}
              <div className="mb-4">
                <h2 className="text-xs font-bold bg-muted px-2 py-1 border-l-4 border-primary mb-2 text-primary">
                  6. ATTACHMENTS SUMMARY
                </h2>
                {selectedMRB.attachments.length > 0 ? (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted">
                        <th className="border border-border px-2 py-1 text-left">S.No</th>
                        <th className="border border-border px-2 py-1 text-left">Document Name</th>
                        <th className="border border-border px-2 py-1 text-left">Category</th>
                        <th className="border border-border px-2 py-1 text-left">Uploaded By</th>
                        <th className="border border-border px-2 py-1 text-left">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMRB.attachments.map((att, idx) => (
                        <tr key={att.id}>
                          <td className="border border-border px-2 py-1">{idx + 1}</td>
                          <td className="border border-border px-2 py-1">{att.name}</td>
                          <td className="border border-border px-2 py-1 capitalize">{att.category.replace(/_/g, ' ')}</td>
                          <td className="border border-border px-2 py-1">{att.uploadedBy}</td>
                          <td className="border border-border px-2 py-1">{formatDate(att.uploadedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-muted-foreground italic px-2">No attachments</p>
                )}
              </div>

              {/* Section 7: Authorization & Audit Footer */}
              <div className="mb-4">
                <h2 className="text-xs font-bold bg-muted px-2 py-1 border-l-4 border-primary mb-2 text-primary">
                  7. AUTHORIZATION
                </h2>
                <div className="grid grid-cols-3 gap-6 mt-4 px-2">
                  <div className="text-center">
                    <div className="border-t border-foreground mt-12 pt-2 text-xs">
                      <p className="font-medium">Quality Inspector</p>
                      <p className="text-muted-foreground text-[10px]">{selectedMRB.qualityApprovedBy || '________________'}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-foreground mt-12 pt-2 text-xs">
                      <p className="font-medium">Dept. Head</p>
                      <p className="text-muted-foreground text-[10px]">
                        {selectedMRB.engineeringApprovedBy || selectedMRB.purchaseApprovedBy || '________________'}
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-foreground mt-12 pt-2 text-xs">
                      <p className="font-medium">Plant Head</p>
                      <p className="text-muted-foreground text-[10px]">{selectedMRB.finalApprovedBy || '________________'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Audit Footer */}
              <div className="border-t border-dashed border-muted pt-2 mt-4 flex justify-between text-[10px] text-muted-foreground">
                <div>
                  <span>Document ID: {selectedMRB.id}</span>
                  <span className="mx-2">|</span>
                  <span>Created: {formatDate(selectedMRB.createdAt)}</span>
                </div>
                <div>
                  <span>Last Updated: {formatDate(selectedMRB.updatedAt)}</span>
                  <span className="mx-2">|</span>
                  <span>Printed: {formatDate(new Date().toISOString())}</span>
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
