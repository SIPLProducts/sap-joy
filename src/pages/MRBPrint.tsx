import { useState, useRef, useEffect } from 'react';
import { Search, Printer, Download, FileText, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PrintPreviewModal } from '@/components/print/PrintPreviewModal';
import hblLogo from '@/assets/hbl-logo.png';
import { supabase } from '@/integrations/supabase/client';
import { useActivePlant } from '@/hooks/useActivePlant';
import type { Database } from '@/integrations/supabase/types';

type MRBRecord = Database['public']['Tables']['mrb_records']['Row'];

interface ApproverInfo {
  quality?: string;
  purchase?: string;
  engineering?: string;
  final?: string;
  committee?: string;
}

interface MRBComment {
  id: string;
  text: string;
  author: string;
  date: string | null;
  stage?: string;
}

// =====================================================================
// SHARED EXACT-FORM STYLESHEET
// Self-contained CSS — used identically by on-screen preview, browser
// print window, and html2pdf export so all three render the same way.
// =====================================================================
const FORM_STYLESHEET = `
  @page { size: A4 portrait; margin: 12mm 14mm; }

  .mrb-form, .mrb-form * { box-sizing: border-box; }
  .mrb-form {
    font-family: "Times New Roman", Times, serif;
    font-size: 11pt;
    color: #000;
    background: #fff;
    width: 182mm;            /* A4 portrait minus 14mm side margins */
    margin: 0 auto;
    line-height: 1.35;
  }

  .mrb-page { width: 100%; }
  .mrb-page + .mrb-page { page-break-before: always; margin-top: 12mm; }

  .mrb-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2.5pt solid #c00000;
    padding-bottom: 4pt;
    margin-bottom: 8pt;
  }
  .mrb-header .brand {
    text-align: center;
    flex: 1;
  }
  .mrb-header .brand .company {
    font-weight: bold;
    font-size: 14pt;
    letter-spacing: .3pt;
  }
  .mrb-header .brand .division {
    font-size: 10.5pt;
    font-style: italic;
    margin-top: 1pt;
  }
  .mrb-header .logo {
    height: 38px;
    width: auto;
  }
  .mrb-header .logo-spacer { width: 80px; }

  .mrb-title {
    text-align: center;
    font-weight: bold;
    font-size: 13pt;
    text-decoration: underline;
    margin: 6pt 0 10pt;
    letter-spacing: .3pt;
  }

  /* Underline-style fields (match the dotted/underlined look of the PDFs) */
  .field-row {
    display: flex;
    margin: 5pt 0;
    gap: 16pt;
  }
  .field {
    display: flex;
    align-items: baseline;
    flex: 1;
    min-width: 0;
  }
  .field .lbl {
    white-space: nowrap;
    font-weight: normal;
    margin-right: 4pt;
  }
  .field .val {
    flex: 1;
    border-bottom: 1pt solid #000;
    min-height: 14pt;
    padding: 0 3pt 1pt;
    font-weight: 500;
    word-break: break-word;
  }
  .field.full { flex: 1 1 100%; }

  .block-label {
    font-weight: bold;
    margin-top: 8pt;
    margin-bottom: 2pt;
  }
  .block-box {
    border: 1pt solid #000;
    min-height: 60pt;
    padding: 5pt 6pt;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 10.5pt;
  }

  .center-bold {
    text-align: center;
    font-weight: bold;
    margin: 6pt 0 4pt;
  }
  .small-italic {
    text-align: center;
    font-size: 9.5pt;
    font-style: italic;
    margin-bottom: 4pt;
  }

  table.mrb-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 4pt;
  }
  table.mrb-table th,
  table.mrb-table td {
    border: 1pt solid #000;
    padding: 4pt 5pt;
    font-size: 10.5pt;
    vertical-align: top;
    text-align: left;
  }
  table.mrb-table th {
    text-align: center;
    background: #f2f2f2;
    font-weight: bold;
  }
  table.mrb-table td.center { text-align: center; }
  table.mrb-table tr.empty td { height: 22pt; }

  .disposition-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6pt 14pt;
    margin: 4pt 0 6pt;
    font-size: 10.5pt;
  }
  .disp-item { display: flex; align-items: center; gap: 6pt; }
  .disp-box {
    width: 11pt;
    height: 11pt;
    border: 1pt solid #000;
    display: inline-block;
    flex-shrink: 0;
    position: relative;
  }
  .disp-box.checked::after {
    content: "✓";
    position: absolute;
    inset: -3pt 0 0 1pt;
    text-align: center;
    font-weight: bold;
    font-size: 13pt;
    line-height: 1;
  }

  .status-row {
    display: flex;
    gap: 18pt;
    margin: 8pt 0;
    align-items: center;
  }
  .status-pill {
    border: 1pt solid #000;
    padding: 2pt 16pt;
    font-weight: bold;
    min-width: 60pt;
    text-align: center;
  }
  .status-pill.active { background: #000; color: #fff; }

  .footer-doc {
    display: flex;
    justify-content: space-between;
    margin-top: 14pt;
    padding-top: 4pt;
    border-top: 1pt solid #999;
    font-size: 9.5pt;
    font-style: italic;
  }

  /* Preview wrapper: a white page on the workspace background */
  .mrb-preview-wrap {
    background: #fff;
    padding: 12mm 14mm;
    box-shadow: 0 0 0 1pt #ddd;
  }

  @media print {
    body { margin: 0; padding: 0; }
    .mrb-preview-wrap { box-shadow: none; padding: 0; }
  }

  /* Unified NCR Rev 3 */
  .ncr3-head { text-align: center; margin-bottom: 8pt; }
  .ncr3-head .company { font-size: 15pt; font-weight: bold; }
  .ncr3-head .division { font-size: 11pt; }
  .ncr3-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 16pt; }
  .ncr3-grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; column-gap: 12pt; margin-top: 6pt; }
  .ncr3-f { display: flex; gap: 4pt; padding: 3pt 0; font-size: 10.5pt; }
  .ncr3-l { min-width: 100pt; font-weight: bold; }
  .ncr3-v { flex: 1; border-bottom: 0.75pt dotted #666; min-height: 12pt; }
  .ncr3-sign { display: flex; justify-content: space-between; margin-top: 4pt; font-size: 10.5pt; }

  /* Rev 3 exact layout */
  .mrb-form.ncr3 { font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; font-size: 9.5pt; color: #000; }
  .ncr3-page { position: relative; height: 270mm; overflow: hidden; padding: 0 4mm; }
  .mrb-page.ncr3-page + .mrb-page.ncr3-page { margin-top: 0; page-break-before: always; break-before: page; }
  .ncr3 .ncr3-head { position: relative; text-align: center; border-bottom: 0.8pt solid #000; padding-bottom: 1mm; margin-bottom: 0; }
  .ncr3 .ncr3-head .company { font-size: 16pt; font-weight: bold; line-height: 1.15; }
  .ncr3 .ncr3-head .division { font-size: 10.5pt; font-weight: bold; }
  .ncr3 .ncr3-head .title { position: absolute; left: 0; right: 0; top: 100%; font-size: 10.5pt; font-weight: bold; padding-top: 1mm; }
  .ncr3-logo { position: absolute; right: 0; top: 2mm; height: 9mm; }
  .ncr3-t { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .ncr3-t td, .ncr3-t th { border: 0.6pt solid #000; padding: 0.4mm 1.2mm; vertical-align: middle; overflow: hidden; word-break: break-word; }
  .ncr3-kv { margin-top: 9mm; }
  .ncr3-kv td { height: 4.6mm; font-size: 9pt; }
  .ncr3-kv td.c { width: 2.5%; text-align: left; }
  .ncr3-gap { margin-top: 3mm; }
  .ncr3-lbl { font-weight: bold; font-size: 9.5pt; margin-top: 5mm; margin-bottom: 1mm; }
  .ncr3-area { position: relative; border: 0.6pt solid #000; padding: 1.5mm; overflow: hidden; }
  .ncr3-area .txt { font-size: 9pt; white-space: pre-wrap; }
  .ncr3-area .sig { position: absolute; left: 1.5mm; right: 1.5mm; bottom: 1mm; display: flex; font-size: 9pt; }
  .ncr3-grid-t th { font-weight: bold; font-size: 8.5pt; text-align: center; height: 5mm; }
  .ncr3-grid-t th.left { text-align: left; }
  .ncr3-grid-t td { font-size: 9pt; }
  .ncr3-grid-t td.small { font-size: 8pt; }
  .ncr3-grid-t td.center { text-align: center; }
  .ncr3-disp td { height: 5.5mm; font-size: 9pt; }
  .ncr3-cb { text-align: center; }
  .ncr3-box { display: inline-block; width: 3.6mm; height: 3.6mm; border: 0.6pt solid #000; position: relative; vertical-align: middle; }
  .ncr3-box.on::after { content: "✓"; position: absolute; inset: -1.5mm 0 0 0.3mm; font-weight: bold; font-size: 11pt; line-height: 1; }
  .ncr3-status { width: auto; margin-top: 12mm; }
  .ncr3-status td { font-size: 9pt; height: 4.6mm; padding: 0 2mm; }
  .ncr3-status td.bold { font-weight: bold; width: 25mm; }
  .ncr3-status td.on { font-weight: bold; }
  .ncr3-foot { position: absolute; left: 4mm; right: 4mm; bottom: 0; display: flex; justify-content: space-between; font-size: 7.5pt; }
`;

