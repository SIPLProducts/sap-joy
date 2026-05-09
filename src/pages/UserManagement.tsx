import { useState, useEffect, useMemo } from 'react';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useRoleMatrix } from '@/hooks/useRoleMatrix';
import { supabase } from '@/integrations/supabase/client';

import { useToast } from '@/hooks/use-toast';
import { useDepartments } from '@/hooks/useDepartments';
import { useVisiblePlants } from '@/hooks/useVisiblePlants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, UserCog, Shield, Building2, Edit, Trash2, Plus, RefreshCw, UserPlus, KeyRound } from 'lucide-react';
import { PasswordPolicyIndicator } from '@/components/auth/PasswordPolicyIndicator';
import { validatePassword, hashPasswordForHistory, PASSWORD_POLICY } from '@/lib/passwordPolicy';
import { format } from 'date-fns';

interface UserWithRole {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  employee_id: string;
  plant: string | null;
  plants: string[];
  department: string | null;
  role: AppRole | null;
  created_at: string;
}

const HIDDEN_EMAILS = ['masteradmin@sharviinfotech.com', 'bala@sharviinfotech.com'];

const PASSWORD_HELP_TEXT = `Password must be ${PASSWORD_POLICY.minLength}-${PASSWORD_POLICY.maxLength} characters and include at least one letter and one number.`;

const getPasswordLengthMessage = (password: string) => {
  if (password.length <= PASSWORD_POLICY.maxLength) return null;
  return `This password has ${password.length} characters. Maximum allowed is ${PASSWORD_POLICY.maxLength}.`;
};

const getPasswordValidationMessage = (password: string) => {
  const trimmedPassword = password.trim();
  const validation = validatePassword(trimmedPassword);
  const lengthMessage = getPasswordLengthMessage(trimmedPassword);
  return validation.isValid ? null : [lengthMessage, ...validation.errors].filter(Boolean).join('. ');
};

const getRoleBadgeVariant = (role: AppRole | null): "default" | "secondary" | "destructive" | "outline" => {
  if (!role) return 'outline';
  if (role === 'admin') return 'destructive';
  if (role.includes('head') || role === 'executive') return 'default';
  return 'secondary';
};

