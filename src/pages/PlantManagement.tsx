import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, Plus, Edit, Trash2, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Plant {
  code: string;
  name: string;
  location: string | null;
  created_at: string;
}

export default function PlantManagement() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';

  const fetchPlants = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('plants')
      .select('*')
      .order('code', { ascending: true });
      
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setPlants(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchPlants();
  }, [isAdmin]);

  const handleOpenCreate = () => {
    setCode('');
    setName('');
    setLocation('');
    setIsEditing(false);
    setIsOpen(true);
  };

  const handleOpenEdit = (plant: Plant) => {
    setCode(plant.code);
    setName(plant.name);
    setLocation(plant.location || '');
    setIsEditing(true);
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!code || !name) {
      toast({ title: 'Validation error', description: 'Plant code and name are required', variant: 'destructive' });
      return;
    }
    
    setSaving(true);
    try {
      if (isEditing) {
        const { error } = await supabase
          .from('plants')
          .update({ name, location })
          .eq('code', code);
        if (error) throw error;
        toast({ title: 'Success', description: `Plant ${code} updated successfully` });
      } else {
        const { error } = await supabase
          .from('plants')
          .insert({ code, name, location });
        if (error) throw error;
        toast({ title: 'Success', description: `Plant ${code} created successfully` });
      }
      setIsOpen(false);
      fetchPlants();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plantCode: string) => {
    if (!confirm(`Are you sure you want to delete plant ${plantCode}?`)) return;
    try {
      const { error } = await supabase.from('plants').delete().eq('code', plantCode);
      if (error) throw error;
      toast({ title: 'Success', description: 'Plant deleted' });
      fetchPlants();
    } catch (error: any) {
      toast({ title: 'Error', description: 'Cannot delete: Plant may be in use by MRB records', variant: 'destructive' });
    }
  };

  if (!isAdmin) {
    return <div className="p-6 text-center text-muted-foreground">Access denied. Admin only.</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Plant Management
          </h1>
          <p className="text-muted-foreground">Create and manage your organization's plants</p>
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
        <CardContent className="p-0">
          {loading ? (
             <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plant Code</TableHead>
                  <TableHead>Plant Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plants.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No plants configured yet.</TableCell></TableRow>
                ) : (
                  plants.map((plant) => (
                    <TableRow key={plant.code}>
                      <TableCell className="font-bold">{plant.code}</TableCell>
                      <TableCell>{plant.name}</TableCell>
                      <TableCell>{plant.location || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(plant)}>
                          <Edit className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(plant.code)}>
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
            <DialogTitle>{isEditing ? 'Edit Plant' : 'Create New Plant'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update plant details below' : 'A plant code is the unique identifier (e.g. 1300) in SAP.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Plant Code *</Label>
              <Input 
                id="code" 
                value={code} 
                onChange={e => setCode(e.target.value)} 
                disabled={isEditing} 
                placeholder="e.g. 1300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Plant Name *</Label>
              <Input 
                id="name" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="e.g. Hyderabad Main Plant"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location / City</Label>
              <Input 
                id="location" 
                value={location} 
                onChange={e => setLocation(e.target.value)} 
                placeholder="e.g. Hyderabad"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !code || !name}>
              {saving ? 'Saving...' : 'Save Plant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