const MRBPrint = () => {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [mrbList, setMrbList] = useState<{ id: string; mrb_number: string; material_description: string }[]>([]);
  const [searchNumber, setSearchNumber] = useState('');
  const [selectedMRBId, setSelectedMRBId] = useState<string>('');
  const [selectedMRB, setSelectedMRB] = useState<MRBRecord | null>(null);
  const [approverNames, setApproverNames] = useState<ApproverInfo>({});
  const [mrbComments, setMrbComments] = useState<MRBComment[]>([]);
  const { activePlant, activePlants, activePlantsKey } = useActivePlant();

  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [printFormat] = useState<'existing' | 'rev3'>('rev3');

  const formType: 'inward_ncr' | 'shop_floor_ncr' =
    selectedMRB?.source === 'shop_floor' ? 'shop_floor_ncr' : 'inward_ncr';
  const formLabel = formType === 'shop_floor_ncr'
    ? 'Non-Conformity Report (EG-QC-FT-502 Rev0)'
    : 'Non-Conformance Report — IQC (EG-QC-FT-25 Rev2)';

  useEffect(() => {
    const loadMRBList = async () => {
      let q = supabase
        .from('mrb_records')
        .select('id, mrb_number, material_description')
        .order('created_at', { ascending: false });
      if (activePlants.length > 1) {
        q = q.in('plant', activePlants);
      } else if (activePlant && activePlant !== 'all') {
        q = q.eq('plant', activePlant);
      }
      const { data } = await q;
      if (data) setMrbList(data);
    };
    loadMRBList();
    // Reset any selection from a previous plant
    setSelectedMRBId('');
    setSelectedMRB(null);
    setMrbComments([]);
  }, [activePlant, activePlantsKey]);

  const fetchMRBFromDB = async (id: string) => {
    try {
      const mrbRes = await supabase.from('mrb_records').select('*').eq('id', id).maybeSingle();
      if (mrbRes.error) throw mrbRes.error;
      const mrb = mrbRes.data;
      if (!mrb) return;

      setSelectedMRB(mrb);
      setSelectedMRBId(mrb.id);
      setSearchNumber(mrb.mrb_number);

      const { data: history } = await supabase
        .from('mrb_approval_history')
        .select('id, stage, action, remarks, performed_by, performed_by_role, performed_at')
        .eq('mrb_id', mrb.id)
        .order('performed_at', { ascending: true });
      const commentRows = (history || []).filter(
        (h) =>
          (h.remarks || '').trim().length > 0 &&
          !(h.stage === 'Creation' && h.action === 'created')
      );

      const approverIds = [
        mrb.quality_approved_by,
        mrb.purchase_approved_by,
        mrb.engineering_approved_by,
        mrb.final_approved_by,
        ...commentRows.map((h) => h.performed_by),
      ].filter(Boolean) as string[];

      const names: ApproverInfo = {};
      let profileMap = new Map<string, string>();
      if (approverIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', Array.from(new Set(approverIds)));
        profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
        names.quality = profileMap.get(mrb.quality_approved_by || '') || '';
        names.purchase = profileMap.get(mrb.purchase_approved_by || '') || '';
        names.engineering = profileMap.get(mrb.engineering_approved_by || '') || '';
        names.final = profileMap.get(mrb.final_approved_by || '') || '';
      }
      names.committee = mrb.mrb_committee_approved_by || '';
      setApproverNames(names);

      setMrbComments(
        commentRows.map((h) => ({
          id: h.id,
          text: (h.remarks || '').trim(),
          author: profileMap.get(h.performed_by || '') || h.performed_by_role || '',
          date: h.performed_at || null,
          stage: `${h.stage || ''} ${h.performed_by_role || ''}`,
        }))
      );

      toast({ title: 'MRB Loaded', description: `Loaded ${mrb.mrb_number}` });
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
      toast({ title: 'MRB Not Found', description: 'No MRB found with that number', variant: 'destructive' });
    }
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getDispositionChecked = (decision: string | null | undefined) => ({
    use_as_is: decision === 'use_as_is' || decision === 'accept' || decision === 'approved',
    sort: false,
    return_to_vendor: decision === 'return_to_vendor',
    rework: decision === 'rework_required',
    scrap: decision === 'scrap_material' || decision === 'reject' || decision === 'rejected',
    accept_deviation: decision === 'use_with_deviation' || decision === 'partial_accept',
    others: false,
  });

  const getPdfFilename = () =>
    printFormat === 'rev3'
      ? `NCR_REV3_${selectedMRB?.mrb_number || 'MRB'}.pdf`
      : formType === 'shop_floor_ncr'
      ? `NCR_EGQC_${selectedMRB?.mrb_number || 'MRB'}.pdf`
      : `NCR_IQC_${selectedMRB?.mrb_number || 'MRB'}.pdf`;

  const getReportTitle = () =>
    printFormat === 'rev3'
      ? `Non-Conformance Report (Rev 3) - ${selectedMRB?.mrb_number}`
      : formType === 'shop_floor_ncr'
      ? `Non-Conformity Report - ${selectedMRB?.mrb_number}`
      : `Non-Conformance Report (IQC) - ${selectedMRB?.mrb_number}`;

  const buildStandaloneHTML = (innerHTML: string, title: string) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>${title}</title>
<style>${FORM_STYLESHEET}
html,body{margin:0;padding:0;background:#fff;}
@media print{
  body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
}
</style></head><body><div class="mrb-preview-wrap">${innerHTML}</div></body></html>`;

  const waitForImages = async (root: ParentNode) => {
    const imgs = Array.from(root.querySelectorAll('img'));
    await Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise<void>((res) => {
      img.addEventListener('load', () => res(), { once: true });
      img.addEventListener('error', () => res(), { once: true });
      setTimeout(res, 3000);
    })));
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w) {
      toast({ title: 'Print Blocked', description: 'Please allow popups to print.', variant: 'destructive' });
      return;
    }
    w.document.write(buildStandaloneHTML(printRef.current.innerHTML, getReportTitle()));
    w.document.close();
    let printed = false;
    const doPrint = async () => {
      if (printed || w.closed) return;
      printed = true;
      await waitForImages(w.document);
      w.addEventListener('afterprint', () => { try { w.close(); } catch { /* ignore */ } });
      w.focus();
      w.print();
    };
    w.onload = () => { setTimeout(doPrint, 200); };
    setTimeout(doPrint, 1500);
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    const filename = getPdfFilename();
    toast({ title: 'Generating PDF', description: 'Please wait...' });

    try {
      const html2pdf = (await import('html2pdf.js')).default;

      // Build a fully-styled container within the viewport (hidden behind the page) so html2canvas captures every page
      const container = document.createElement('div');
      container.innerHTML = `<style>${FORM_STYLESHEET}</style><div class="mrb-preview-wrap">${printRef.current.innerHTML}</div>`;
      container.style.position = 'fixed';
      container.style.left = '0';
      container.style.top = '0';
      container.style.width = '182mm';
      container.style.zIndex = '-9999';
      container.style.pointerEvents = 'none';
      container.style.background = '#fff';
      document.body.appendChild(container);

      try {
        await waitForImages(container);
        await html2pdf()
          .set({
            margin: [12, 14, 12, 14],
            filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css'] },
          })
          .from(container)
          .save();

        toast({ title: 'PDF Downloaded', description: `${filename} saved.` });
      } finally {
        document.body.removeChild(container);
      }
    } catch (error) {
      console.error('PDF error:', error);
      toast({ title: 'PDF Error', description: 'Failed to generate PDF.', variant: 'destructive' });
    }
  };

  const handlePreview = () => {
    if (!printRef.current) return;
    setPreviewContent(`<style>${FORM_STYLESHEET}</style><div class="mrb-preview-wrap">${printRef.current.innerHTML}</div>`);
    setPreviewTitle(getReportTitle());
    setShowPreview(true);
  };

  // ===================================================================
  // BRAND HEADER (used at top of every printed page)
  // ===================================================================
  const BrandHeader = () => (
    <div className="mrb-header">
      <div className="logo-spacer" />
      <div className="brand">
        <div className="company">HBL Engineering Limited</div>
        <div className="division">Rail Signaling Division</div>
      </div>
      <img src={hblLogo} alt="HBL" className="logo" />
    </div>
  );

  // ===================================================================
  // INWARD — NON-CONFORMANCE REPORT (IQC) — EG-QC-FT-25 Rev2 (2 pages)
  // ===================================================================
  const InwardNCRReport = () => {
    const m = selectedMRB;
    const checked = getDispositionChecked(m?.final_decision || m?.engineering_decision);
    const isClosed = m?.status === 'closed' || m?.status === 'approved';
    const ncrStatus = m?.closure_status || (isClosed ? 'close' : 'open');
    const isOpen = ncrStatus !== 'close' && !isClosed;

    const mrbRows = [
      { dept: 'R & D / Safety', name: '', date: '' },
      { dept: 'Engineering', name: approverNames.engineering, date: m?.engineering_approved_at },
      { dept: 'RE Operations', name: '', date: '' },
      { dept: 'I & C', name: '', date: '' },
      { dept: 'Quality Assurance', name: approverNames.committee, date: m?.mrb_committee_approved_at },
      { dept: 'Quality Control', name: approverNames.quality, date: m?.quality_approved_at },
      { dept: 'Purchase', name: approverNames.purchase, date: m?.purchase_approved_at },
    ];

    return (
      <div ref={printRef} className="mrb-form">
        {/* ============== PAGE 1 ============== */}
        <div className="mrb-page">
          <BrandHeader />
          <div className="mrb-title">NON-CONFORMANCE REPORT (IQC)</div>

          <div className="field-row">
            <div className="field"><span className="lbl">GRN No.&nbsp;:</span><span className="val">{m?.grn_number || ''}</span></div>
            <div className="field"><span className="lbl">NC Report No:</span><span className="val">{m?.mrb_number || ''}</span></div>
          </div>
          <div className="field-row">
            <div className="field"><span className="lbl">GRN Date&nbsp;:</span><span className="val">{formatDate(m?.grn_date || m?.created_at)}</span></div>
            <div className="field"><span className="lbl">NC Report Date:</span><span className="val">{formatDate(m?.created_at)}</span></div>
          </div>
          <div className="field-row">
            <div className="field"><span className="lbl">DC / INV No&nbsp;:</span><span className="val">{m?.grn_item_number || ''}</span></div>
            <div className="field"><span className="lbl">DC / INV Date:</span><span className="val">{formatDate(m?.grn_date)}</span></div>
          </div>
          <div className="field-row">
            <div className="field full"><span className="lbl">Supplier Name:</span><span className="val">{m?.vendor_name || ''}{m?.vendor_code ? ` (${m.vendor_code})` : ''}</span></div>
          </div>
          <div className="field-row">
            <div className="field"><span className="lbl">P O No.&nbsp;:</span><span className="val">{m?.po_number || ''}</span></div>
            <div className="field"><span className="lbl">Item Code:</span><span className="val">{m?.material_number || ''}</span></div>
          </div>
          <div className="field-row">
            <div className="field full"><span className="lbl">Item Desc. &amp; Make:</span><span className="val">{m?.material_description || ''}</span></div>
          </div>
          <div className="field-row">
            <div className="field"><span className="lbl">Received Qty:</span><span className="val">{m?.total_quantity ?? ''} {m?.uom || ''}</span></div>
            <div className="field"><span className="lbl">Accepted Qty:</span><span className="val">{m?.accepted_quantity ?? ''}</span></div>
            <div className="field"><span className="lbl">Rejected Qty:</span><span className="val">{m?.rejected_quantity ?? ''}</span></div>
          </div>

          <div className="block-label">Non-Conformance Details:</div>
          <div className="block-box" style={{ minHeight: '90pt' }}>
            {[
              m?.defect_category ? `Defect Category: ${m.defect_category}${m?.defect_code ? ` (${m.defect_code})` : ''}` : '',
              m?.defect_description || '',
              m?.quality_remarks ? `Quality Remarks: ${m.quality_remarks}` : '',
            ].filter(Boolean).join('\n')}
          </div>

          <div className="field-row" style={{ marginTop: '10pt' }}>
            <div className="field"><span className="lbl">Initiator Name:</span><span className="val">{approverNames.quality || ''}</span></div>
            <div className="field"><span className="lbl">Sign:</span><span className="val">&nbsp;</span></div>
          </div>

          <div className="center-bold" style={{ marginTop: '8pt' }}>
            Material Review Board (If applicable)&nbsp;&nbsp;Yes&nbsp;/&nbsp;No
          </div>
          <div className="small-italic">Initiator has to tick</div>

          <div className="center-bold">DETAILED INSTRUCTIONS OF MRB</div>
          <table className="mrb-table">
            <thead>
              <tr>
                <th style={{ width: '10%' }}>S. No.</th>
                <th>Instructions</th>
                <th style={{ width: '22%' }}>Responsibility<br />Name &amp; Sign</th>
                <th style={{ width: '18%' }}>Target Date</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                if (mrbComments.length > 0) {
                  const rows = mrbComments.map((c, i) => (
                    <tr key={c.id}>
                      <td className="center">{i + 1}</td>
                      <td>{c.text}</td>
                      <td>{c.author}</td>
                      <td className="center">{formatDate(c.date) || formatDate(m?.expected_replacement_date)}</td>
                    </tr>
                  ));
                  const pad = Array.from({ length: Math.max(0, 5 - mrbComments.length) }).map((_, i) => (
                    <tr key={`b${i}`} className="empty"><td></td><td></td><td></td><td></td></tr>
                  ));
                  return [...rows, ...pad];
                }
                const instructions: string[] = [];
                if (m?.engineering_remarks) instructions.push(m.engineering_remarks);
                if (m?.purchase_remarks) instructions.push(m.purchase_remarks);
                if (m?.mrb_committee_remarks) instructions.push(m.mrb_committee_remarks);
                const filled = instructions.map((txt, i) => (
                  <tr key={i}>
                    <td className="center">{i + 1}</td>
                    <td>{txt}</td>
                    <td>{i === 0 ? approverNames.engineering || '' : i === 1 ? approverNames.purchase || '' : approverNames.committee || ''}</td>
                    <td className="center">{formatDate(m?.expected_replacement_date)}</td>
                  </tr>
                ));
                const blanks = Array.from({ length: Math.max(0, 5 - instructions.length) }).map((_, i) => (
                  <tr key={`b${i}`} className="empty"><td></td><td></td><td></td><td></td></tr>
                ));
                return [...filled, ...blanks];
              })()}
            </tbody>
          </table>

          <div className="footer-doc">
            <span>EG-QC-FT-25 Rev2</span>
            <span>Page 1 of 2</span>
          </div>
        </div>

        {/* ============== PAGE 2 ============== */}
        <div className="mrb-page">
          <BrandHeader />
          <div className="mrb-title">NON-CONFORMANCE REPORT (IQC)</div>

          <div className="block-label">Material/Product Disposition:</div>
          <div className="disposition-grid">
            <div className="disp-item"><span className={`disp-box${checked.use_as_is ? ' checked' : ''}`} />Use as Is (documented rationale required)</div>
            <div className="disp-item"><span className={`disp-box${checked.sort ? ' checked' : ''}`} />Sort (attach instructions)</div>
            <div className="disp-item"><span className={`disp-box${checked.return_to_vendor ? ' checked' : ''}`} />Return to supplier</div>
            <div className="disp-item"><span className={`disp-box${checked.rework ? ' checked' : ''}`} />Rework (attach instructions)</div>
            <div className="disp-item"><span className={`disp-box${checked.scrap ? ' checked' : ''}`} />Scrap (attach scrap report)</div>
            <div className="disp-item"><span className={`disp-box${checked.accept_deviation || checked.others ? ' checked' : ''}`} />Others (attach instructions)</div>
          </div>

          <div className="block-label" style={{ marginTop: '10pt' }}>Material Review Board Approvals:</div>
          <table className="mrb-table">
            <thead>
              <tr>
                <th style={{ width: '24%' }}>Department</th>
                <th>Name</th>
                <th style={{ width: '20%' }}>Sign</th>
                <th style={{ width: '18%' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {mrbRows.map((r, i) => (
                <tr key={i}>
                  <td>{r.dept}</td>
                  <td>{r.name || ''}</td>
                  <td></td>
                  <td className="center">{formatDate(r.date) || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="block-label" style={{ marginTop: '10pt' }}>NCR Status:</div>
          <div className="block-box" style={{ minHeight: '60pt' }}>
            <strong>Comments: </strong>
            {m?.final_remarks || m?.mrb_committee_remarks || ''}
          </div>

          <div className="status-row">
            <span className={`status-pill${isOpen ? ' active' : ''}`}>Open</span>
            <span className={`status-pill${!isOpen ? ' active' : ''}`}>Close</span>
          </div>

          <div className="field-row" style={{ marginTop: '14pt' }}>
            <div className="field" style={{ flex: 2 }}>
              <span className="lbl">Quality Control:</span>
              <span className="val">{approverNames.quality || ''}</span>
            </div>
            <div className="field"><span className="lbl">Date:</span><span className="val">{formatDate(m?.quality_approved_at)}</span></div>
          </div>
          <div style={{ textAlign: 'center', fontSize: '9pt', fontStyle: 'italic', marginTop: '2pt' }}>Name and Sign</div>

          <div className="footer-doc">
            <span>EG-QC-FT-25 Rev2</span>
            <span>Page 2 of 2</span>
          </div>
        </div>
      </div>
    );
  };

  // ===================================================================
  // UNIFIED — NON-CONFORMANCE REPORT — EG-QC-FT-25 REV 3 (2 pages)
  // ===================================================================
  const UnifiedNCRReport = () => {
    const m = selectedMRB;
    const checked = getDispositionChecked(m?.final_decision || m?.engineering_decision);
    const isClosed = m?.status === 'closed' || m?.status === 'approved' || m?.closure_status === 'close' || m?.closure_status === 'closed';
    const commentsFor = (keys: string[]) =>
      mrbComments.filter((c) => keys.some((k) => (c.stage || '').toLowerCase().includes(k)));
    const reviewRows = [
      { dept: 'Purchase', items: commentsFor(['purchase']) },
      { dept: 'Engineering', items: commentsFor(['engineering', 'design']) },
      { dept: 'Production', items: commentsFor(['production', 'shop']) },
      { dept: 'Quality Control', items: commentsFor(['quality', 'committee', 'final']) },
    ];
    const approvals = [
      { dept: 'Purchase', name: approverNames.purchase, date: m?.purchase_approved_at },
      { dept: 'Engineering', name: approverNames.engineering, date: m?.engineering_approved_at },
      { dept: 'Production', name: '', date: '' },
      { dept: 'Quality Control', name: approverNames.quality, date: m?.quality_approved_at },
    ];
    const stores = [
      m?.return_delivery_number && `Return Delivery No: ${m.return_delivery_number}`,
      m?.rework_order_number && `Rework Order No: ${m.rework_order_number}`,
      m?.scrap_document_number && `Scrap Document No: ${m.scrap_document_number}`,
      m?.final_remarks,
    ].filter(Boolean) as string[];
    const D = (v?: string | number | null) => (v === null || v === undefined ? '' : String(v));
    const Row2 = ({ l1, v1, l2, v2 }: { l1: string; v1?: string | number | null; l2: string; v2?: string | number | null }) => (
      <tr><td className="l">{l1}</td><td className="c">:</td><td className="v">{D(v1)}</td><td className="l">{l2}</td><td className="c">:</td><td className="v">{D(v2)}</td></tr>
    );
    const Header = () => (
      <div className="ncr3-head">
        <img src={hblLogo} alt="HBL" className="ncr3-logo" />
        <div className="company">HBL Engineering Limited</div>
        <div className="division">Electronics Group</div>
        <div className="title">NON-CONFORMANCE REPORT</div>
      </div>
    );
    const Footer = ({ n }: { n: number }) => (
      <div className="ncr3-foot"><span>EG-QC-FT-25 REV 3</span><span>Page {n} of 2</span></div>
    );
    const Box = ({ on }: { on?: boolean }) => <td className="ncr3-cb"><span className={`ncr3-box${on ? ' on' : ''}`} /></td>;
    return (
      <div ref={printRef} className="mrb-form ncr3">
        <div className="mrb-page ncr3-page">
          <Header />
          <table className="ncr3-t ncr3-kv">
            <colgroup><col style={{ width: '17%' }} /><col style={{ width: '3%' }} /><col style={{ width: '17%' }} /><col style={{ width: '17%' }} /><col style={{ width: '3%' }} /><col /></colgroup>
            <tbody>
              <Row2 l1="GRN No" v1={m?.grn_number} l2="NC Report No" v2={m?.mrb_number} />
              <Row2 l1="GRN Date" v1={formatDate(m?.grn_date)} l2="NC Report Date" v2={formatDate(m?.created_at)} />
              <Row2 l1="DC/INV No" v1="" l2="WO No" v2={m?.production_order_number} />
              <Row2 l1="DC/INV Date" v1="" l2="WO Date" v2="" />
              <Row2 l1="Vendor Code" v1={m?.vendor_code} l2="PO No. & Date" v2={m?.po_number} />
              <Row2 l1="Vendor Name" v1={m?.vendor_name} l2="Item Code" v2={m?.material_number} />
              <tr><td className="l">Item Description</td><td className="c">:</td><td className="v" colSpan={4}>{D(m?.material_description)}</td></tr>
            </tbody>
          </table>
          <table className="ncr3-t ncr3-kv ncr3-gap">
            <tbody><tr>
              <td className="l">Received QTY</td><td className="c">:</td><td className="v">{D(m?.total_quantity)}</td>
              <td className="l">Accepted QTY</td><td className="c">:</td><td className="v">{D(m?.accepted_quantity ?? m?.final_approved_quantity)}</td>
              <td className="l">Rejected QTY</td><td className="c">:</td><td className="v">{D(m?.rejected_quantity ?? m?.final_rejected_quantity ?? m?.blocked_quantity)}</td>
            </tr></tbody>
          </table>
          <table className="ncr3-t ncr3-kv ncr3-gap">
            <tbody><tr><td className="l" style={{ width: '20%' }}>Rejected QTY Sl Nos</td><td className="c" style={{ width: '3%' }}>:</td><td className="v">{D(m?.batch)}</td></tr></tbody>
          </table>

          <div className="ncr3-lbl">Non-Conformance details:</div>
          <div className="ncr3-area" style={{ height: '30mm' }}>
            <div className="txt">{[m?.defect_code, m?.defect_description || m?.issue_description].filter(Boolean).join(' - ')}</div>
            <div className="sig"><span style={{ width: '50%' }}>Initiator Name: {m?.issue_identified_by || approverNames.quality || ''}</span><span>Signature:</span></div>
          </div>

          <div className="ncr3-lbl">Process QC Comments:</div>
          <div className="ncr3-area" style={{ height: '28mm' }}>
            <div className="txt">{m?.quality_remarks || ''}</div>
            <div className="sig"><span style={{ width: '38%' }}>Name: {approverNames.quality || ''}</span><span>Signature</span></div>
          </div>

          <div className="ncr3-lbl" style={{ marginTop: '6mm' }}>REVIEW by Material Review Board (Root Cause Analysis &amp; CAPA)</div>
          <table className="ncr3-t ncr3-grid-t">
            <colgroup><col style={{ width: '18%' }} /><col /></colgroup>
            <thead><tr><th>Department</th><th className="left">Review comments by MRB</th></tr></thead>
            <tbody>
              {reviewRows.map((r) => (
                <tr key={r.dept} style={{ height: '13mm' }}>
                  <td>{r.dept}</td>
                  <td className="small">{r.items.map((c) => <div key={c.id}>{c.text}{c.author ? ` — ${c.author}` : ''}</div>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Footer n={1} />
        </div>

        <div className="mrb-page ncr3-page">
          <Header />
          <div className="ncr3-lbl" style={{ marginTop: '2mm' }}>Material / Product disposition (by MRB):</div>
          <table className="ncr3-t ncr3-disp">
            <colgroup><col style={{ width: '5%' }} /><col style={{ width: '45%' }} /><col style={{ width: '5%' }} /><col /></colgroup>
            <tbody>
              <tr><Box on={checked.accept_deviation || checked.use_as_is} /><td>Accept under deviation</td><Box on={checked.return_to_vendor} /><td>Return to spplier</td></tr>
              <tr><Box on={checked.rework} /><td>Rework</td><Box on={checked.sort} /><td>Sort</td></tr>
              <tr><Box on={checked.scrap} /><td>Scrap</td><Box on={checked.others} /><td>Others</td></tr>
            </tbody>
          </table>

          <div className="ncr3-lbl">Material Review Board Approvals:</div>
          <table className="ncr3-t ncr3-grid-t">
            <colgroup><col style={{ width: '22%' }} /><col style={{ width: '30%' }} /><col style={{ width: '28%' }} /><col /></colgroup>
            <thead><tr><th>Department</th><th>Name</th><th>Sign</th><th>Date</th></tr></thead>
            <tbody>
              {approvals.map((r) => (
                <tr key={r.dept} style={{ height: '8.5mm' }}><td>{r.dept}</td><td>{r.name || ''}</td><td></td><td className="center">{formatDate(r.date) || ''}</td></tr>
              ))}
            </tbody>
          </table>

          <div className="ncr3-lbl" style={{ marginTop: '7mm' }}>Disposition of Non-Confirming Material (by STORES):</div>
          <div className="ncr3-area" style={{ height: '34mm' }}>
            <div className="txt">{stores.map((s, i) => <div key={i}>{s}</div>)}</div>
          </div>

          <table className="ncr3-t ncr3-status">
            <tbody><tr>
              <td className="bold">NCR Status</td><td className="c">:</td>
              <td className={!isClosed ? 'on' : ''}>{!isClosed ? '✓ ' : ''}OPEN</td>
              <td className={isClosed ? 'on' : ''}>{isClosed ? '✓ ' : ''}CLOSED</td>
            </tr></tbody>
          </table>
          <Footer n={2} />
        </div>
      </div>
    );
  };

  // ===================================================================
  // SHOP FLOOR — NON-CONFORMITY REPORT — EG-QC-FT-502 Rev0 (1 page)
  // ===================================================================
  const ShopFloorNCRReport = () => {
    const m = selectedMRB;
    const checked = getDispositionChecked(m?.final_decision || m?.engineering_decision);
    const initiator = approverNames.quality || m?.issue_identified_by || '';
    const initiatorDate = formatDate(m?.issue_identified_date || m?.created_at);

    return (
      <div ref={printRef} className="mrb-form">
        <div className="mrb-page">
          <BrandHeader />
          <div className="mrb-title">NON-CONFORMITY REPORT</div>

          <div className="center-bold" style={{ textAlign: 'left', marginTop: '4pt' }}>INITIATOR</div>
          <div className="field-row">
            <div className="field"><span className="lbl">NCR #:</span><span className="val">{m?.mrb_number || ''}</span></div>
            <div className="field"><span className="lbl">Part # / QTY:</span><span className="val">{m?.material_number || ''} / {m?.total_quantity ?? ''} {m?.uom || ''}</span></div>
          </div>
          <div className="field-row">
            <div className="field"><span className="lbl">Lot / Serial #'s:</span><span className="val">{m?.batch || m?.production_order_number || ''}</span></div>
            <div className="field"><span className="lbl">Vendor (if applicable):</span><span className="val">{m?.vendor_name || ''}</span></div>
          </div>
          <div className="field-row">
            <div className="field"><span className="lbl">Initiator Name:</span><span className="val">{initiator}</span></div>
            <div className="field"><span className="lbl">Date:</span><span className="val">{initiatorDate}</span></div>
          </div>

          <div className="block-label">Material / Product Description:</div>
          <div className="block-box" style={{ minHeight: '40pt' }}>{m?.material_description || ''}</div>

          <div className="block-label">Deviation Summary (attach applicable inspection form):</div>
          <div className="block-box" style={{ minHeight: '70pt' }}>
            {[
              m?.defect_category ? `Defect Category: ${m.defect_category}${m?.defect_code ? ` (${m.defect_code})` : ''}` : '',
              m?.defect_description || '',
              m?.issue_description ? `Issue: ${m.issue_description}` : '',
              m?.impact_on_production ? `Impact on Production: ${m.impact_on_production}` : '',
              m?.production_order_number ? `Production Order: ${m.production_order_number}` : '',
              m?.quality_remarks ? `Quality Remarks: ${m.quality_remarks}` : '',
            ].filter(Boolean).join('\n')}
          </div>

          <div className="center-bold" style={{ marginTop: '10pt', textDecoration: 'underline' }}>
            MATERIAL REVIEW BOARD (MRB)
          </div>

          <div className="block-label">Material/Product Disposition:</div>
          <div className="disposition-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="disp-item"><span className={`disp-box${checked.scrap ? ' checked' : ''}`} />Scrap (attach scrap report)</div>
            <div className="disp-item"><span className={`disp-box${checked.rework ? ' checked' : ''}`} />Rework (attach instructions)</div>
            <div className="disp-item"><span className={`disp-box${checked.sort ? ' checked' : ''}`} />Sort (attach instructions)</div>
            <div className="disp-item"><span className={`disp-box${checked.return_to_vendor ? ' checked' : ''}`} />Return to Supplier</div>
            <div className="disp-item"><span className={`disp-box${checked.accept_deviation ? ' checked' : ''}`} />Accept under Deviation</div>
            <div className="disp-item"><span className={`disp-box${checked.others ? ' checked' : ''}`} />Other ____________________</div>
          </div>

          <div className="block-label">Justification for acceptance:</div>
          <div className="block-box" style={{ minHeight: '50pt' }}>{m?.engineering_remarks || m?.final_remarks || ''}</div>

          <div className="block-label" style={{ marginTop: '10pt' }}>Material Review Board Approvals:</div>
          <table className="mrb-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Department</th>
                <th>Sign and Name</th>
                <th style={{ width: '20%' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Engineering</td>
                <td>{approverNames.engineering || ''}</td>
                <td className="center">{formatDate(m?.engineering_approved_at)}</td>
              </tr>
              <tr>
                <td>Purchase</td>
                <td>{approverNames.purchase || ''}</td>
                <td className="center">{formatDate(m?.purchase_approved_at)}</td>
              </tr>
              <tr>
                <td>CUSTOMER</td>
                <td></td>
                <td></td>
              </tr>
              <tr>
                <td>Quality Assurance</td>
                <td>{approverNames.quality || ''}</td>
                <td className="center">{formatDate(m?.quality_approved_at)}</td>
              </tr>
            </tbody>
          </table>

          <div className="center-bold" style={{ marginTop: '12pt', textDecoration: 'underline' }}>
            QUALITY ASSURANCE
          </div>

          <div className="block-label">NCR Verification of Completed Actions and Closure:</div>
          <div className="block-box" style={{ minHeight: '55pt' }}>
            {m?.final_remarks || ''}
          </div>

          <div className="field-row" style={{ marginTop: '12pt' }}>
            <div className="field" style={{ flex: 2 }}>
              <span className="lbl">Quality Assurance:</span>
              <span className="val">{approverNames.final || approverNames.quality || ''}</span>
            </div>
            <div className="field"><span className="lbl">Date:</span><span className="val">{formatDate(m?.final_approved_at || m?.quality_approved_at)}</span></div>
          </div>
          <div style={{ textAlign: 'center', fontSize: '9pt', fontStyle: 'italic', marginTop: '2pt' }}>Sign and Name</div>

          <div className="footer-doc">
            <span>EG-QC-FT-502 Rev0</span>
            <span>&nbsp;</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6 overflow-auto h-full">
      {/* Inject the form stylesheet so on-screen preview matches exactly */}
      <style dangerouslySetInnerHTML={{ __html: FORM_STYLESHEET }} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            MRB Print Forms
          </CardTitle>
          <CardDescription>
            Search an MRB to generate the regulated NCR form. Layout auto-selects from MRB source.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <Select value={selectedMRBId} onValueChange={fetchMRBFromDB}>
                <SelectTrigger><SelectValue placeholder="Select MRB" /></SelectTrigger>
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

      {selectedMRB ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Print Form — {selectedMRB.mrb_number}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Format:</span>
                <Badge variant="secondary">NCR — EG-QC-FT-25 Rev 3</Badge>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button onClick={handlePreview} variant="outline" size="sm" className="gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </Button>
                <Button onClick={handlePrint} size="sm" className="gap-1.5">
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </Button>
                <Button onClick={handleDownloadPDF} variant="secondary" size="sm" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  PDF
                </Button>
              </div>
            </div>

            <div className="overflow-auto rounded-lg border bg-muted/30 p-4 sm:p-8">
              <div className="mrb-preview-wrap">
                {printFormat === 'rev3'
                  ? <UnifiedNCRReport />
                  : formType === 'shop_floor_ncr' ? <ShopFloorNCRReport /> : <InwardNCRReport />}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="rounded-full border bg-muted p-3">
              <Printer className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Select an MRB to preview</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Use the search box or dropdown above to load an MRB record before printing or downloading the form.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <PrintPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        content={previewContent}
        title={previewTitle}
        orientation="portrait"
        onPrint={() => { handlePrint(); setShowPreview(false); }}
        onDownloadPDF={() => { handleDownloadPDF(); setShowPreview(false); }}
      />
    </div>
  );
};

export default MRBPrint;