export default function UserManagement() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const { departments: dbDepartments } = useDepartments();
  // Master Admin can assign any plant; everyone else can only assign plants
  // they themselves are assigned to.
  const { plantOptions: assignablePlants } = useVisiblePlants();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Edit logic state
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [resetPassword, setResetPassword] = useState('');
  const [passwordHistory, setPasswordHistory] = useState<{ changed_at: string }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('');
  const [newUserPlants, setNewUserPlants] = useState<string[]>(['1300']);
  const [newUserEmployeeId, setNewUserEmployeeId] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState('');

  const { hasAccess, loading: permLoading } = useRoleMatrix();
  const isAdmin = userRole === 'admin' || hasAccess('user_management');

  // Build role options dynamically from Role Management (departments table)
  const roleOptions = useMemo(() => {
    const fromDb = dbDepartments
      .filter(d => d.role_key && d.is_active)
      .map(d => ({
        value: d.role_key!,
        label: d.name,
        description: d.description || '',
      }));
    // Always include admin role
    if (!fromDb.find(r => r.value === 'admin')) {
      fromDb.unshift({ value: 'admin', label: 'Administrator', description: 'Full system access' });
    }
    return fromDb;
  }, [dbDepartments]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const { data: userPlantsData } = await supabase.from('user_plants').select('user_id, plant_code');

      const usersWithRoles: UserWithRole[] = (profiles || [])
        .filter(p => !HIDDEN_EMAILS.includes(p.email))
        .map(profile => {
          const userRoleData = roles?.find(r => r.user_id === profile.user_id);
          const assignedPlants = (userPlantsData || []).filter(up => up.user_id === profile.user_id).map(up => up.plant_code);
          // Find department name from role_key
          const roleDept = dbDepartments.find(d => d.role_key === userRoleData?.role);
          return {
            id: profile.id,
            user_id: profile.user_id,
            full_name: profile.full_name,
            email: profile.email,
            employee_id: profile.employee_id || '',
            plant: profile.plant,
            plants: assignedPlants.length > 0 ? assignedPlants : (profile.plant ? [profile.plant] : []),
            department: roleDept?.name || profile.department,
            role: userRoleData?.role as AppRole || null,
            created_at: profile.created_at,
          };
        });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({ title: 'Error', description: 'Failed to fetch users', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const fetchPasswordHistory = async (userId: string) => {
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from('password_history')
        .select('changed_at')
        .eq('user_id', userId)
        .order('changed_at', { ascending: false })
        .limit(5);
      setPasswordHistory(data || []);
    } catch (err) {
      console.error('Error fetching password history:', err);
      setPasswordHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleEditRole = (user: UserWithRole) => {
    setSelectedUser(user);
    setSelectedRole((user.role || '') as string);
    setSelectedPlants(user.plants || []);
    setEditEmployeeId(user.employee_id || '');
    setResetPassword('');
    setPasswordHistory([]);
    setIsEditDialogOpen(true);
    fetchPasswordHistory(user.user_id);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;

    const trimmedResetPassword = resetPassword.trim();
    if (trimmedResetPassword) {
      const passwordError = getPasswordValidationMessage(trimmedResetPassword);
      if (passwordError) {
        toast({ title: 'Password Policy Error', description: passwordError, variant: 'destructive' });
        return;
      }
    }

    const validRoleKeys = roleOptions.map(r => r.value);
    if (!selectedRole || !validRoleKeys.includes(selectedRole)) {
      toast({ title: 'Validation Error', description: 'Please select a valid role before saving.', variant: 'destructive' });
      return;
    }

    if (!editEmployeeId.trim()) {
      toast({ title: 'Validation Error', description: 'Employee ID is required.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // Check employee_id uniqueness
      const { data: existingEmp } = await supabase.from('profiles')
        .select('user_id').eq('employee_id', editEmployeeId.trim())
        .neq('user_id', selectedUser.user_id).maybeSingle();
      if (existingEmp) {
        toast({ title: 'Duplicate Employee ID', description: 'This Employee ID is already assigned to another user.', variant: 'destructive' });
        setSaving(false);
        return;
      }

      // Update profile — set department from role's department name
      const roleDept = dbDepartments.find(d => d.role_key === selectedRole);
      await supabase.from('profiles').update({ 
        department: roleDept?.name || selectedUser.department,
        plant: selectedPlants[0] || selectedUser.plant,
        employee_id: editEmployeeId.trim(),
      }).eq('user_id', selectedUser.user_id);

      // Update multi-plant assignments
      await supabase.from('user_plants').delete().eq('user_id', selectedUser.user_id);
      if (selectedPlants.length > 0) {
        const plantRows = selectedPlants.map(pc => ({ user_id: selectedUser.user_id, plant_code: pc }));
        await supabase.from('user_plants').upsert(plantRows, { onConflict: 'user_id,plant_code' });
      }

      // Update role mapping
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', selectedUser.user_id)
        .maybeSingle();

      if (existingRole) {
        const { error } = await supabase.from('user_roles').update({ role: selectedRole as any }).eq('user_id', selectedUser.user_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_roles').insert([{ user_id: selectedUser.user_id, role: selectedRole as any }]);
        if (error) throw error;
      }

      // Password reset
      if (trimmedResetPassword) {
        const pwHash = await hashPasswordForHistory(trimmedResetPassword);
        const { data: historyRecords } = await supabase
          .from('password_history')
          .select('password_hash')
          .eq('user_id', selectedUser.user_id)
          .order('changed_at', { ascending: false })
          .limit(4);

        if (historyRecords?.some(h => h.password_hash === pwHash)) {
          throw new Error('Cannot reuse any of the last 4 passwords. Please choose a different password.');
        }

        const { error: pwErr } = await supabase.rpc('admin_update_user_password', {
          target_user_id: selectedUser.user_id,
          new_password: trimmedResetPassword,
        });
        if (pwErr) throw pwErr;

        await supabase.from('password_history').insert({
          user_id: selectedUser.user_id,
          password_hash: pwHash,
        });

        const { data: existingSec } = await supabase
          .from('user_security')
          .select('id')
          .eq('user_id', selectedUser.user_id)
          .maybeSingle();

        if (existingSec) {
          await supabase.from('user_security').update({
            last_password_change: new Date().toISOString(),
            failed_login_attempts: 0,
            locked_until: null,
          }).eq('user_id', selectedUser.user_id);
        } else {
          await supabase.from('user_security').insert({
            user_id: selectedUser.user_id,
            last_password_change: new Date().toISOString(),
          });
        }
      }

      toast({
        title: 'Success',
        description: trimmedResetPassword
          ? 'Password reset successfully. The user can now login with Employee ID and the new password.'
          : `User ${selectedUser.full_name} updated successfully`,
      });
      setIsEditDialogOpen(false);
      setResetPassword('');
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({ title: 'Error', description: error?.message || 'Failed to update user', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-user', {
        body: { action: 'delete_user', user_id: selectedUser.user_id },
      });

      if (fnError || !data?.ok) {
        const errMsg = data?.error || fnError?.message || 'Failed to delete user';
        toast({ title: 'Error', description: errMsg, variant: 'destructive' });
        return;
      }

      toast({ title: 'Success', description: `User ${selectedUser.full_name} deleted successfully` });
      setIsDeleteDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserFullName || !newUserRole || !newUserEmployeeId.trim()) {
      toast({ title: 'Validation Error', description: 'Please fill all required fields (Name, Employee ID, Email, Password, Role)', variant: 'destructive' });
      return;
    }
    
    const passwordError = getPasswordValidationMessage(newUserPassword);
    if (passwordError) {
      toast({ title: 'Password Policy Error', description: passwordError, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // Check employee_id uniqueness
      const { data: existingEmp } = await supabase.from('profiles')
        .select('user_id').eq('employee_id', newUserEmployeeId.trim()).maybeSingle();
      if (existingEmp) {
        toast({ title: 'Duplicate Employee ID', description: 'This Employee ID is already assigned to another user.', variant: 'destructive' });
        setSaving(false);
        return;
      }

      const roleDept = dbDepartments.find(d => d.role_key === newUserRole);
      const primaryPlant = newUserPlants[0] || '1300';

      const { data: createData, error: createError } = await supabase.functions.invoke('create-user', {
        body: {
          email: newUserEmail.trim(),
          password: newUserPassword,
          full_name: newUserFullName.trim(),
          role: newUserRole,
          department: roleDept?.name || null,
          plant: primaryPlant,
          employee_id: newUserEmployeeId.trim(),
        }
      });

      if (createError) throw new Error(createError.message || 'Failed to create user');
      if (!createData?.ok) throw new Error(createData?.error || 'User creation failed');
      if (!createData?.user_id) throw new Error('User creation failed — no user ID returned');

      const newUserId = createData.user_id;

      // Handle multi-plant assignment (not handled by edge function)
      if (newUserPlants.length > 0) {
        const plantRows = newUserPlants.map(pc => ({ user_id: newUserId, plant_code: pc }));
        await supabase.from('user_plants').upsert(plantRows, { onConflict: 'user_id,plant_code' });
      }

      const roleLabel = roleOptions.find(r => r.value === newUserRole)?.label || newUserRole;
      toast({ title: 'User Created', description: `${newUserEmail} created with role ${roleLabel}` });
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserFullName('');
      setNewUserRole('');
      setNewUserPlants(['1300']);
      setNewUserEmployeeId('');
      setIsCreateDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error('[Create User] Fatal Error:', error);
      toast({ title: 'Error', description: error?.message || 'Failed to create user', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.employee_id?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (user.plant?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (user.department?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (user.role?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
            <p className="text-muted-foreground text-center">You do not have permission to manage users and roles.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 overflow-y-auto h-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-foreground flex items-center gap-2">
            <UserCog className="h-7 w-7" />
            User & Role Management
          </h1>
          <p className="text-muted-foreground mt-1">Create user accounts, assign roles (from Role Management), and manage access</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" /> Create User
          </Button>
          <Button onClick={fetchUsers} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><UserCog className="h-5 w-5 text-primary" /></div>
              <div><p className="text-2xl font-bold">{users.length}</p><p className="text-sm text-muted-foreground">Total Users</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg"><Shield className="h-5 w-5 text-destructive" /></div>
              <div><p className="text-2xl font-bold">{users.filter(u => u.role === 'admin').length}</p><p className="text-sm text-muted-foreground">Administrators</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/10 rounded-lg"><Building2 className="h-5 w-5 text-secondary" /></div>
              <div><p className="text-2xl font-bold">{users.filter(u => u.role?.includes('head')).length}</p><p className="text-sm text-muted-foreground">Role Heads</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg"><UserCog className="h-5 w-5 text-muted-foreground" /></div>
              <div><p className="text-2xl font-bold">{users.filter(u => !u.role).length}</p><p className="text-sm text-muted-foreground">Unassigned</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div><CardTitle>Users</CardTitle><CardDescription>View and manage user roles</CardDescription></div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No users found</div>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plants</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell><span className="font-mono text-sm">{user.employee_id || '-'}</span></TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.plants.length > 0 
                          ? user.plants.map(p => <Badge key={p} variant="outline" className="font-mono text-xs">{p}</Badge>)
                          : <span className="text-muted-foreground">-</span>
                        }
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.role ? (
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {roleOptions.find(r => r.value === user.role)?.label || user.role}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">No Role</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEditRole(user)}>
                          <><Edit className="h-3 w-3 mr-1" />Edit</>
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                          onClick={() => { setSelectedUser(user); setIsDeleteDialogOpen(true); }}>
                          <Trash2 className="h-3 w-3" />
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

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Create New User</DialogTitle>
            <DialogDescription>Create a new user account with role assignment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input placeholder="Enter full name" value={newUserFullName} onChange={(e) => setNewUserFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Employee ID *</Label>
              <Input placeholder="Enter employee ID" value={newUserEmployeeId} onChange={(e) => setNewUserEmployeeId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" placeholder="user@example.com" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password * <span className="text-xs text-muted-foreground">(8-10 chars, letter + number)</span></Label>
              <Input type="password" placeholder="8-10 characters" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
              <p className="text-xs text-muted-foreground">{PASSWORD_HELP_TEXT}</p>
              {getPasswordLengthMessage(newUserPassword) && (
                <p className="text-xs font-medium text-destructive">{getPasswordLengthMessage(newUserPassword)}</p>
              )}
              <PasswordPolicyIndicator password={newUserPassword} />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex flex-col">
                        <span>{role.label}</span>
                        {role.description && <span className="text-xs text-muted-foreground">{role.description}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Roles are managed in Role Management</p>
            </div>
            <div className="space-y-2">
              <Label>Assign Plants *</Label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
                {allPlants.map(p => (
                  <label key={p.code} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={newUserPlants.includes(p.code)}
                      onCheckedChange={(checked) => {
                        setNewUserPlants(prev => checked ? [...prev, p.code] : prev.filter(c => c !== p.code));
                      }}
                    />
                    <span className="font-mono">{p.code}</span>
                    {p.name && <span className="text-muted-foreground text-xs truncate">- {p.name}</span>}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={saving || !newUserEmail || !newUserPassword || !newUserFullName || !newUserRole || !newUserEmployeeId.trim()}>
              {saving ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5" /> Edit User</DialogTitle>
            <DialogDescription>Update role or reset password for {selectedUser?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>User</Label>
              <div className="p-3 bg-muted rounded-md border text-sm">
                <p className="font-medium">{selectedUser?.full_name}</p>
                <p className="text-muted-foreground">{selectedUser?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Employee ID *</Label>
              <Input placeholder="Enter employee ID" value={editEmployeeId} onChange={(e) => setEditEmployeeId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex flex-col">
                        <span>{role.label}</span>
                        {role.description && <span className="text-xs text-muted-foreground">{role.description}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Roles are managed in Role Management</p>
            </div>
            <div className="space-y-2">
              <Label>Assigned Plants</Label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
                {allPlants.map(p => (
                  <label key={p.code} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={selectedPlants.includes(p.code)}
                      onCheckedChange={(checked) => {
                        setSelectedPlants(prev => checked ? [...prev, p.code] : prev.filter(c => c !== p.code));
                      }}
                    />
                    <span className="font-mono">{p.code}</span>
                    {p.name && <span className="text-muted-foreground text-xs truncate">- {p.name}</span>}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Reset Password <span className="text-xs text-muted-foreground">(8-10 chars)</span></Label>
              <Input type="password" placeholder="Leave blank to keep current" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
              <p className="text-xs text-muted-foreground">{PASSWORD_HELP_TEXT}</p>
              {getPasswordLengthMessage(resetPassword) && (
                <p className="text-xs font-medium text-destructive">{getPasswordLengthMessage(resetPassword)}</p>
              )}
              <PasswordPolicyIndicator password={resetPassword} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password Change History</Label>
              {loadingHistory ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : passwordHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No password changes recorded</p>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {passwordHistory.map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2 rounded bg-muted/50 border">
                      <span className="text-muted-foreground">Password Change #{passwordHistory.length - idx}</span>
                      <span className="font-medium text-foreground">
                        {format(new Date(entry.changed_at), 'dd MMM yyyy, hh:mm a')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>Are you sure you want to delete {selectedUser?.full_name}? This will remove their role, plant assignments, and profile.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

