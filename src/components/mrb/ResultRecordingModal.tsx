import { useEffect, useMemo, useState } from 'react';
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

const CHAR_COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'INSPCHAR', label: 'Char #' },
  { key: 'KURZTEXT', label: 'Characteristic' },
  { key: 'CODE_DESP', label: 'Result' },
  { key: 'BEWERTUNG', label: 'Valuation' },
  { key: 'SOLLSTPUMF', label: 'Required Samples' },
  { key: 'MENGENEINH', label: 'UoM' },
  { key: 'TOLGRENZE', label: 'Tolerance' },
];

const RESVAL_COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'RES_NO', label: 'Res #' },
  { key: 'RES_VALUE', label: 'Value' },
  { key: 'RES_VALUAT', label: 'Valuation' },
  { key: 'INSPECTOR', label: 'Inspector' },
  { key: 'CODE1', label: 'Code' },
  { key: 'ORIGINAL_INPUT', label: 'Original Input' },
  { key: 'REMARK', label: 'Remark' },
  { key: 'BATCH', label: 'Batch' },
  { key: 'FORMULA', label: 'Formula' },
];

const HEADER_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'INSPLOT', label: 'Inspection Lot' },
  { key: 'MATNR', label: 'Material' },
  { key: 'MAKTX', label: 'Description' },
  { key: 'CHARG', label: 'Batch' },
  { key: 'ZZGRN', label: 'GRN' },
  { key: 'ZZSUPL', label: 'Vendor' },
  { key: 'LOSMENGE', label: 'Lot Qty' },
  { key: 'MENGENEINH', label: 'UoM' },
];

export function ResultRecordingModal({ open, onClose, inspectionLot, inspOper }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());

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
          // unwrap {ok, data} or use resp directly
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
              {/* Header chips */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 rounded-md border bg-muted/30">
                {HEADER_FIELDS.map(f => (
                  <div key={f.key} className="text-xs">
                    <div className="text-muted-foreground">{f.label}</div>
                    <div className="font-medium break-all">{fmt(data[f.key])}</div>
                  </div>
                ))}
              </div>

              {/* CHAR table */}
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="w-10 p-2"></th>
                      {CHAR_COLUMNS.map(c => (
                        <th key={c.key} className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chars.length === 0 ? (
                      <tr>
                        <td colSpan={CHAR_COLUMNS.length + 1} className="p-6 text-center text-muted-foreground">
                          No characteristics returned for this inspection lot.
                        </td>
                      </tr>
                    ) : chars.map((c, idx) => {
                      const key = c.INSPCHAR ?? idx;
                      const isOpen = expanded.has(key);
                      const subRows = resvalByChar.get(String(c.INSPCHAR)) || [];
                      return (
                        <>
                          <tr key={`row-${key}`} className="border-t hover:bg-muted/30">
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
                            {CHAR_COLUMNS.map(col => (
                              <td key={col.key} className="p-2 align-middle whitespace-nowrap">
                                {col.key === 'BEWERTUNG' && c[col.key] ? (
                                  <Badge variant={c[col.key] === 'A' ? 'default' : 'destructive'}>{c[col.key]}</Badge>
                                ) : fmt(c[col.key])}
                              </td>
                            ))}
                          </tr>
                          {isOpen && (
                            <tr key={`sub-${key}`} className="bg-muted/20">
                              <td colSpan={CHAR_COLUMNS.length + 1} className="p-3">
                                <div className="text-xs font-medium text-muted-foreground mb-2">
                                  Result Values (RESVAL) for INSPCHAR {String(c.INSPCHAR)}
                                </div>
                                {subRows.length === 0 ? (
                                  <div className="text-sm text-muted-foreground italic">No result values recorded.</div>
                                ) : (
                                  <div className="border rounded overflow-x-auto bg-background">
                                    <table className="w-full text-xs">
                                      <thead className="bg-muted/40">
                                        <tr>
                                          {RESVAL_COLUMNS.map(rc => (
                                            <th key={rc.key} className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap">{rc.label}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {subRows.map((r, i) => (
                                          <tr key={i} className="border-t">
                                            {RESVAL_COLUMNS.map(rc => (
                                              <td key={rc.key} className="p-2 whitespace-nowrap">{fmt(r[rc.key])}</td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
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