import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
  { key: 'admin', label: 'Admin', color: 'bg-red-500' },
  { key: 'quality', label: 'Quality Inspector', color: 'bg-emerald-500' },
  { key: 'quality_head', label: 'Quality Head', color: 'bg-emerald-600' },
  { key: 'purchase', label: 'Purchase Team', color: 'bg-blue-500' },
  { key: 'purchase_head', label: 'Purchase Head', color: 'bg-blue-600' },
  { key: 'engineering', label: 'Engineering', color: 'bg-amber-500' },
  { key: 'engineering_head', label: 'Engineering Head', color: 'bg-amber-600' },
  { key: 'shop_floor', label: 'Shop Floor', color: 'bg-purple-500' },
  { key: 'executive', label: 'Executive', color: 'bg-pink-500' },
  { key: 'mrb_committee', label: 'MRB Committee', color: 'bg-indigo-500' },
];

export default function UserPermissionMatrix() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [plants, setPlants] = useState<{ code: string; name: string }[]>([]);
  const [selectedPlant, setSelectedPlant] = useState('1300');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const [permRes, plantRes] = await Promise.all([
      supabase.from('role_permissions').select('*').eq('plant', selectedPlant).order('module_key').order('role'),
      supabase.from('plants').select('code, name').order('code'),
    ]);
    if (permRes.data) setPermissions(permRes.data as Permission[]);
    if (plantRes.data) setPlants(plantRes.data);
    setLoading(false);
    setDirty(false);
  };

  useEffect(() => { fetchData(); }, [selectedPlant]);

  // Group permissions by module
  const modules = [...new Set(permissions.map(p => p.module_key))].map(key => ({
    key,
    label: permissions.find(p => p.module_key === key)?.module_label || key,
  }));

  const getPermission = (role: string, moduleKey: string) =>
    permissions.find(p => p.role === role && p.module_key === moduleKey);

  const togglePermission = (role: string, moduleKey: string, field: 'can_view' | 'can_edit') => {
    setPermissions(prev => prev.map(p => {
      if (p.role === role && p.module_key === moduleKey) {
        const updated = { ...p, [field]: !p[field] };
        // If removing view, also remove edit
        if (field === 'can_view' && !updated.can_view) updated.can_edit = false;
        // If adding edit, also add view
        if (field === 'can_edit' && updated.can_edit) updated.can_view = true;
        return updated;
      }
      return p;
    }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = permissions.map(p => ({
      id: p.id,
      role: p.role,
      module_key: p.module_key,
      module_label: p.module_label,
      can_view: p.can_view,
      can_edit: p.can_edit,
      plant: p.plant,
    }));

    // Upsert all permissions
    const { error } = await supabase.from('role_permissions').upsert(updates, { onConflict: 'role,module_key,plant' });
    setSaving(false);

    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Permissions saved successfully!' });
      setDirty(false);
    }
  };

  const getRoleColor = (roleKey: string) =>
    ALL_ROLES.find(r => r.key === roleKey)?.color || 'bg-gray-500';

  const getRoleLabel = (roleKey: string) =>
    ALL_ROLES.find(r => r.key === roleKey)?.label || roleKey;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            User Permission Matrix
          </h1>
          <p className="text-muted-foreground mt-1">
            Control which roles can access each module per plant
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedPlant} onValueChange={setSelectedPlant}>
            <SelectTrigger className="w-[200px]">
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
          <Button onClick={handleSave} disabled={!dirty || saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Matrix Card */}
      <Card className="overflow-hidden border-2 border-primary/10">
        <CardHeader className="bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/10 border-b">
          <CardTitle className="text-lg">Access Control Matrix</CardTitle>
          <CardDescription>
            <span className="inline-flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-emerald-500" /> View
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-blue-500" /> Edit
              </span>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-semibold text-foreground sticky left-0 bg-muted/30 min-w-[200px] z-10">
                    Module
                  </th>
                  {ALL_ROLES.map(role => (
                    <th key={role.key} className="p-2 text-center min-w-[100px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`inline-block w-3 h-3 rounded-full ${role.color}`} />
                        <span className="text-xs font-medium text-foreground leading-tight">
                          {role.label}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((module, idx) => (
                  <tr
                    key={module.key}
                    className={`border-b transition-colors hover:bg-muted/20 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
                  >
                    <td className={`p-3 font-medium text-foreground sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                      <span className="flex items-center gap-2">
                        {module.label}
                      </span>
                    </td>
                    {ALL_ROLES.map(role => {
                      const perm = getPermission(role.key, module.key);
                      if (!perm) return <td key={role.key} className="p-2 text-center text-muted-foreground">—</td>;
                      return (
                        <td key={role.key} className="p-2">
                          <div className="flex flex-col items-center gap-1.5">
                            <label className="flex items-center gap-1 cursor-pointer group">
                              <Checkbox
                                checked={perm.can_view}
                                onCheckedChange={() => togglePermission(role.key, module.key, 'can_view')}
                                className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                              />
                              <span className="text-[10px] text-muted-foreground group-hover:text-foreground">V</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer group">
                              <Checkbox
                                checked={perm.can_edit}
                                onCheckedChange={() => togglePermission(role.key, module.key, 'can_edit')}
                                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                              />
                              <span className="text-[10px] text-muted-foreground group-hover:text-foreground">E</span>
                            </label>
                          </div>
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

      {/* Role Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Role Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {ALL_ROLES.map(role => (
              <Badge key={role.key} variant="outline" className="gap-2 py-1.5 px-3">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${role.color}`} />
                {role.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
