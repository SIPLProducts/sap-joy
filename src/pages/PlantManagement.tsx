import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleMatrix } from '@/hooks/useRoleMatrix';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Edit, Trash2, RefreshCw, MapPin } from 'lucide-react';

interface Plant {
  id: string;
  code: string;
  name: string;
  location: string | null;
  created_at: string;
}

export default function PlantManagement() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { userRole } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [form, setForm] = useState({ code: '', name: '', location: '' });

  const { hasAccess, loading: permLoading } = useRoleMatrix();
  const isAdmin = userRole === 'admin' || hasAccess('plant_management');

  const fetchPlants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('plants')
        .select('*')
        .order('code', { ascending: true });
        
      if (error) throw error;
      setPlants(data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchPlants();
  }, [isAdmin]);

  const handleOpenCreate = () => {
    setForm({ code: '', name: '', location: '' });
    setEditingPlant(null);
    setIsOpen(true);
  };

  const handleOpenEdit = (plant: Plant) => {
    setForm({ code: plant.code, name: plant.name, location: plant.location || '' });
    setEditingPlant(plant);
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) {
      toast({ title: 'Validation error', description: 'Plant code and name are required', variant: 'destructive' });
      return;
    }
    
    setSaving(true);
    try {
      if (editingPlant) {
        const { error } = await supabase
          .from('plants')
          .update({ name: form.name, location: form.location })
          .eq('id', editingPlant.id);
        if (error) throw error;
        toast({ title: 'Success', description: `Plant ${form.code} updated successfully` });
      } else {
        const { error } = await supabase
          .from('plants')
          .insert({ code: form.code, name: form.name, location: form.location });
        if (error) throw error;
        toast({ title: 'Success', description: `Plant ${form.code} created successfully` });
      }
      setIsOpen(false);
      fetchPlants();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plant: Plant) => {
    if (!confirm(`Are you sure you want to delete plant ${plant.code} (${plant.name})?`)) return;
    try {
      const { error } = await supabase.from('plants').delete().eq('id', plant.id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Plant deleted' });
      fetchPlants();
    } catch (error: any) {
      toast({ title: 'Error', description: 'Cannot delete: Plant may be in use by MRB records', variant: 'destructive' });
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground text-center">Only administrators can manage plant configurations.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 overflow-auto h-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" /> Plant Management
          </h1>
          <p className="text-muted-foreground mt-1">Create and manage manufacturing plants</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchPlants} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Add Plant
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Plants</CardTitle>
          <CardDescription>{plants.length} plant(s) configured</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
             <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
              <div className="max-h-[60vh] overflow-auto">
              <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                <TableRow>
                  <TableHead>Plant Code</TableHead>
                  <TableHead>Plant Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      No plants configured yet. Click "Add Plant" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  plants.map((plant) => (
                    <TableRow key={plant.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-primary border-primary/30">
                          {plant.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{plant.name}</TableCell>
                      <TableCell>
                        {plant.location ? (
                          <span className="flex items-center gap-1 text-muted-foreground text-sm">
                            <MapPin className="h-3 w-3" /> {plant.location}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(plant.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(plant)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(plant)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlant ? 'Edit Plant' : 'Create New Plant'}</DialogTitle>
            <DialogDescription>
              {editingPlant ? 'Update plant details below' : 'A plant code is the unique identifier (e.g. 1300) in SAP.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Plant Code *</Label>
              <Input 
                id="code" 
                value={form.code} 
                onChange={e => setForm({ ...form, code: e.target.value })} 
                disabled={!!editingPlant} 
                placeholder="e.g. 1300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Plant Name *</Label>
              <Input 
                id="name" 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
                placeholder="e.g. Hyderabad Main Plant"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location / City</Label>
              <Input 
                id="location" 
                value={form.location} 
                onChange={e => setForm({ ...form, location: e.target.value })} 
                placeholder="e.g. Hyderabad, India"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.code || !form.name}>
              {saving ? 'Saving...' : editingPlant ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
