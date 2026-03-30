import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Shield, Save, RefreshCw, Check, X, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRoleMatrix, RolePermission } from '@/hooks/useRoleMatrix';

const SCREENS = [
  { key: 'dashboard_kpi', label: 'KPI Dashboard', group: 'Dashboards' },
  { key: 'analytics_dashboard', label: 'MRB Analytics', group: 'Dashboards' },
  { key: 'quality_dashboard', label: 'Quality Dashboard', group: 'Dashboards' },
  { key: 'purchase_dashboard', label: 'Purchase Dashboard', group: 'Dashboards' },
  { key: 'engineering_dashboard', label: 'Engineering Dashboard', group: 'Dashboards' },
  { key: 'executive_summary', label: 'Executive Summary', group: 'Dashboards' },
  { key: 'mrb_worklist', label: 'MRB Worklist', group: 'Operations' },
  { key: 'material_booking', label: 'Material Booking', group: 'Operations' },
  { key: 'inward_materials', label: 'MRB - Inward Materials', group: 'Operations' },
  { key: 'mrb_print', label: 'MRB Print', group: 'Tools' },
  { key: 'email_log', label: 'Email Log', group: 'Tools' },
  { key: 'help_support', label: 'Help & Support', group: 'Tools' },
];

const ROLES: { value: AppRole; label: string; color: string }[] = [
  { value: 'quality_head', label: 'Quality Head', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
  { value: 'quality', label: 'Quality', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  { value: 'purchase_head', label: 'Purchase Head', color: 'bg-blue-500/10 text-blue-700 border-blue-200' },
  { value: 'purchase', label: 'Purchase', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  { value: 'engineering_head', label: 'Engg Head', color: 'bg-amber-500/10 text-amber-700 border-amber-200' },
  { value: 'engineering', label: 'Engineering', color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  { value: 'shop_floor', label: 'Shop Floor', color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
  { value: 'executive', label: 'Executive', color: 'bg-rose-500/10 text-rose-600 border-rose-200' },
  { value: 'mrb_committee', label: 'MRB Committee', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-200' },
];

const GROUPS = ['Dashboards', 'Operations', 'Tools'];

export default function RoleMatrix() {
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';
  const { permissions: dbPermissions, loading: loadingMatrix, refetch } = useRoleMatrix();
  const [internalPermissions, setInternalPermissions] = useState<RolePermission[]>([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>(ROLES[0].value);

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

  const isChecked = (role: AppRole, screenKey: string) =>
    internalPermissions.some(p => p.role === role && p.screen_key === screenKey);

  const getAccessCount = (role: AppRole) =>
    internalPermissions.filter(p => p.role === role).length;

  const toggleAllForRole = (role: AppRole, enable: boolean) => {
    setHasChanges(true);
    if (enable) {
      const newPerms = [...internalPermissions.filter(p => p.role !== role)];
      SCREENS.forEach(s => newPerms.push({ role, screen_key: s.key }));
      setInternalPermissions(newPerms);
    } else {
      setInternalPermissions(internalPermissions.filter(p => p.role !== role));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error: deleteError } = await supabase.from('role_permissions').delete().neq('role', 'admin');
      if (deleteError) throw deleteError;

      if (internalPermissions.length > 0) {
        const toInsert = internalPermissions
          .filter(p => p.role !== 'admin')
          .map(p => ({ role: p.role as string, module_key: p.screen_key, module_label: p.screen_key }));
        const { error: insertError } = await supabase.from('role_permissions').insert(toInsert);
        if (insertError) throw insertError;
      }

      toast({ title: 'Saved!', description: 'Role permissions updated successfully.' });
      setHasChanges(false);
      refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-sm">
          <CardContent className="pt-6 text-center space-y-3">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-lg font-semibold">Access Denied</p>
            <p className="text-sm text-muted-foreground">Only administrators can manage role permissions.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedRoleData = ROLES.find(r => r.value === selectedRole)!;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-foreground">
            <Shield className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            Role Access Matrix
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Control which screens each role can access
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { refetch(); }} variant="outline" size="sm" disabled={loadingMatrix || saving}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loadingMatrix ? 'animate-spin' : ''}`} />
            Reset
          </Button>
          <Button onClick={handleSave} size="sm" disabled={!hasChanges || saving}>
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Unsaved changes banner */}
      {hasChanges && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <Info className="h-4 w-4 flex-shrink-0" />
          You have unsaved changes. Click "Save Changes" to apply.
        </div>
      )}

      {/* Role Selector Tabs */}
      <div className="flex flex-wrap gap-2">
        {ROLES.map((role) => {
          const count = getAccessCount(role.value);
          const isActive = selectedRole === role.value;
          return (
            <button
              key={role.value}
              onClick={() => setSelectedRole(role.value)}
              className={`
                relative px-3 py-2 rounded-lg border text-sm font-medium transition-all
                ${isActive 
                  ? `${role.color} border-current shadow-sm ring-1 ring-current/20` 
                  : 'bg-background border-border text-muted-foreground hover:bg-muted/50'
                }
              `}
            >
              <span>{role.label}</span>
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 min-w-[18px]">
                {count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Permission Card for Selected Role */}
      <Card className="overflow-hidden">
        <div className={`px-4 py-3 border-b flex items-center justify-between ${selectedRoleData.color}`}>
          <div>
            <h2 className="font-semibold text-base">{selectedRoleData.label}</h2>
            <p className="text-xs opacity-75">
              {getAccessCount(selectedRole)} of {SCREENS.length} screens enabled
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => toggleAllForRole(selectedRole, getAccessCount(selectedRole) < SCREENS.length)}
            >
              {getAccessCount(selectedRole) === SCREENS.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </div>

        <CardContent className="p-0">
          {GROUPS.map((group) => {
            const groupScreens = SCREENS.filter(s => s.group === group);
            return (
              <div key={group}>
                <div className="px-4 py-2 bg-muted/30 border-b">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </span>
                </div>
                {groupScreens.map((screen, idx) => {
                  const checked = isChecked(selectedRole, screen.key);
                  return (
                    <div
                      key={screen.key}
                      className={`
                        flex items-center justify-between px-4 py-3 
                        hover:bg-muted/20 transition-colors cursor-pointer
                        ${idx < groupScreens.length - 1 ? 'border-b border-border/50' : ''}
                      `}
                      onClick={() => togglePermission(selectedRole, screen.key)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                          ${checked 
                            ? 'bg-primary/10 text-primary' 
                            : 'bg-muted text-muted-foreground'
                          }
                        `}>
                          {checked ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        </div>
                        <span className={`text-sm font-medium ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {screen.label}
                        </span>
                      </div>
                      <Switch
                        checked={checked}
                        onCheckedChange={() => togglePermission(selectedRole, screen.key)}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Summary Grid - shows all roles at a glance */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            Quick Overview — All Roles
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-3 font-medium text-muted-foreground min-w-[150px]">Screen</th>
                  {ROLES.map(r => (
                    <th key={r.value} className="text-center py-2 px-1 font-medium text-muted-foreground min-w-[70px]">
                      <span className="truncate block">{r.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SCREENS.map(screen => (
                  <tr key={screen.key} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="py-2 pr-3 font-medium text-foreground">{screen.label}</td>
                    {ROLES.map(role => {
                      const checked = isChecked(role.value, screen.key);
                      return (
                        <td key={role.value} className="text-center py-2 px-1">
                          <button
                            onClick={() => {
                              togglePermission(role.value, screen.key);
                              setSelectedRole(role.value);
                            }}
                            className={`
                              w-6 h-6 rounded-full inline-flex items-center justify-center transition-all
                              ${checked 
                                ? 'bg-primary text-primary-foreground shadow-sm' 
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                              }
                            `}
                          >
                            {checked ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground italic">
        * Admin role has full access to all screens by default and is not shown in this matrix.
      </p>
    </div>
  );
}
