import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Layers, Plus, Edit, Trash2, RefreshCw, Shield } from 'lucide-react';

const ROLE_KEY_OPTIONS = [
  { value: '', label: 'None (not used in workflow)' },
  { value: 'quality', label: 'Quality' },
  { value: 'quality_head', label: 'Quality Head' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'purchase_head', label: 'Purchase Head' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'engineering_head', label: 'Engineering Head' },
  { value: 'executive', label: 'Executive / Plant Head' },
  { value: 'mrb_committee', label: 'MRB Committee' },
  { value: 'shop_floor', label: 'Shop Floor' },
];

interface Department {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  role_key: string | null;
  created_at: string;
}

export default function DepartmentManagement() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { userRole } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: '', description: '', is_active: true });

  const isAdmin = userRole === 'admin';

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchDepartments();
  }, [isAdmin]);

  const handleOpenCreate = () => {
    setForm({ name: '', description: '', is_active: true });
    setEditingDept(null);
    setIsOpen(true);
  };

  const handleOpenEdit = (dept: Department) => {
    setForm({ name: dept.name, description: dept.description || '', is_active: dept.is_active });
    setEditingDept(dept);
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Validation error', description: 'Department name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingDept) {
        const { error } = await supabase
          .from('departments')
          .update({ name: form.name.trim(), description: form.description.trim() || null, is_active: form.is_active })
          .eq('id', editingDept.id);
        if (error) throw error;
        toast({ title: 'Success', description: `Department "${form.name}" updated` });
      } else {
        const { error } = await supabase
          .from('departments')
          .insert({ name: form.name.trim(), description: form.description.trim() || null, is_active: form.is_active });
        if (error) throw error;
        toast({ title: 'Success', description: `Department "${form.name}" created` });
      }
      setIsOpen(false);
      fetchDepartments();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dept: Department) => {
    if (!confirm(`Are you sure you want to delete department "${dept.name}"? This may affect users assigned to this department.`)) return;
    try {
      const { error } = await supabase.from('departments').delete().eq('id', dept.id);
      if (error) throw error;
      toast({ title: 'Success', description: `Department "${dept.name}" deleted` });
      fetchDepartments();
    } catch (error: any) {
      toast({ title: 'Error', description: 'Cannot delete: Department may be in use', variant: 'destructive' });
    }
  };

  const handleToggleActive = async (dept: Department) => {
    try {
      const { error } = await supabase
        .from('departments')
        .update({ is_active: !dept.is_active })
        .eq('id', dept.id);
      if (error) throw error;
      fetchDepartments();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Shield className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground text-center">Only administrators can manage departments.</p>
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
            <Layers className="h-7 w-7 text-primary" /> Department Management
          </h1>
          <p className="text-muted-foreground mt-1">Create and manage organizational departments</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchDepartments} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Add Department
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Departments</CardTitle>
          <CardDescription>{departments.length} department(s) configured</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      No departments configured. Click "Add Department" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{dept.description || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={dept.is_active} onCheckedChange={() => handleToggleActive(dept)} />
                          <Badge variant={dept.is_active ? 'default' : 'secondary'}>
                            {dept.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(dept.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(dept)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(dept)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? 'Edit Department' : 'Create New Department'}</DialogTitle>
            <DialogDescription>
              {editingDept ? 'Update department details' : 'Departments are used for user assignment, workflow routing, and screen access control.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dept-name">Department Name *</Label>
              <Input
                id="dept-name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Quality Assurance"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-desc">Description</Label>
              <Input
                id="dept-desc"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Quality inspection and control team"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving...' : editingDept ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
