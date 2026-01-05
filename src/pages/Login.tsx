import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '@/contexts/RoleContext';
import { UserRole } from '@/types/mrb';
import { mockUsers } from '@/data/mockData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Shield, Building2, Users, LogIn, Factory, CheckCircle, ClipboardCheck, Award } from 'lucide-react';
import loginHeroImage from '@/assets/login-hero.jpg';
import hblLogo from '@/assets/hbl-logo.png';

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
    await new Promise(resolve => setTimeout(resolve, 500));
    setRole(selectedRole);
    setIsLoading(false);
    navigate('/');
  };

  const selectedUser = mockUsers.find(u => u.role === selectedRole);

  const features = [
    { icon: ClipboardCheck, text: 'Streamlined Quality Reviews' },
    { icon: Factory, text: 'Multi-Plant Support' },
    { icon: CheckCircle, text: 'Real-time MRB Tracking' },
    { icon: Award, text: 'Audit-Ready Documentation' },
  ];

  return (
    <div className="min-h-screen w-full flex">
      {/* Left Side - Hero Image */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden">
        {/* Hero Image */}
        <img 
          src={loginHeroImage} 
          alt="Manufacturing Quality Control" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-primary/50" />
        
        {/* Content Overlay */}
        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-16 text-primary-foreground">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src={hblLogo} alt="HBL Logo" className="h-12 w-auto bg-white rounded p-1" />
          </div>
          
          {/* Main Hero Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
                Material Review Board
              </h1>
              <p className="text-xl xl:text-2xl text-primary-foreground/90 max-w-lg">
                Enterprise Quality Management System for Manufacturing Excellence
              </p>
            </div>
            
            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-4"
                >
                  <feature.icon className="w-6 h-6 text-white flex-shrink-0" />
                  <span className="text-sm xl:text-base font-medium">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Footer Quote */}
          <div className="space-y-2">
            <p className="text-lg italic text-primary-foreground/80">
              "Quality is not an act, it is a habit."
            </p>
            <p className="text-sm text-primary-foreground/60">— Aristotle</p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-6 sm:p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center">
            <img src={hblLogo} alt="HBL Logo" className="h-16 w-auto mx-auto mb-4" />
          </div>

          {/* Welcome Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg lg:hidden">
              <Shield className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-bold text-foreground">Welcome Back!</h2>
            <p className="text-muted-foreground">
              Sign in to access your MRB dashboard
            </p>
          </div>

          <Card className="shadow-xl border-0 bg-card/80 backdrop-blur">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl font-semibold text-center">Sign In</CardTitle>
              <CardDescription className="text-center">
                Select your role to continue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={selectedUser?.email || ''}
                  placeholder="Select a role to see user email"
                  disabled
                  className="bg-muted/50 h-11"
                />
              </div>

              {/* Role Selection */}
              <div className="space-y-2">
                <Label htmlFor="role">Select Role *</Label>
                <Select value={selectedRole} onValueChange={(val) => setSelectedRole(val as UserRole)}>
                  <SelectTrigger id="role" className="h-11">
                    <SelectValue placeholder="Choose your role..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border shadow-lg z-50">
                    {roles.map((role) => (
                      <SelectItem key={role.value} value={role.value} className="py-3">
                        <div className="flex items-center gap-3">
                          <role.icon className="w-4 h-4 text-primary" />
                          <span className="font-medium">{role.label}</span>
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
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{selectedUser?.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{selectedUser?.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">{selectedUser?.plant}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Role Permissions */}
              {selectedRole && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Permissions</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedRole === 'quality' && (
                      <>
                        <span className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">Create MRB</span>
                        <span className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">Quality Review</span>
                        <span className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">Inward Report</span>
                      </>
                    )}
                    {selectedRole === 'purchase' && (
                      <>
                        <span className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">Purchase Review</span>
                        <span className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">Vendor Action</span>
                      </>
                    )}
                    {selectedRole === 'engineering' && (
                      <>
                        <span className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">Engineering Review</span>
                        <span className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">Deviation Approval</span>
                      </>
                    )}
                    {selectedRole === 'plant_head' && (
                      <>
                        <span className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">Final Approval</span>
                        <span className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">All MRBs</span>
                      </>
                    )}
                    {selectedRole === 'shop_floor' && (
                      <>
                        <span className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">Shop Floor MRB</span>
                        <span className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">Report Issues</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Login Button */}
              <Button
                onClick={handleLogin}
                disabled={!selectedRole || isLoading}
                className="w-full h-11 text-base font-medium"
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
            </CardContent>
          </Card>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground">
            HBL Material Review Board © {new Date().getFullYear()} • All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}
