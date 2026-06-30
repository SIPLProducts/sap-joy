import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Search, RotateCcw, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActivePlant } from '@/hooks/useActivePlant';
import { useRoleMatrix } from '@/hooks/useRoleMatrix';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface QualityInfoRow {
  id: string;
  materialCode: string;
  vendorCode: string | null;
  plant: string;
  date: string;
  inspectionLot: string | null;
  submitted: boolean;
}

export default function QualityInfo() {
  const { user, profile } = useAuth();
  const { activePlant } = useActivePlant();
  const { hasAccess, loading: matrixLoading } = useRoleMatrix();
  const canView = hasAccess('quality_info');

  const [rows, setRows] = useState<QualityInfoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [pendingRow, setPendingRow] = useState<QualityInfoRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!activePlant || activePlant === 'all') {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const { data: lots, error: lotsErr } = await supabase
        .from('inward_inspection_lots')
        .select('id, material_code, vendor_code, plant, inspection_lot_created_date, inspection_lot_no')
        .eq('plant', activePlant)
        .order('inspection_lot_created_date', { ascending: false })
        .limit(500);
      if (lotsErr) throw lotsErr;

      const { data: submissions } = await supabase
        .from('quality_info')
        .select('inspection_lot')
        .eq('plant', activePlant);
      const submittedSet = new Set((submissions || []).map((s: any) => s.inspection_lot).filter(Boolean));

      const mapped: QualityInfoRow[] = (lots || []).map((l: any) => ({
        id: l.id,
        materialCode: l.material_code || '',
        vendorCode: l.vendor_code || '',
        plant: l.plant || '',
        date: l.inspection_lot_created_date || '',
        inspectionLot: l.inspection_lot_no || null,
        submitted: l.inspection_lot_no ? submittedSet.has(l.inspection_lot_no) : false,
      }));
      setRows(mapped);
    } catch (err: any) {
      console.error('QualityInfo load failed', err);
      toast.error('Failed to load quality info', { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlant, canView]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (materialSearch && !r.materialCode.toLowerCase().includes(materialSearch.toLowerCase())) return false;
      if (vendorSearch && !(r.vendorCode || '').toLowerCase().includes(vendorSearch.toLowerCase())) return false;
      return true;
    });
  }, [rows, materialSearch, vendorSearch]);

  const handleSubmit = async () => {
    if (!pendingRow || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('quality_info').insert({
        material_code: pendingRow.materialCode,
        vendor_code: pendingRow.vendorCode,
        plant: pendingRow.plant,
        inspection_lot: pendingRow.inspectionLot,
        submission_date: new Date().toISOString(),
        submitted_by: user.id,
        submitted_by_name: profile?.full_name || user.email || null,
      });
      if (error) throw error;
      toast.success('Quality info submitted', {
        description: `Material ${pendingRow.materialCode}`,
      });
      setRows((prev) => prev.map((r) => (r.id === pendingRow.id ? { ...r, submitted: true } : r)));
      setPendingRow(null);
    } catch (err: any) {
      console.error('Submit failed', err);
      toast.error('Submit failed', { description: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (matrixLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <h2 className="text-lg font-semibold">No Access</h2>
            <p className="text-sm text-muted-foreground">You don't have permission to view Quality Info.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-xl md:text-2xl font-bold">Quality Info</h1>
          <Badge variant="outline">Plant: {activePlant || '—'}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RotateCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Material Code"
              value={materialSearch}
              onChange={(e) => setMaterialSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Vendor Code"
              value={vendorSearch}
              onChange={(e) => setVendorSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            Showing {filtered.length} of {rows.length} records
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Vendor Code</TableHead>
                  <TableHead>Plant</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.materialCode || '—'}</TableCell>
                      <TableCell>{r.vendorCode || '—'}</TableCell>
                      <TableCell>{r.plant || '—'}</TableCell>
                      <TableCell>
                        {r.date ? format(new Date(r.date), 'dd-MMM-yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.submitted ? (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Submitted
                          </Badge>
                        ) : (
                          <Button size="sm" onClick={() => setPendingRow(r)}>
                            Submit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingRow} onOpenChange={(open) => !open && setPendingRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Quality Info</AlertDialogTitle>
            <AlertDialogDescription>
              Submit quality info for material <strong>{pendingRow?.materialCode}</strong>
              {pendingRow?.vendorCode ? <> from vendor <strong>{pendingRow.vendorCode}</strong></> : null}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}