import { useState, useEffect, useMemo } from 'react';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';
import { useDepartments } from '@/hooks/useDepartments';
import { usePlants } from '@/hooks/usePlantConfig';
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
import { validatePassword, hashPasswordForHistory } from '@/lib/passwordPolicy';
import { format } from 'date-fns';

interface UserWithRole {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  plant: string | null;
  plants: string[];
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
  { value: 'mrb_committee', label: 'MRB Committee', description: 'MRB committee member' },
];

// Legacy fallback - used only if departments fail to load
const FALLBACK_DEPARTMENTS = ['IT', 'Management', 'Quality', 'Purchase', 'Engineering', 'Shop Floor', 'MRB Committee'];

const DEPARTMENT_ROLE_MAP: Record<string, AppRole[]> = {
  'IT': ['admin', 'executive', 'quality_head', 'quality', 'purchase_head', 'purchase', 'engineering_head', 'engineering', 'shop_floor', 'mrb_committee'],
  'Management': ['executive', 'mrb_committee'],
  'Quality': ['quality_head', 'quality'],
  'Purchase': ['purchase_head', 'purchase'],
  'Engineering': ['engineering_head', 'engineering'],
  'Shop Floor': ['shop_floor'],
  'MRB Committee': ['mrb_committee'],
};

const HIDDEN_EMAILS = ['masteradmin@sharviinfotech.com', 'bala@sharviinfotech.com'];

const getRoleBadgeVariant = (role: AppRole | null): "default" | "secondary" | "destructive" | "outline" => {
  if (!role) return 'outline';
  if (role === 'admin') return 'destructive';
  if (role.includes('head') || role === 'executive') return 'default';
  return 'secondary';
};

const getFilteredRoles = (department: string) => {
  const allowedRoles = DEPARTMENT_ROLE_MAP[department];
  if (!allowedRoles) return ROLES;
  return ROLES.filter(r => allowedRoles.includes(r.value));
};

