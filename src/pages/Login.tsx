import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '@/contexts/RoleContext';
import { UserRole } from '@/types/mrb';
import { mockUsers, getRoleDisplayName } from '@/data/mockData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Shield, Building2, Users, LogIn } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { setRole } = useRole();
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('');
  const [isLoading, setIsLoading] = useState(false);

  const roles: { value: UserRole; label: string; description: string; icon: typeof Shield }[] = [
    { value: 'quality', label: 'Quality Inspector', description: 'Create and review MRBs from quality inspection', icon: Shield },
    { value: 'purchase', label: 'Purchase Team', description: 'Handle vendor communications and replacements', icon: Building2 },
    { value: 'engineering', label: 'Engineering', description: 'Technical evaluation and deviation decisions', icon: Users },
    { value: 'plant_head', label: 'Plant Head', description: 'Final approval authority for MRBs', icon: Shield },
    { value: 'shop_floor', label: 'Shop Floor', description: 'Report production issues and material defects', icon: Building2 },
  ];

  const handleLogin = async () => {
    if (!selectedRole) return;
    
    setIsLoading(true);
    // Simulate login delay
    await new Promise(resolve => setTimeout(resolve, 500));
    setRole(selectedRole);
    setIsLoading(false);
    navigate('/');
  };

  const selectedUser = mockUsers.find(u => u.role === selectedRole);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30" />
      
      <div className="relative z-10 w-full max-w-lg px-4">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Material Review Board</h1>
          <p className="text-muted-foreground mt-2">Enterprise Quality Management System</p>
        </div>

        <Card className="shadow-2xl border-0 bg-card/95 backdrop-blur">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-semibold text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">
              Select your role to access the MRB system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email Field (Display Only) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={selectedUser?.email || ''}
                placeholder="Select a role to see user email"
                disabled
                className="bg-muted/50"
              />
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label htmlFor="role">Select Role *</Label>
              <Select value={selectedRole} onValueChange={(val) => setSelectedRole(val as UserRole)}>
                <SelectTrigger id="role" className="h-12">
                  <SelectValue placeholder="Choose your role..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg z-50">
                  {roles.map((role) => (
                    <SelectItem key={role.value} value={role.value} className="py-3">
                      <div className="flex items-center gap-3">
                        <role.icon className="w-4 h-4 text-primary" />
                        <div>
                          <span className="font-medium">{role.label}</span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected Role Info */}
            {selectedRole && (
              <div className="rounded-lg bg-accent/50 p-4 border border-accent">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{selectedUser?.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedUser?.plant}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Role Permissions Preview */}
            {selectedRole && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Permissions</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedRole === 'quality' && (
                    <>
                      <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">Create MRB</span>
                      <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">Quality Review</span>
                      <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">Inward Report</span>
                    </>
                  )}
                  {selectedRole === 'purchase' && (
                    <>
                      <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">Purchase Review</span>
                      <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">Vendor Action</span>
                    </>
                  )}
                  {selectedRole === 'engineering' && (
                    <>
                      <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">Engineering Review</span>
                      <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">Deviation Approval</span>
                    </>
                  )}
                  {selectedRole === 'plant_head' && (
                    <>
                      <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">Final Approval</span>
                      <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">All MRBs</span>
                    </>
                  )}
                  {selectedRole === 'shop_floor' && (
                    <>
                      <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">Shop Floor MRB</span>
                      <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">Report Issues</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Login Button */}
            <Button
              onClick={handleLogin}
              disabled={!selectedRole || isLoading}
              className="w-full h-12 text-base font-medium"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Sign In
                </span>
              )}
            </Button>

            {/* Footer */}
            <p className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
              HBL Material Review Board © {new Date().getFullYear()}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
