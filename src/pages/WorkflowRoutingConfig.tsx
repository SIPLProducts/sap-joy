import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleMatrix } from '@/hooks/useRoleMatrix';
import { useDepartments } from '@/hooks/useDepartments';
import { usePlants } from '@/hooks/usePlantConfig';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, RefreshCw, ArrowDown, ArrowUp, Save, GitBranch } from 'lucide-react';

export default function WorkflowRoutingConfig() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const plants = usePlants();
  const { departments } = useDepartments();
  
  // All workflow-enabled roles from Role Management
  const workflowRoles = useMemo(() => 
    departments
      .filter(d => d.is_active && d.is_workflow_enabled && d.role_key)
      .map(d => ({
        role_key: d.role_key!,
        name: d.name,
        description: d.description,
      })),
    [departments]
  );
  
  const [selectedPlant, setSelectedPlant] = useState('1300');
  const [steps, setSteps] = useState<{ role_key: string; name: string; workflow_step: number; is_active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const { hasAccess, loading: permLoading } = useRoleMatrix();
  const isAdmin = userRole === 'admin' || hasAccess('workflow_config');

  // Build steps list: all workflow-enabled roles, merged with saved config for this plant
  const buildSteps = async () => {
    setLoading(true);
    try {
      const { data: savedSteps, error } = await supabase
        .from('plant_workflow_config')
        .select('*')
        .eq('plant', selectedPlant)
        .order('workflow_step', { ascending: true });

      if (error) throw error;

      const savedMap = new Map<string, { workflow_step: number; is_active: boolean }>();
      (savedSteps || []).forEach(s => {
        savedMap.set(s.department, { workflow_step: s.workflow_step, is_active: s.is_active });
      });

      // Merge: saved roles keep their order, new roles appended at the end
      const ordered: typeof steps = [];
      const usedKeys = new Set<string>();

      // First, add saved steps in their order (only if role still exists in workflow roles)
      const sortedSaved = [...savedMap.entries()].sort((a, b) => a[1].workflow_step - b[1].workflow_step);
      for (const [roleKey, config] of sortedSaved) {
        const role = workflowRoles.find(r => r.role_key === roleKey);
        if (role) {
          ordered.push({ role_key: roleKey, name: role.name, workflow_step: config.workflow_step, is_active: config.is_active });
          usedKeys.add(roleKey);
        }
      }

      // Then, append any new workflow-enabled roles not yet saved
      for (const role of workflowRoles) {
        if (!usedKeys.has(role.role_key)) {
          ordered.push({ role_key: role.role_key, name: role.name, workflow_step: ordered.length + 1, is_active: false });
        }
      }

      // Re-number
      ordered.forEach((s, i) => { s.workflow_step = i + 1; });
      setSteps(ordered);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setHasChanges(false);
    }
  };

  useEffect(() => {
    if (isAdmin && workflowRoles.length >= 0) buildSteps();
  }, [isAdmin, selectedPlant, workflowRoles.length]);

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newSteps = [...steps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    newSteps.forEach((s, i) => { s.workflow_step = i + 1; });
    setSteps(newSteps);
    setHasChanges(true);
  };

  const handleMoveDown = (index: number) => {
    if (index >= steps.length - 1) return;
    const newSteps = [...steps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    newSteps.forEach((s, i) => { s.workflow_step = i + 1; });
    setSteps(newSteps);
    setHasChanges(true);
  };

  const handleToggleActive = (index: number) => {
    const newSteps = [...steps];
    newSteps[index].is_active = !newSteps[index].is_active;
    setSteps(newSteps);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing config for this plant
      await supabase.from('plant_workflow_config').delete().eq('plant', selectedPlant);

      // Only save active steps
      const activeSteps = steps.filter(s => s.is_active);
      if (activeSteps.length > 0) {
        const rows = activeSteps.map((s, i) => ({
          plant: selectedPlant,
          workflow_step: i + 1,
          department: s.role_key as any,
          step_label: s.name,
          is_required: true,
          is_active: true,
        }));
        const { error } = await supabase.from('plant_workflow_config').insert(rows);
        if (error) throw error;
      }

      toast({ title: 'Success', description: 'Workflow routing saved successfully' });
      setHasChanges(false);
      buildSteps();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (permLoading) {
    return (
      <div className="flex justify-center py-20"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Shield className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground text-center">You do not have permission to configure workflow routing.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeCount = steps.filter(s => s.is_active).length;

  return (
    <div className="container mx-auto p-6 space-y-6 overflow-auto h-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="h-7 w-7 text-primary" /> Workflow Routing Configuration
          </h1>
          <p className="text-muted-foreground mt-1">Enable and order the approval sequence per plant. Roles come from Role Management.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={selectedPlant} onValueChange={setSelectedPlant}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select plant" />
            </SelectTrigger>
            <SelectContent>
              {plants.map(p => (
                <SelectItem key={p.code} value={p.code}>{p.code} - {p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={buildSteps} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-amber-800 font-medium">You have unsaved changes</span>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Workflow Steps — Plant {selectedPlant}</CardTitle>
          <CardDescription>
            {activeCount} of {steps.length} roles enabled in the routing sequence. Toggle roles on/off and reorder them.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : steps.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>No roles with workflow routing enabled.</p>
              <p className="text-xs mt-1">Go to Role Management and enable "Workflow Routing" for roles first.</p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                <TableRow>
                  <TableHead className="w-16">Order</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Reorder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {steps.map((step, index) => (
                  <TableRow key={step.role_key} className={!step.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-mono font-bold text-primary">{step.workflow_step}</TableCell>
                    <TableCell className="font-medium">{step.name}</TableCell>
                    <TableCell>
                      <Switch checked={step.is_active} onCheckedChange={() => handleToggleActive(index)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleMoveUp(index)} disabled={index === 0}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleMoveDown(index)} disabled={index === steps.length - 1}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow Preview — only active roles */}
      {activeCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Active Routing Sequence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap">
              {steps.filter(s => s.is_active).map((step, i, arr) => (
                <div key={step.role_key} className="flex items-center gap-2">
                  <Badge variant="default" className="py-1">{step.name}</Badge>
                  {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