export default function UserManagement() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const { departments: dbDepartments } = useDepartments();
  const allPlants = usePlants();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Edit logic state
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [resetPassword, setResetPassword] = useState('');
  const [passwordHistory, setPasswordHistory] = useState<{ changed_at: string }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole | ''>('');
  const [newUserDepartment, setNewUserDepartment] = useState('');
  const [newUserPlants, setNewUserPlants] = useState<string[]>(['1300']);

  const isAdmin = userRole === 'admin';

  // Use DB departments, fallback to hardcoded
  const departmentNames = dbDepartments.length > 0 ? dbDepartments.map(d => d.name) : FALLBACK_DEPARTMENTS;

  const createDialogRoles = useMemo(() => {
    if (!newUserDepartment) return ROLES;
    return getFilteredRoles(newUserDepartment);
  }, [newUserDepartment]);

  const editDialogRoles = useMemo(() => {
    if (!selectedDepartment) return ROLES;
    return getFilteredRoles(selectedDepartment);
  }, [selectedDepartment]);

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

      // Fetch user_plants assignments
      const { data: userPlantsData } = await supabase.from('user_plants').select('user_id, plant_code');

      const usersWithRoles: UserWithRole[] = (profiles || [])
        .filter(p => !HIDDEN_EMAILS.includes(p.email))
        .map(profile => {
          const userRoleData = roles?.find(r => r.user_id === profile.user_id);
          const assignedPlants = (userPlantsData || []).filter(up => up.user_id === profile.user_id).map(up => up.plant_code);
          return {
            id: profile.id,
            user_id: profile.user_id,
            full_name: profile.full_name,
            email: profile.email,
            plant: profile.plant,
            plants: assignedPlants.length > 0 ? assignedPlants : (profile.plant ? [profile.plant] : []),
            department: profile.department,
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
    setSelectedRole((user.role || '') as '' | AppRole);
    setSelectedDepartment(user.department || '');
    setSelectedPlants(user.plants || []);
    setResetPassword('');
    setPasswordHistory([]);
    setIsEditDialogOpen(true);
    fetchPasswordHistory(user.user_id);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;

    // Validate role is a valid enum value before saving
    const validRoles: AppRole[] = ['admin', 'quality', 'quality_head', 'purchase', 'purchase_head', 'engineering', 'engineering_head', 'shop_floor', 'executive', 'mrb_committee'];
    if (!selectedRole || !validRoles.includes(selectedRole as AppRole)) {
      toast({ title: 'Validation Error', description: 'Please select a valid role before saving.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // Update profile (department)
      if (selectedDepartment) {
        await supabase.from('profiles').update({ department: selectedDepartment }).eq('user_id', selectedUser.user_id);
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

      // Password reset via secure database RPC
      if (resetPassword.trim()) {
        const validation = validatePassword(resetPassword.trim());
        if (!validation.isValid) {
          throw new Error(validation.errors.join('. '));
        }

        // Check password reuse (last 4 passwords)
        const pwHash = await hashPasswordForHistory(resetPassword.trim());
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
          new_password: resetPassword.trim(),
        });
        if (pwErr) throw pwErr;

        // Record in password history
        await supabase.from('password_history').insert({
          user_id: selectedUser.user_id,
          password_hash: pwHash,
        });

        // Update user_security last_password_change
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
        description: `User ${selectedUser.full_name} updated successfully`,
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

  const handleDeleteRole = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', selectedUser.user_id);
      if (error) throw error;
      toast({ title: 'Success', description: `Role removed for ${selectedUser.full_name}` });
      setIsDeleteDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting role:', error);
      toast({ title: 'Error', description: 'Failed to remove role', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (newUserDepartment && newUserRole) {
      const allowed = DEPARTMENT_ROLE_MAP[newUserDepartment];
      if (allowed && !allowed.includes(newUserRole as AppRole)) {
        setNewUserRole('');
      }
    }
  }, [newUserDepartment]);

  useEffect(() => {
    if (selectedDepartment && selectedRole) {
      const allowed = DEPARTMENT_ROLE_MAP[selectedDepartment];
      if (allowed && !allowed.includes(selectedRole as AppRole)) {
        setSelectedRole('');
      }
    }
  }, [selectedDepartment]);

  // Create user using supabase.auth.signUp (no edge function)
  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserFullName || !newUserRole || !newUserDepartment) {
      toast({ title: 'Validation Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    
    const validation = validatePassword(newUserPassword);
    if (!validation.isValid) {
      toast({ 
        title: 'Password Policy Error', 
        description: validation.errors.join('. '), 
        variant: 'destructive' 
      });
      return;
    }

    setSaving(true);
    try {
      // Use a temporary client to avoid logging out the current admin session
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
      
      const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: 'temp-create-user-token'
        }
      });

      const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({
        email: newUserEmail.trim(),
        password: newUserPassword,
        options: {
          data: {
            full_name: newUserFullName.trim(),
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('User creation failed silently.');
      
      const newUserId = signUpData.user.id;

      // Update profile and assign role using the active admin session
      const { error: profileUpdateError } = await supabase.from('profiles').update({
        department: newUserDepartment,
        plant: newUserPlants[0] || '1300',
        full_name: newUserFullName.trim(),
      }).eq('user_id', newUserId);

      if (profileUpdateError) throw profileUpdateError;

      // Assign multiple plants
      if (newUserPlants.length > 0) {
        const plantRows = newUserPlants.map(pc => ({ user_id: newUserId, plant_code: pc }));
        await supabase.from('user_plants').upsert(plantRows, { onConflict: 'user_id,plant_code' });
      }

      const { error: roleInsertError } = await supabase.from('user_roles').upsert({
        user_id: newUserId,
        role: newUserRole as AppRole,
      }, {
        onConflict: 'user_id',
      });

      if (roleInsertError) throw roleInsertError;

      // Record initial password in history
      const pwHash = await hashPasswordForHistory(newUserPassword);
      await supabase.from('password_history').insert({
        user_id: newUserId,
        password_hash: pwHash,
      });

      // Create user_security record
      await supabase.from('user_security').insert({
        user_id: newUserId,
        last_password_change: new Date().toISOString(),
      });

      toast({ title: 'User Created', description: `${newUserEmail} created with role ${ROLES.find(r => r.value === newUserRole)?.label}` });
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserFullName('');
      setNewUserRole('');
      setNewUserDepartment('');
      setNewUserPlants(['1300']);
      setIsCreateDialogOpen(false);
      fetchUsers();
      
      console.log('[Create User] ------------- END SUCCESS -------------');
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
    (user.plant?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (user.department?.toLowerCase().includes(searchQuery.toLowerCase())) ||
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
              Only administrators can manage users and roles.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserCog className="h-7 w-7" />
            User & Role Management
          </h1>
          <p className="text-muted-foreground mt-1">Create user accounts, assign roles, and manage access</p>
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
              <div><p className="text-2xl font-bold">{users.filter(u => u.role?.includes('head')).length}</p><p className="text-sm text-muted-foreground">Department Heads</p></div>
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
            <div><CardTitle>Users</CardTitle><CardDescription>View and manage user roles and departments</CardDescription></div>
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
                    <TableCell>
                      {user.department ? <Badge variant="outline">{user.department}</Badge> : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {user.role ? (
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {ROLES.find(r => r.value === user.role)?.label || user.role}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">No Role</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEditRole(user)}>
                          {user.role ? (<><Edit className="h-3 w-3 mr-1" />Edit</>) : (<><Plus className="h-3 w-3 mr-1" />Assign</>)}
                        </Button>
                        {user.role && (
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                            onClick={() => { setSelectedUser(user); setIsDeleteDialogOpen(true); }}>
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

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Create New User</DialogTitle>
            <DialogDescription>Create a new user account with role and department</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input placeholder="Enter full name" value={newUserFullName} onChange={(e) => setNewUserFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" placeholder="user@example.com" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password * <span className="text-xs text-muted-foreground">(8-10 chars, letter + number)</span></Label>
              <Input type="password" placeholder="8-10 characters" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value.slice(0, 10))} maxLength={10} />
              <PasswordPolicyIndicator password={newUserPassword} />
            </div>
            <div className="space-y-2">
              <Label>Department *</Label>
              <Select value={newUserDepartment} onValueChange={setNewUserDepartment}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departmentNames.map((dept) => (<SelectItem key={dept} value={dept}>{dept}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole)} disabled={!newUserDepartment}>
                <SelectTrigger><SelectValue placeholder={newUserDepartment ? "Select role" : "Select department first"} /></SelectTrigger>
                <SelectContent>
                  {createDialogRoles.map((role) => (<SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>))}
                </SelectContent>
              </Select>
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
            <Button onClick={handleCreateUser} disabled={saving || !newUserEmail || !newUserPassword || !newUserFullName || !newUserRole || !newUserDepartment}>
              {saving ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5" /> Edit User</DialogTitle>
            <DialogDescription>Update department, role, or reset password for {selectedUser?.full_name}</DialogDescription>
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
              <Label>Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (<SelectItem key={dept} value={dept}>{dept}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as AppRole)}>
                <SelectTrigger><SelectValue placeholder={selectedDepartment ? "Select role" : "Select department first"} /></SelectTrigger>
                <SelectContent>
                  {editDialogRoles.map((role) => (
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
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Reset Password <span className="text-xs text-muted-foreground">(8-10 chars)</span></Label>
              <Input type="password" placeholder="Leave blank to keep current" value={resetPassword} onChange={(e) => setResetPassword(e.target.value.slice(0, 10))} maxLength={10} />
              <PasswordPolicyIndicator password={resetPassword} />
            </div>

            {/* Password History */}
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

      {/* Delete Role Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Role</DialogTitle>
            <DialogDescription>Are you sure you want to remove the role from {selectedUser?.full_name}?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteRole} disabled={saving}>
              {saving ? 'Removing...' : 'Remove Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
