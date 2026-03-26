import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, Save, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRoleMatrix, RolePermission } from '@/hooks/useRoleMatrix';

// Definition of all possible screens that can be mapped
const SCREENS = [
  { key: 'dashboard_kpi', label: 'KPI Dashboard' },
  { key: 'mrb_worklist', label: 'MRB Worklist' },
  { key: 'material_booking', label: 'Material Booking' },
  { key: 'inward_materials', label: 'MRB - Inward Materials' },
  { key: 'mrb_print', label: 'MRB Print' },
  { key: 'email_log', label: 'Email Log' },
  { key: 'help_support', label: 'Help & Support' },
  { key: 'analytics_dashboard', label: 'MRB Analytics' },
  { key: 'quality_dashboard', label: 'Quality Dashboard' },
  { key: 'purchase_dashboard', label: 'Purchase Dashboard' },
  { key: 'engineering_dashboard', label: 'Engineering Dashboard' },
  { key: 'executive_summary', label: 'Executive Summary' },
];

const ROLES: { value: AppRole; label: string }[] = [
  { value: 'quality_head', label: 'Quality Head' },
  { value: 'quality', label: 'Quality Inspector' },
  { value: 'purchase_head', label: 'Purchase Head' },
  { value: 'purchase', label: 'Purchase Team' },
  { value: 'engineering_head', label: 'Engineering Head' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'shop_floor', label: 'Shop Floor' },
  { value: 'executive', label: 'Executive' },
  { value: 'mrb_committee', label: 'MRB Committee' }
  // admin always has full access and cannot be unchecked 
];

export default function RoleMatrix() {
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';
  const { permissions: dbPermissions, loading: loadingMatrix, refetch } = useRoleMatrix();
  const [internalPermissions, setInternalPermissions] = useState<RolePermission[]>([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setInternalPermissions(dbPermissions);
    setHasChanges(false);
  }, [dbPermissions]);

  const togglePermission = (role: AppRole, screenKey: string) => {
    const exists = internalPermissions.some(p => p.role === role && p.screen_key === screenKey);
    setHasChanges(true);
    if (exists) {
      setInternalPermissions(internalPermissions.filter(p => !(p.role === role && p.screen_key === screenKey)));
    } else {
      setInternalPermissions([...internalPermissions, { role, screen_key: screenKey }]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete old permissions
      const { error: deleteError } = await supabase.from('role_permissions').delete().neq('role', 'admin');
      if (deleteError) throw deleteError;

      // Insert new permissions
      if (internalPermissions.length > 0) {
        // Filter out admin since we hardcode admin access, and deduplicate
        const toInsert = internalPermissions
          .filter(p => p.role !== 'admin')
          .map(p => ({ role: p.role, screen_key: p.screen_key }));

        const { error: insertError } = await supabase.from('role_permissions').insert(toInsert);
        if (insertError) throw insertError;
      }

      toast({ title: 'Success', description: 'Role Matrix permissions updated successfully' });
      setHasChanges(false);
      refetch();
    } catch (e: any) {
      toast({ title: 'Error saving matrix', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return <div className="p-6 text-center text-muted-foreground">Access denied. Admins only.</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" /> Role Access Matrix
          </h1>
          <p className="text-muted-foreground">Check and uncheck the screens each role can access.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={refetch} variant="outline" disabled={loadingMatrix || saving}>
            <RefreshCw className={`h-4 w-4 mr-2 ${(loadingMatrix || saving) ? 'animate-spin' : ''}`} /> Reset
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Matrix'}
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto min-w-[300px]">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-[200px] border-r font-bold text-foreground">App Screen</TableHead>
                {ROLES.map((col) => (
                  <TableHead key={col.value} className="text-center min-w-[120px] max-w-[120px] font-bold">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {SCREENS.map((screen) => (
                <TableRow key={screen.key} className="hover:bg-muted/30">
                  <TableCell className="font-medium border-r bg-muted/10 sticky left-0 z-10">
                    {screen.label}
                  </TableCell>
                  {ROLES.map((roleCol) => {
                    const isChecked = internalPermissions.some(
                      p => p.role === roleCol.value && p.screen_key === screen.key
                    );
                    return (
                      <TableCell key={`${roleCol.value}-${screen.key}`} className="text-center p-0">
                        <div className="h-12 w-full flex items-center justify-center cursor-pointer hover:bg-primary/5 transition-colors"
                             onClick={() => togglePermission(roleCol.value, screen.key)}>
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => togglePermission(roleCol.value, screen.key)}
                          />
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Help block matching original code structure */}
      <h3 className="mt-6 text-sm italic text-muted-foreground">* Admin role implicitly has access to all screens and is not shown on this grid. SAP settings are restricted exclusively via programmatic checks.</h3>
    </div>
  );
}
