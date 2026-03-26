import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Pencil, MapPin } from 'lucide-react';

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [form, setForm] = useState({ code: '', name: '', location: '' });
  const { toast } = useToast();

  const fetchPlants = async () => {
    const { data, error } = await supabase.from('plants').select('*').order('code');
    if (!error && data) setPlants(data);
    setLoading(false);
  };

  useEffect(() => { fetchPlants(); }, []);

  const handleSave = async () => {
    if (!form.code || !form.name) {
      toast({ title: 'Error', description: 'Plant code and name are required', variant: 'destructive' });
      return;
    }

    if (editingPlant) {
      const { error } = await supabase.from('plants').update({
        code: form.code, name: form.name, location: form.location || null
      }).eq('id', editingPlant.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Plant updated successfully' });
    } else {
      const { error } = await supabase.from('plants').insert({
        code: form.code, name: form.name, location: form.location || null
      });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Plant created successfully' });
    }

    setDialogOpen(false);
    setEditingPlant(null);
    setForm({ code: '', name: '', location: '' });
    fetchPlants();
  };

  const openEdit = (plant: Plant) => {
    setEditingPlant(plant);
    setForm({ code: plant.code, name: plant.name, location: plant.location || '' });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingPlant(null);
    setForm({ code: '', name: '', location: '' });
    setDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" />
            Plant Management
          </h1>
          <p className="text-muted-foreground mt-1">Create and manage manufacturing plants</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Plant
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Plants</CardTitle>
          <CardDescription>{plants.length} plant(s) configured</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plant Code</TableHead>
                <TableHead>Plant Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plants.map((plant) => (
                <TableRow key={plant.id}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-primary border-primary/30">
                      {plant.code}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{plant.name}</TableCell>
                  <TableCell>
                    {plant.location ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {plant.location}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(plant.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(plant)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {plants.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No plants configured yet. Click "Add Plant" to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlant ? 'Edit Plant' : 'Create New Plant'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Plant Code *</Label>
              <Input placeholder="e.g. 1300" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Plant Name *</Label>
              <Input placeholder="e.g. Plant 1300 - CLW" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input placeholder="e.g. Hyderabad, India" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editingPlant ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
