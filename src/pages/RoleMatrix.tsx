import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useDepartments } from '@/hooks/useDepartments';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Save, RefreshCw, Check, X, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const SCREENS = [
  { key: 'dashboard_kpi', label: 'KPI Dashboard', group: 'Dashboards' },
  { key: 'analytics_dashboard', label: 'MRB Analytics', group: 'Dashboards' },
  { key: 'quality_dashboard', label: 'Quality Dashboard', group: 'Dashboards' },
  { key: 'purchase_dashboard', label: 'Purchase Dashboard', group: 'Dashboards' },
  { key: 'engineering_dashboard', label: 'Engineering Dashboard', group: 'Dashboards' },
  { key: 'executive_summary', label: 'Executive Summary', group: 'Dashboards' },
  { key: 'mrb_worklist', label: 'MRB Worklist', group: 'Operations' },
  { key: 'pending_actions', label: 'Pending Actions', group: 'Operations' },
  { key: 'material_booking', label: 'Material Blocking', group: 'Operations' },
  { key: 'inward_materials', label: 'MRB - Inward Materials', group: 'Operations' },
  { key: 'mrb_print', label: 'MRB Print', group: 'Tools' },
  { key: 'email_log', label: 'Email Log', group: 'Tools' },
  { key: 'help_support', label: 'Help & Support', group: 'Tools' },
  { key: 'user_management', label: 'User Management', group: 'Administration' },
  { key: 'role_management', label: 'Role Management', group: 'Administration' },
  { key: 'role_access', label: 'Role Access', group: 'Administration' },
  { key: 'plant_management', label: 'Plant Management', group: 'Administration' },
  { key: 'workflow_config', label: 'Workflow Config', group: 'Administration' },
  { key: 'email_config', label: 'Email Configuration', group: 'Administration' },
];

const ROLE_COLORS: Record<string, string> = {
  quality_head: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  quality: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  purchase_head: 'bg-blue-500/10 text-blue-700 border-blue-200',
  purchase: 'bg-blue-500/10 text-blue-600 border-blue-200',
  engineering_head: 'bg-amber-500/10 text-amber-700 border-amber-200',
  engineering: 'bg-amber-500/10 text-amber-600 border-amber-200',
  shop_floor: 'bg-purple-500/10 text-purple-600 border-purple-200',
  executive: 'bg-rose-500/10 text-rose-600 border-rose-200',
  mrb_committee: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
};

const GROUPS = ['Dashboards', 'Operations', 'Tools', 'Administration'];

interface PermRow {
  id?: string;
  role: string;
  module_key: string;
  module_label: string;
  can_view: boolean;
  can_edit: boolean;
  plant: string;
}

