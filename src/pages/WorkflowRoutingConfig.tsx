import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDepartments } from '@/hooks/useDepartments';
import { usePlants } from '@/hooks/usePlantConfig';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Shield, Plus, Edit, Trash2, RefreshCw, ArrowDown, ArrowUp, Save, GitBranch } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface WorkflowStep {
  id?: string;
  workflow_step: number;
  department: AppRole;
  step_label: string;
  is_required: boolean;
  is_active: boolean;
  plant: string;
}

const DEPARTMENT_OPTIONS: { value: AppRole; label: string }[] = [
  { value: 'quality', label: 'Quality Review' },
  { value: 'quality_head', label: 'Quality Head' },
  { value: 'purchase', label: 'Purchase Review' },
  { value: 'purchase_head', label: 'Purchase Head' },
  { value: 'engineering', label: 'Engineering Review' },
  { value: 'engineering_head', label: 'Engineering Head' },
  { value: 'executive', label: 'Executive / Plant Head' },
  { value: 'mrb_committee', label: 'MRB Committee' },
];

export default function WorkflowRoutingConfig() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const plants = usePlants();
  const { departments } = useDepartments();
  
  const [selectedPlant, setSelectedPlant] = useState('1300');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newStep, setNewStep] = useState<Partial<WorkflowStep>>({ department: 'quality', step_label: '', is_required: true, is_active: true });

  const isAdmin = userRole === 'admin';

  const fetchSteps = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('plant_workflow_config')
        .select('*')
        .eq('plant', selectedPlant)
        .order('workflow_step', { ascending: true });

      if (error) throw error;
      setSteps((data || []).map(d => ({
        id: d.id,
        workflow_step: d.workflow_step,
        department: d.department as AppRole,
        step_label: d.step_label,
        is_required: d.is_required,
        is_active: d.is_active,
        plant: d.plant,
      })));
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setHasChanges(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchSteps();
  }, [isAdmin, selectedPlant]);

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

  const handleToggleRequired = (index: number) => {
    const newSteps = [...steps];
    newSteps[index].is_required = !newSteps[index].is_required;
    setSteps(newSteps);
    setHasChanges(true);
  };

  const handleDeleteStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index);
    newSteps.forEach((s, i) => { s.workflow_step = i + 1; });
    setSteps(newSteps);
    setHasChanges(true);
  };

  const handleAddStep = () => {
    if (!newStep.step_label?.trim() || !newStep.department) return;
    const step: WorkflowStep = {
      workflow_step: steps.length + 1,
      department: newStep.department as AppRole,
      step_label: newStep.step_label!.trim(),
      is_required: newStep.is_required ?? true,
      is_active: newStep.is_active ?? true,
      plant: selectedPlant,
    };
    setSteps([...steps, step]);
    setHasChanges(true);
    setIsAddOpen(false);
    setNewStep({ department: 'quality', step_label: '', is_required: true, is_active: true });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing steps for this plant
      await supabase.from('plant_workflow_config').delete().eq('plant', selectedPlant);

      // Insert updated steps
      if (steps.length > 0) {
        const rows = steps.map(s => ({
          plant: selectedPlant,
          workflow_step: s.workflow_step,
          department: s.department,
          step_label: s.step_label,
          is_required: s.is_required,
          is_active: s.is_active,
        }));
        const { error } = await supabase.from('plant_workflow_config').insert(rows);
        if (error) throw error;
      }

      toast({ title: 'Success', description: 'Workflow routing saved successfully' });
      setHasChanges(false);
      fetchSteps();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Shield className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground text-center">Only administrators can configure workflow routing.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="h-7 w-7 text-primary" /> Workflow Routing Configuration
          </h1>
          <p className="text-muted-foreground mt-1">Define the approval sequence for MRB workflow per plant</p>
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
          <Button onClick={fetchSteps} variant="outline" disabled={loading}>
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Workflow Steps — Plant {selectedPlant}</CardTitle>
              <CardDescription>{steps.filter(s => s.is_active).length} active steps in sequence</CardDescription>
            </div>
            <Button size="sm" onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Step
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : steps.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>No workflow steps configured for this plant.</p>
              <p className="text-xs mt-1">Default workflow (Quality → Purchase → Engineering → Executive) will be used.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Step Label</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {steps.map((step, index) => (
                  <TableRow key={step.id || index} className={!step.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-mono font-bold text-primary">{step.workflow_step}</TableCell>
                    <TableCell className="font-medium">{step.step_label}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {DEPARTMENT_OPTIONS.find(d => d.value === step.department)?.label || step.department}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={step.is_required} onCheckedChange={() => handleToggleRequired(index)} />
                    </TableCell>
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
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteStep(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Workflow Preview */}
      {steps.filter(s => s.is_active).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Workflow Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap">
              {steps.filter(s => s.is_active).map((step, i, arr) => (
                <div key={step.id || i} className="flex items-center gap-2">
                  <Badge variant={step.is_required ? 'default' : 'secondary'} className="py-1">
                    {step.step_label}
                  </Badge>
                  {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Step Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Workflow Step</DialogTitle>
            <DialogDescription>Add a new approval step to the workflow sequence</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Step Label *</Label>
              <Input
                value={newStep.step_label || ''}
                onChange={e => setNewStep({ ...newStep, step_label: e.target.value })}
                placeholder="e.g. Quality Review"
              />
            </div>
            <div className="space-y-2">
              <Label>Department *</Label>
              <Select value={newStep.department} onValueChange={v => setNewStep({ ...newStep, department: v as AppRole })}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_OPTIONS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={newStep.is_required ?? true} onCheckedChange={v => setNewStep({ ...newStep, is_required: v })} />
                <Label>Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={newStep.is_active ?? true} onCheckedChange={v => setNewStep({ ...newStep, is_active: v })} />
                <Label>Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddStep} disabled={!newStep.step_label?.trim()}>Add Step</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
