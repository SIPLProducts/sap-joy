import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Shield, Save, RefreshCw } from 'lucide-react';

interface Permission {
  id: string;
  role: string;
  module_key: string;
  module_label: string;
  can_view: boolean;
  can_edit: boolean;
  plant: string;
}

const ALL_ROLES = [
  { key: 'admin', label: 'Admin', bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive' },
  { key: 'quality_head', label: 'Quality Head', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { key: 'quality', label: 'QC Inspector', bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400' },
  { key: 'purchase_head', label: 'Purchase Head', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  { key: 'purchase', label: 'Purchase Team', bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
  { key: 'engineering_head', label: 'Engg Head', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  { key: 'engineering', label: 'Engineering', bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400' },
  { key: 'shop_floor', label: 'Shop Floor', bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  { key: 'executive', label: 'Executive', bg: 'bg-pink-50', text: 'text-pink-700', dot: 'bg-pink-500' },
  { key: 'mrb_committee', label: 'MRB Committee', bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
];

export default function UserPermissionMatrix() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [plants, setPlants] = useState<{ code: string; name: string }[]>([]);
  const [selectedPlant, setSelectedPlant] = useState('1300');
  const [selectedRole, setSelectedRole] = useState('admin');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const [permRes, plantRes] = await Promise.all([
      supabase.from('role_permissions').select('*').eq('plant', selectedPlant).order('module_key'),
      supabase.from('plants').select('code, name').order('code'),
    ]);
    if (permRes.data) setPermissions(permRes.data as Permission[]);
    if (plantRes.data) setPlants(plantRes.data);
    setLoading(false);
    setDirty(false);
  };

  useEffect(() => { fetchData(); }, [selectedPlant]);

  const rolePermissions = permissions.filter(p => p.role === selectedRole);
  const currentRoleMeta = ALL_ROLES.find(r => r.key === selectedRole);

  const toggleAccess = (moduleKey: string) => {
    setPermissions(prev => prev.map(p => {
      if (p.role === selectedRole && p.module_key === moduleKey) {
        const newVal = !p.can_view;
        return { ...p, can_view: newVal, can_edit: newVal };
      }
      return p;
    }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = permissions.map(p => {
      const row: Record<string, any> = {
        role: p.role, module_key: p.module_key, module_label: p.module_label,
        can_view: !!p.can_view, can_edit: !!p.can_edit, plant: p.plant,
      };
      if (p.id && p.id.length > 0) row.id = p.id;
      return row;
    });
    const { error } = await supabase.from('role_permissions').upsert(updates as any, { onConflict: 'role,module_key,plant' });
    setSaving(false);
    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Permissions saved successfully!' });
      setDirty(false);
    }
  };

  const enabledCount = rolePermissions.filter(p => p.can_view).length;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            Permission Matrix
          </h1>
          <p className="text-muted-foreground mt-1">Control screen access per role and plant</p>
        </div>
        <div className="flex items-center gap-3">
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
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Role Selector */}
      <div className="flex flex-wrap gap-2">
        {ALL_ROLES.map(role => (
          <button
            key={role.key}
            onClick={() => setSelectedRole(role.key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
              selectedRole === role.key
                ? `${role.bg} ${role.text} border-current shadow-sm`
                : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${role.dot}`} />
            {role.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{enabledCount}</span> of {rolePermissions.length} screens enabled for <span className={`font-semibold ${currentRoleMeta?.text || ''}`}>{currentRoleMeta?.label}</span>
      </p>

      {/* Permissions List */}
      <Card className="overflow-hidden">
        <CardHeader className={`${currentRoleMeta?.bg || 'bg-muted/30'} border-b`}>
          <CardTitle className={`text-lg flex items-center gap-2 ${currentRoleMeta?.text || ''}`}>
            <span className={`inline-block w-3 h-3 rounded-full ${currentRoleMeta?.dot || 'bg-muted'}`} />
            {currentRoleMeta?.label || selectedRole} — Screen Access
          </CardTitle>
          <CardDescription>Toggle access to each screen for this role</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {rolePermissions.map((perm) => (
              <div key={perm.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors">
                <div>
                  <p className="font-medium text-foreground">{perm.module_label}</p>
                </div>
                <Switch
                  checked={perm.can_view}
                  onCheckedChange={() => toggleAccess(perm.module_key)}
                />
              </div>
            ))}
            {rolePermissions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No permissions found for this plant.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sticky Save */}
      {dirty && (
        <div className="sticky bottom-4 flex justify-center">
          <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2 shadow-lg">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );
}
