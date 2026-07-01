import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActivePlant } from '@/hooks/useActivePlant';
import { useVisiblePlants } from '@/hooks/useVisiblePlants';
import { useRoleMatrix } from '@/hooks/useRoleMatrix';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { invokeQInfoCreate } from '@/lib/sapSyncClient';

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function QualityInfo() {
  const { user, profile } = useAuth();
  const { activePlant } = useActivePlant();
  const { plantOptions } = useVisiblePlants();
  const { hasAccess, loading: matrixLoading } = useRoleMatrix();
  const canView = hasAccess('quality_info');

  const [materialCode, setMaterialCode] = useState('');
  const [vendorCode, setVendorCode] = useState('');
  const [plant, setPlant] = useState('');
  const [releaseUntil, setReleaseUntil] = useState<string>(todayISO());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (plant) return;
    if (activePlant && activePlant !== 'all' && plantOptions.some(p => p.code === activePlant)) {
      setPlant(activePlant);
    } else if (plantOptions.length > 0) {
      setPlant(plantOptions[0].code);
    }
  }, [activePlant, plantOptions, plant]);

  const canSubmit = materialCode.trim() && vendorCode.trim() && plant.trim() && !submitting;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        MATNR: materialCode.trim(),
        LIFNR: vendorCode.trim(),
        WERKS: plant.trim(),
        REL_UDT: releaseUntil || todayISO(),
      };
      const { data, error } = await invokeQInfoCreate(payload);
      if (error) {
        toast.error('Q-Info creation failed', { description: error.message });
        return;
      }
      if (data && data.ok === false) {
        toast.error('SAP rejected the request', { description: data.error || 'Unknown SAP error' });
        return;
      }

      // Local audit trail
      try {
        await supabase.from('quality_info').insert({
          material_code: payload.MATNR,
          vendor_code: payload.LIFNR,
          plant: payload.WERKS,
          release_until: payload.REL_UDT,
          submission_date: new Date().toISOString(),
          submitted_by: user?.id,
          submitted_by_name: profile?.full_name || user?.email || null,
        } as any);
      } catch (auditErr) {
        console.warn('quality_info audit insert failed', auditErr);
      }

      toast.success('Quality Info created', {
        description: data?.message || `Material ${payload.MATNR} submitted to SAP`,
      });
      setMaterialCode('');
      setVendorCode('');
    } catch (err: any) {
      console.error('QInfo submit failed', err);
      toast.error('Submit failed', { description: err?.message });
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
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
    <div className="min-h-full flex flex-col items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-3xl space-y-4">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-bold">Quality Info</h1>
          </div>
          <Badge variant="outline">Plant: {activePlant || '—'}</Badge>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-base">Create Q-Info Record (SAP QI01)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="matnr">Material Code <span className="text-destructive">*</span></Label>
                <Input
                  id="matnr"
                  value={materialCode}
                  onChange={(e) => setMaterialCode(e.target.value)}
                  placeholder="e.g. 1000000030"
                  maxLength={40}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lifnr">Vendor Code <span className="text-destructive">*</span></Label>
                <Input
                  id="lifnr"
                  value={vendorCode}
                  onChange={(e) => setVendorCode(e.target.value)}
                  placeholder="e.g. 2000001"
                  maxLength={10}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="werks">Plant <span className="text-destructive">*</span></Label>
                <Select value={plant} onValueChange={setPlant}>
                  <SelectTrigger id="werks">
                    <SelectValue placeholder="Select plant" />
                  </SelectTrigger>
                  <SelectContent>
                    {plantOptions.map(p => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.name && p.name !== p.code ? `${p.code} — ${p.name}` : p.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rel_udt">Release Until</Label>
                <Input
                  id="rel_udt"
                  type="date"
                  value={releaseUntil}
                  onChange={(e) => setReleaseUntil(e.target.value)}
                  onBlur={() => { if (!releaseUntil) setReleaseUntil(todayISO()); }}
                />
                <p className="text-xs text-muted-foreground">Defaults to today; you can change it</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setConfirmOpen(true)} disabled={!canSubmit} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !submitting && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Quality Info to SAP</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm">
                <div>Material Code: <strong>{materialCode}</strong></div>
                <div>Vendor Code: <strong>{vendorCode}</strong></div>
                <div>Plant: <strong>{plant}</strong></div>
                <div>Release Until: <strong>{releaseUntil}</strong></div>
              </div>
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