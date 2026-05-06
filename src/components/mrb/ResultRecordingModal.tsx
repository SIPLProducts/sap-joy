import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronDown, Loader2, AlertTriangle } from 'lucide-react';
import { invokeResultRecording } from '@/lib/sapSyncClient';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  inspectionLot: string | number | null;
  inspOper?: string;
}

type Col = { key: string; label: string };

const DEFAULT_HEADER_FIELDS: Col[] = [
  { key: 'INSPLOT', label: 'Inspection Lot' },
  { key: 'MATNR', label: 'Material' },
  { key: 'MAKTX', label: 'Description' },
  { key: 'CHARG', label: 'Batch' },
  { key: 'ZZGRN', label: 'GRN' },
  { key: 'ZZSUPL', label: 'Vendor' },
  { key: 'LOSMENGE', label: 'Lot Qty' },
  { key: 'MENGENEINH', label: 'UoM' },
];

const RESULT_COLUMNS: Col[] = [
  { key: 'CHAR_NO', label: 'Char NO' },
  { key: 'CHAR_TYPE', label: 'Char Type' },
  { key: 'CHAR_NAME', label: 'Characteristic Name' },
  { key: 'SPECIFICATIONS', label: 'Specifications' },
  { key: 'SAMPLE', label: 'Sample' },
  { key: 'RESULT', label: 'Result' },
  { key: 'VISUAL_RESULT', label: 'Visual Result' },
  { key: 'AR', label: 'A/R' },
  { key: 'REMARKS', label: 'Remarks' },
];

function resolveCharCell(key: string, c: any): any {
  switch (key) {
    case 'CHAR_NO': return c?.INSPCHAR;
    case 'CHAR_TYPE': return c?.KATAB1;
    case 'CHAR_NAME': return c?.KURZTEXT;
    case 'SPECIFICATIONS': return c?.TOLGRENZE;
    case 'SAMPLE': return c?.SOLLSTPUMF;
    case 'RESULT':
      return String(c?.KATAB1) === 'X' ? c?.NONCONF : c?.MEAN_VALUE;
    case 'VISUAL_RESULT':
      if (c?.BEWERTUNG === 'A') return c?.CODE_DESP;
      if (c?.BEWERTUNG === 'R') return c?.CODE_DESP_1;
      return '';
    case 'AR': return c?.BEWERTUNG;
    case 'REMARKS': return c?.REMARK;
    default: return '';
  }
}

function resolveResvalCell(key: string, c: any, r: any): any {
  switch (key) {
    case 'CHAR_NO': return r?.RES_NO;
    case 'RESULT': return r?.RES_VALUE;
    case 'REMARKS': return r?.REMARK;
    case 'VISUAL_RESULT': return '';
    default: return resolveCharCell(key, c);
  }
}

export function ResultRecordingModal({ open, onClose, inspectionLot, inspOper }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const headerFields = DEFAULT_HEADER_FIELDS;

  useEffect(() => {
    if (!open || !inspectionLot) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setExpanded(new Set());
    invokeResultRecording({ inspectionLot, inspOper })
      .then(({ data: resp, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message || 'Failed to fetch result recording');
          toast({ title: 'Result Recording failed', description: err.message, variant: 'destructive' });
        } else if (resp?.ok === false) {
          setError(resp.error || 'SAP returned an error');
        } else {
          setData(resp?.data ?? resp);
        }
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || 'Network error');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, inspectionLot, inspOper]);

  const chars: any[] = Array.isArray(data?.CHAR) ? data.CHAR : [];
  const resvals: any[] = Array.isArray(data?.RESVAL) ? data.RESVAL : [];
  const resvalByChar = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const r of resvals) {
      const k = String(r.INSPCHAR);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return map;
  }, [resvals]);

  const toggle = (key: string | number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const fmt = (v: any) => (v === null || v === undefined || v === '' ? '-' : String(v));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Result Recording</DialogTitle>
          <DialogDescription>
            Inspection results from SAP for Lot <span className="font-mono">{String(inspectionLot ?? '-')}</span> · Operation <span className="font-mono">{inspOper || '0010'}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Fetching result recording from SAP…
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {data && !loading && !error && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 rounded-md border bg-muted/30">
                {headerFields.map(f => (
                  <div key={f.key + f.label} className="text-xs">
                    <div className="text-muted-foreground">{f.label}</div>
                    <div className="font-medium break-all">{fmt(data[f.key])}</div>
                  </div>
                ))}
              </div>

              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="w-10 p-2"></th>
                      {RESULT_COLUMNS.map(c => (
                        <th key={c.key + c.label} className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chars.length === 0 ? (
                      <tr>
                        <td colSpan={RESULT_COLUMNS.length + 1} className="p-6 text-center text-muted-foreground">
                          No characteristics returned for this inspection lot.
                        </td>
                      </tr>
                    ) : chars.map((c, idx) => {
                      const key = c.INSPCHAR ?? idx;
                      const isOpen = expanded.has(key);
                      const subRows = resvalByChar.get(String(c.INSPCHAR)) || [];
                      return (
                        <Fragment key={`grp-${key}`}>
                          <tr className="border-t hover:bg-muted/30">
                            <td className="p-2 align-middle">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => toggle(key)}
                                aria-label={isOpen ? 'Collapse' : 'Expand'}
                              >
                                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                            </td>
                            {RESULT_COLUMNS.map(col => {
                              const v = resolveCharCell(col.key, c);
                              return (
                                <td key={col.key + col.label} className="p-2 align-middle whitespace-nowrap">
                                  {col.key === 'AR' && v ? (
                                    <Badge variant={v === 'A' ? 'default' : 'destructive'}>{v}</Badge>
                                  ) : fmt(v)}
                                </td>
                              );
                            })}
                          </tr>
                          {isOpen && subRows.length === 0 && (
                            <tr className="bg-muted/10 border-t">
                              <td></td>
                              <td colSpan={RESULT_COLUMNS.length} className="p-2 pl-8 text-xs italic text-muted-foreground">
                                No result values recorded.
                              </td>
                            </tr>
                          )}
                          {isOpen && subRows.map((r, i) => (
                            <tr key={`sub-${key}-${i}`} className="border-t bg-muted/10 hover:bg-muted/20">
                              <td></td>
                              {RESULT_COLUMNS.map((col, ci) => {
                                const v = col.key === 'CHAR_NO'
                                  ? `${c?.INSPCHAR ?? ''}.${r?.RES_NO ?? ''}`
                                  : resolveResvalCell(col.key, c, r);
                                return (
                                  <td
                                    key={col.key + col.label}
                                    className={`p-2 align-middle whitespace-nowrap ${ci === 0 ? 'pl-8' : ''}`}
                                  >
                                    {col.key === 'AR' && v ? (
                                      <Badge variant={v === 'A' ? 'default' : 'destructive'}>{v}</Badge>
                                    ) : fmt(v)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ResultRecordingModal;
