import { useState, useEffect } from 'react';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, UserCog, Shield, Building2, Edit, Trash2, Plus, RefreshCw } from 'lucide-react';

interface UserWithRole {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  plant: string | null;
  department: string | null;
  role: AppRole | null;
  created_at: string;
}

const ROLES: { value: AppRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Administrator', description: 'Full system access' },
  { value: 'executive', label: 'Executive', description: 'Executive dashboard access' },
  { value: 'quality_head', label: 'Quality Head', description: 'Quality department head' },
  { value: 'quality', label: 'Quality Inspector', description: 'Quality inspection team' },
  { value: 'purchase_head', label: 'Purchase Head', description: 'Purchase department head' },
  { value: 'purchase', label: 'Purchase Team', description: 'Purchase team member' },
  { value: 'engineering_head', label: 'Engineering Head', description: 'Engineering department head' },
  { value: 'engineering', label: 'Engineering', description: 'Engineering team member' },
  { value: 'shop_floor', label: 'Shop Floor', description: 'Shop floor operations' },
];

const getRoleBadgeVariant = (role: AppRole | null): "default" | "secondary" | "destructive" | "outline" => {
  if (!role) return 'outline';
  if (role === 'admin') return 'destructive';
  if (role.includes('head') || role === 'executive') return 'default';
  return 'secondary';
};

export default function UserManagement() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');
  const [saving, setSaving] = useState(false);

  // Check if current user is admin
  const isAdmin = userRole === 'admin';

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRoleData = roles?.find(r => r.user_id === profile.user_id);
        return {
          id: profile.id,
          user_id: profile.user_id,
          full_name: profile.full_name,
          email: profile.email,
          plant: profile.plant,
          department: profile.department,
          role: userRoleData?.role as AppRole || null,
          created_at: profile.created_at,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEditRole = (user: UserWithRole) => {
    setSelectedUser(user);
    setSelectedRole(user.role || '');
    setIsEditDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!selectedUser || !selectedRole) return;

    setSaving(true);
    try {
      // Check if user already has a role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', selectedUser.user_id)
        .maybeSingle();

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role: selectedRole })
          .eq('user_id', selectedUser.user_id);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({
            user_id: selectedUser.user_id,
            role: selectedRole,
          });

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: `Role updated for ${selectedUser.full_name}`,
      });

      setIsEditDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error',
        description: 'Failed to update role',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', selectedUser.user_id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Role removed for ${selectedUser.full_name}`,
      });

      setIsDeleteDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting role:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove role',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.plant?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (user.role?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Shield className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground text-center">
              You don't have permission to access the User Management page.
              <br />Only administrators can manage users and roles.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserCog className="h-7 w-7" />
            User & Role Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage user accounts and assign roles
          </p>
        </div>
        <Button onClick={fetchUsers} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <UserCog className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <Shield className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.filter(u => u.role === 'admin').length}</p>
                <p className="text-sm text-muted-foreground">Administrators</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/50 rounded-lg">
                <Building2 className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.filter(u => u.role?.includes('head')).length}</p>
                <p className="text-sm text-muted-foreground">Department Heads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <UserCog className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.filter(u => !u.role).length}</p>
                <p className="text-sm text-muted-foreground">Unassigned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>View and manage user roles</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plant</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.plant || '-'}</TableCell>
                    <TableCell>{user.department || '-'}</TableCell>
                    <TableCell>
                      {user.role ? (
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {ROLES.find(r => r.value === user.role)?.label || user.role}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          No Role
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditRole(user)}
                        >
                          {user.role ? (
                            <>
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </>
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1" />
                              Assign
                            </>
                          )}
                        </Button>
                        {user.role && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.role ? 'Edit User Role' : 'Assign Role'}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.role 
                ? `Update the role for ${selectedUser?.full_name}`
                : `Assign a role to ${selectedUser?.full_name}`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>User</Label>
              <div className="p-3 bg-muted rounded-md">
                <p className="font-medium">{selectedUser?.full_name}</p>
                <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as AppRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex flex-col">
                        <span>{role.label}</span>
                        <span className="text-xs text-muted-foreground">{role.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole} disabled={!selectedRole || saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the role from {selectedUser?.full_name}?
              They will lose all associated permissions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRole} disabled={saving}>
              {saving ? 'Removing...' : 'Remove Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
