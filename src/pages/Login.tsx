import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Building2, Users, LogIn, Factory, CheckCircle, ClipboardCheck, Award, UserPlus, Eye, EyeOff, Zap, WifiOff, RefreshCw, Activity, Trash2 } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useHealthCheck, ConnectionStatus } from '@/hooks/useHealthCheck';
import { Alert, AlertDescription } from '@/components/ui/alert';
import loginHeroImage from '@/assets/login-hero.jpg';
import hblLogo from '@/assets/hbl-logo.png';

// Demo Account Row Component
function DemoAccountRow({ 
  email, 
  description, 
  role, 
  roleColor, 
  onQuickLogin 
}: { 
  email: string; 
  description: string; 
  role: string; 
  roleColor: string; 
  onQuickLogin: (email: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-background border hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate text-[11px]">{email}</p>
        <p className="text-muted-foreground text-[10px]">{description}</p>
      </div>
      <span className={`px-2 py-0.5 rounded-full ${roleColor} font-medium text-[10px] whitespace-nowrap`}>{role}</span>
      <Button 
        type="button"
        variant="outline" 
        size="sm" 
        className="h-6 px-2 text-[10px]"
        onClick={() => onQuickLogin(email)}
      >
        <Zap className="w-3 h-3 mr-1" />
        Quick
      </Button>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, isAuthenticated } = useAuth();
  const isOnline = useNetworkStatus();
  const { status: backendStatus, latency, recheck } = useHealthCheck({ interval: 15000 });
  const hasAutoCleared = useRef(false);

  // Auto-clear stale sessions on mount if backend seems unreachable
  useEffect(() => {
    if (hasAutoCleared.current) return;
    
    // Check if there are stale auth tokens in localStorage
    const hasStoredSession = Object.keys(localStorage).some(
      key => key.includes('supabase') || key.includes('sb-')
    );
    
    if (hasStoredSession) {
      // Test if we can actually reach the backend
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/plants?select=id&limit=1`, {
        method: 'HEAD',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        signal: controller.signal,
      }).catch(() => {
        // Backend unreachable with stale tokens - auto-clear
        if (!hasAutoCleared.current) {
          hasAutoCleared.current = true;
          console.warn('Auto-clearing stale session data due to connectivity issues');
          localStorage.clear();
          sessionStorage.clear();
          window.location.reload();
        }
      }).finally(() => clearTimeout(timeout));
    }
  }, []);

  // Sign In state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  
  // Sign Up state
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpFullName, setSignUpFullName] = useState('');
  const [signUpRole, setSignUpRole] = useState<AppRole | ''>('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  const roles: { value: AppRole; label: string; description: string; icon: typeof Shield }[] = [
    { value: 'quality', label: 'Quality Inspector', description: 'Create and review MRBs from quality inspection', icon: Shield },
    { value: 'quality_head', label: 'Quality Head', description: 'Oversee quality operations and approvals', icon: Award },
    { value: 'purchase', label: 'Purchase Team', description: 'Handle vendor communications and replacements', icon: Building2 },
    { value: 'purchase_head', label: 'Purchase Head', description: 'Manage purchase operations and vendor relations', icon: Building2 },
    { value: 'engineering', label: 'Engineering', description: 'Technical evaluation and deviation decisions', icon: Users },
    { value: 'engineering_head', label: 'Engineering Head', description: 'Oversee engineering reviews and approvals', icon: Users },
    { value: 'shop_floor', label: 'Shop Floor', description: 'Report production issues and material defects', icon: Factory },
    { value: 'executive', label: 'Executive', description: 'View executive summaries and final approvals', icon: Award },
  ];

  // Redirect if already authenticated
  if (isAuthenticated) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
    navigate(from, { replace: true });
    return null;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail || !signInPassword) return;
    
    // Clear any stale session data before attempting login
    const staleKeys = Object.keys(localStorage).filter(
      key => key.includes('supabase') || key.includes('sb-')
    );
    staleKeys.forEach(key => localStorage.removeItem(key));
    
    setIsLoading(true);
    setRetryCount(0);

    let lastError: any = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        setRetryCount(attempt);
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
      
      const { error } = await signIn(signInEmail, signInPassword);
      
      if (!error) {
        setIsLoading(false);
        setRetryCount(0);
        const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
        navigate(from, { replace: true });
        return;
      }
      
      lastError = error;
      // Only retry on network errors
      if (error.message !== 'Failed to fetch' && 
          (error as any)?.name !== 'AuthRetryableFetchError') {
        break;
      }
    }
    
    setIsLoading(false);
    setRetryCount(0);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpEmail || !signUpPassword || !signUpFullName || !signUpRole) return;
    
    setIsLoading(true);
    const { error } = await signUp(signUpEmail, signUpPassword, signUpFullName, signUpRole);
    setIsLoading(false);
    
    if (!error) {
      navigate('/', { replace: true });
    }
  };

  const features = [
    { icon: ClipboardCheck, text: 'Streamlined Quality Reviews' },
    { icon: Factory, text: 'Multi-Plant Support' },
    { icon: CheckCircle, text: 'Real-time MRB Tracking' },
    { icon: Award, text: 'Audit-Ready Documentation' },
  ];

  const getRolePermissions = (role: AppRole) => {
    const permissions: Record<AppRole, string[]> = {
      quality: ['Create MRB', 'Quality Review', 'Inward Report'],
      quality_head: ['Quality Oversight', 'Final Approval', 'All Quality MRBs'],
      purchase: ['Purchase Review', 'Vendor Action'],
      purchase_head: ['Purchase Oversight', 'Vendor Management'],
      engineering: ['Engineering Review', 'Deviation Approval'],
      engineering_head: ['Engineering Oversight', 'Technical Decisions'],
      shop_floor: ['Shop Floor MRB', 'Report Issues'],
      executive: ['Executive Dashboard', 'Final Approvals', 'All MRBs'],
      admin: ['Full Access', 'User Management', 'System Config'],
      mrb_committee: ['MRB Committee Review', 'Cross-functional Decisions'],
    };
    return permissions[role] || [];
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Left Side - Hero Image */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden">
        <img 
          src={loginHeroImage} 
          alt="Manufacturing Quality Control" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-primary/50" />
        
        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-16 text-primary-foreground">
          <div className="flex items-center gap-3">
            <img src={hblLogo} alt="HBL Logo" className="h-12 w-auto bg-white rounded p-1" />
          </div>
          
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
                Material Review Board
              </h1>
              <p className="text-xl xl:text-2xl text-primary-foreground/90 max-w-lg">
                Enterprise Quality Management System for Manufacturing Excellence
              </p>
            </div>
            
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
          
          <div className="space-y-2">
            <p className="text-lg italic text-primary-foreground/80">
              "Quality is not an act, it is a habit."
            </p>
            <p className="text-sm text-primary-foreground/60">— Aristotle</p>
          </div>
        </div>
      </div>

      {/* Right Side - Login/Signup Form */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-6 sm:p-8">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center">
            <img src={hblLogo} alt="HBL Logo" className="h-16 w-auto mx-auto mb-4" />
          </div>

          {/* Welcome Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg lg:hidden">
              <Shield className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-bold text-foreground">Welcome!</h2>
            <p className="text-muted-foreground">
              Sign in or create an account to continue
            </p>
          </div>

          {/* Connection Status Banner */}
          {(!isOnline || backendStatus === 'disconnected') && (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
              <WifiOff className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  {!isOnline 
                    ? "You're offline. Please check your internet connection." 
                    : "Cannot reach backend. Retrying automatically..."}
                </span>
                <Button variant="ghost" size="sm" className="h-7 px-2 ml-2" onClick={recheck}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Card className="shadow-xl border-0 bg-card/80 backdrop-blur">
            <Tabs defaultValue="signin" className="w-full">
              <CardHeader className="pb-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin" className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Sign Up
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              
              <CardContent>
                {/* Sign In Tab */}
                <TabsContent value="signin" className="mt-0">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email Address</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="h-11"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="signin-password"
                          type={showSignInPassword ? 'text' : 'password'}
                          value={signInPassword}
                          onChange={(e) => setSignInPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="h-11 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignInPassword(!showSignInPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading || !signInEmail || !signInPassword || !isOnline}
                      className="w-full h-11 text-base font-medium"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          {retryCount > 0 ? `Retrying (${retryCount}/${MAX_RETRIES})...` : 'Signing in...'}
                        </span>
                      ) : !isOnline ? (
                        <span className="flex items-center gap-2">
                          <WifiOff className="w-4 h-4" />
                          No Connection
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <LogIn className="w-4 h-4" />
                          Sign In
                        </span>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                {/* Sign Up Tab */}
                <TabsContent value="signup" className="mt-0">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full Name</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        value={signUpFullName}
                        onChange={(e) => setSignUpFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="h-11"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email Address</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="h-11"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showSignUpPassword ? 'text' : 'password'}
                          value={signUpPassword}
                          onChange={(e) => setSignUpPassword(e.target.value)}
                          placeholder="Create a password (min 6 characters)"
                          className="h-11 pr-10"
                          minLength={6}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showSignUpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-role">Select Your Role *</Label>
                      <Select value={signUpRole} onValueChange={(val) => setSignUpRole(val as AppRole)}>
                        <SelectTrigger id="signup-role" className="h-11">
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

                    {/* Role Permissions */}
                    {signUpRole && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Permissions</Label>
                        <div className="flex flex-wrap gap-2">
                          {getRolePermissions(signUpRole).map((permission, index) => (
                            <span key={index} className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">
                              {permission}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={isLoading || !signUpEmail || !signUpPassword || !signUpFullName || !signUpRole}
                      className="w-full h-11 text-base font-medium"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          Creating account...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <UserPlus className="w-4 h-4" />
                          Create Account
                        </span>
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>

          {/* Demo Accounts Section */}
          <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
                <Users className="w-4 h-4" />
                Demo Accounts for Testing
              </CardTitle>
              <CardDescription className="text-xs">
                Click "Quick Login" to auto-fill credentials (Password: demo123)
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-1.5 text-xs max-h-[320px] overflow-y-auto pr-1">
                {/* Admin Accounts */}
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pt-1">Admin Access</p>
                <DemoAccountRow 
                  email="bala@sharviinfotech.com"
                  description="Full system access - all stages"
                  role="Admin"
                  roleColor="bg-red-100 text-red-700"
                  onQuickLogin={(email) => { setSignInEmail(email); setSignInPassword(''); }}
                />
                <DemoAccountRow 
                  email="inturimounika@sharviinfotech.com"
                  description="Full system access - all stages"
                  role="Admin"
                  roleColor="bg-red-100 text-red-700"
                  onQuickLogin={(email) => { setSignInEmail(email); setSignInPassword(''); }}
                />
                
                {/* Quality Team */}
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pt-2">Quality Team</p>
                <DemoAccountRow 
                  email="quality.demo@hbl.com"
                  description="Quality review & MRB creation"
                  role="Quality"
                  roleColor="bg-blue-100 text-blue-700"
                  onQuickLogin={(email) => { setSignInEmail(email); setSignInPassword('demo123'); }}
                />
                <DemoAccountRow 
                  email="qualityhead.demo@hbl.com"
                  description="Quality oversight & approvals"
                  role="Quality Head"
                  roleColor="bg-blue-100 text-blue-700"
                  onQuickLogin={(email) => { setSignInEmail(email); setSignInPassword('demo123'); }}
                />
                
                {/* Purchase Team */}
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pt-2">Purchase Team</p>
                <DemoAccountRow 
                  email="purchase.demo@hbl.com"
                  description="Vendor actions & purchase review"
                  role="Purchase"
                  roleColor="bg-purple-100 text-purple-700"
                  onQuickLogin={(email) => { setSignInEmail(email); setSignInPassword('demo123'); }}
                />
                <DemoAccountRow 
                  email="purchasehead.demo@hbl.com"
                  description="Purchase oversight & vendor mgmt"
                  role="Purchase Head"
                  roleColor="bg-purple-100 text-purple-700"
                  onQuickLogin={(email) => { setSignInEmail(email); setSignInPassword('demo123'); }}
                />
                
                {/* Engineering Team */}
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pt-2">Engineering Team</p>
                <DemoAccountRow 
                  email="engineering.demo@hbl.com"
                  description="Technical evaluation & deviations"
                  role="Engineering"
                  roleColor="bg-orange-100 text-orange-700"
                  onQuickLogin={(email) => { setSignInEmail(email); setSignInPassword('demo123'); }}
                />
                <DemoAccountRow 
                  email="enghead.demo@hbl.com"
                  description="Engineering oversight & decisions"
                  role="Eng Head"
                  roleColor="bg-orange-100 text-orange-700"
                  onQuickLogin={(email) => { setSignInEmail(email); setSignInPassword('demo123'); }}
                />
                
                {/* Other Roles */}
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pt-2">Other Roles</p>
                <DemoAccountRow 
                  email="shopfloor.demo@hbl.com"
                  description="Report issues & material defects"
                  role="Shop Floor"
                  roleColor="bg-amber-100 text-amber-700"
                  onQuickLogin={(email) => { setSignInEmail(email); setSignInPassword('demo123'); }}
                />
                <DemoAccountRow 
                  email="executive.demo@hbl.com"
                  description="Final approvals & dashboards"
                  role="Executive"
                  roleColor="bg-green-100 text-green-700"
                  onQuickLogin={(email) => { setSignInEmail(email); setSignInPassword('demo123'); }}
                />
              </div>
              
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-medium text-foreground mb-2">MRB Workflow Stages:</p>
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700">Quality</span>
                  <span className="text-muted-foreground text-[10px]">→</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700">Purchase</span>
                  <span className="text-muted-foreground text-[10px]">→</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-orange-100 text-orange-700">Engineering</span>
                  <span className="text-muted-foreground text-[10px]">→</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-700">Final</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer with Health Check & Clear Session */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              {/* Health Indicator */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`inline-block w-2 h-2 rounded-full ${
                  backendStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
                  backendStatus === 'checking' ? 'bg-amber-500 animate-pulse' :
                  'bg-destructive'
                }`} />
                <span>
                  {backendStatus === 'connected' 
                    ? `Backend connected${latency ? ` (${latency}ms)` : ''}` 
                    : backendStatus === 'checking' 
                    ? 'Checking connection...' 
                    : 'Backend unreachable'}
                </span>
                <button onClick={recheck} className="hover:text-foreground transition-colors" title="Recheck">
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>

              {/* Clear Session */}
              <button
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.reload();
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Clear cached session data and reload"
              >
                <Trash2 className="h-3 w-3" />
                Clear Session
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              HBL Material Review Board © {new Date().getFullYear()} • All rights reserved
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