export default function RoleMatrix() {
  const { userRole } = useAuth();
  const { departments } = useDepartments();
  const { hasAccess } = useRoleMatrix();
  const isAdmin = userRole === 'admin' || hasAccess('role_access');
  const [permissions, setPermissions] = useState<PermRow[]>([]);
  const [plants, setPlants] = useState<{ code: string; name: string }[]>([]);
  const [selectedPlant, setSelectedPlant] = useState('1300');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Build ROLES dynamically from Role Management (departments table)
  // Include ALL active departments — use role_key if set, otherwise generate from name
  const ROLES = useMemo(() => 
    departments
      .filter(d => d.is_active)
      .map(d => {
        const key = d.role_key || d.name.toLowerCase().replace(/\s+/g, '_');
        return {
          value: key as AppRole,
          label: d.name,
          color: ROLE_COLORS[key] || 'bg-muted text-muted-foreground border-border',
        };
      }),
    [departments]
  );

  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');

  // Auto-select first role when ROLES load
  useEffect(() => {
    if (ROLES.length > 0 && !selectedRole) {
      setSelectedRole(ROLES[0].value);
    }
  }, [ROLES, selectedRole]);

  const fetchData = async () => {
    setLoading(true);
    const [permRes, plantRes] = await Promise.all([
      supabase.from('role_permissions').select('*').eq('plant', selectedPlant).order('module_key'),
      supabase.from('plants').select('code, name').order('code'),
    ]);

    if (plantRes.data) setPlants(plantRes.data);

    const dbPerms = (permRes.data || []) as PermRow[];
    const dense: PermRow[] = [];

    for (const role of ROLES) {
      for (const screen of SCREENS) {
        const existing = dbPerms.find(p => p.role === role.value && p.module_key === screen.key);
        if (existing) {
          dense.push(existing);
        } else {
          dense.push({
            role: role.value,
            module_key: screen.key,
            module_label: screen.label,
            can_view: false,
            can_edit: false,
            plant: selectedPlant,
          });
        }
      }
    }

    setPermissions(dense);
    setLoading(false);
    setHasChanges(false);
  };

  useEffect(() => { if (ROLES.length > 0) fetchData(); }, [selectedPlant, ROLES.length]);

  const togglePermission = (role: string, moduleKey: string) => {
    setHasChanges(true);
    setPermissions(prev => prev.map(p => {
      if (p.role === role && p.module_key === moduleKey) {
        const newVal = !p.can_view;
        return { ...p, can_view: newVal, can_edit: newVal };
      }
      return p;
    }));
  };

  const isChecked = (role: string, moduleKey: string) =>
    permissions.some(p => p.role === role && p.module_key === moduleKey && p.can_view);

  const getAccessCount = (role: string) =>
    permissions.filter(p => p.role === role && p.can_view).length;

  const toggleAllForRole = (role: string, enable: boolean) => {
    setHasChanges(true);
    setPermissions(prev => prev.map(p => {
      if (p.role === role) {
        return { ...p, can_view: enable, can_edit: enable };
      }
      return p;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const validPerms = permissions.filter(p => 
        p.role && p.role.trim().length > 0 && 
        p.module_key && p.module_key.trim().length > 0 && 
        p.plant && p.plant.trim().length > 0
      );

      if (validPerms.length === 0) {
        toast({ title: 'Validation Error', description: 'No valid permissions to save.', variant: 'destructive' });
        setSaving(false);
        return;
      }

      const toUpsert = validPerms.map(({ role, module_key, module_label, can_view, can_edit, plant }) => ({
        role,
        module_key,
        module_label: module_label || module_key,
        can_view: !!can_view,
        can_edit: !!can_edit,
        plant,
      }));

      const { error } = await supabase
        .from('role_permissions')
        .upsert(toUpsert as any, { onConflict: 'role,module_key,plant' });

      if (error) throw error;

      toast({ title: 'Saved!', description: 'Role permissions updated successfully.' });
      setHasChanges(false);
      fetchData();
    } catch (e: any) {
      console.error('Permission save error:', e);
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

  const selectedRoleData = ROLES.find(r => r.value === selectedRole);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-5 max-w-6xl overflow-auto h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-foreground">
            <Shield className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            Role Access Matrix
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Control which screens each role can access. Roles are loaded from Role Management.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPlant} onValueChange={setSelectedPlant}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Plant" />
            </SelectTrigger>
            <SelectContent>
              {plants.map(p => (
                <SelectItem key={p.code} value={p.code}>{p.code} — {p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={fetchData} variant="outline" size="sm" disabled={loading || saving}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Reset
          </Button>
          <Button onClick={handleSave} size="sm" disabled={!hasChanges || saving}>
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <Info className="h-4 w-4 flex-shrink-0" />
          You have unsaved changes. Click "Save Changes" to apply.
        </div>
      )}

      {/* Role Selector Tabs */}
      {ROLES.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>No roles configured. Go to Role Management and create roles with system role keys first.</p>
          </CardContent>
        </Card>
      ) : (
        <>
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
          {selectedRoleData && (
            <Card className="overflow-hidden">
              <div className={`px-4 py-3 border-b flex items-center justify-between ${selectedRoleData.color}`}>
                <div>
                  <h2 className="font-semibold text-base">{selectedRoleData.label}</h2>
                  <p className="text-xs opacity-75">
                    {getAccessCount(selectedRole)} of {SCREENS.length} screens enabled
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleAllForRole(selectedRole, getAccessCount(selectedRole) < SCREENS.length)}
                >
                  {getAccessCount(selectedRole) === SCREENS.length ? 'Deselect All' : 'Select All'}
                </Button>
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
          )}

          {/* Summary Grid */}
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
        </>
      )}

      <p className="text-xs text-muted-foreground italic">
        * Admin role has full access to all screens by default and is not shown in this matrix.
      </p>
    </div>
  );
}
