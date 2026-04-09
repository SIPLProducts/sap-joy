import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Building2, Users, LogIn, Factory, CheckCircle, ClipboardCheck, Award, UserPlus, Eye, EyeOff, Zap, WifiOff, RefreshCw, Activity, Trash2, AlertTriangle } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useHealthCheck, ConnectionStatus } from '@/hooks/useHealthCheck';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { validatePassword } from '@/lib/passwordPolicy';
import { PasswordPolicyIndicator } from '@/components/auth/PasswordPolicyIndicator';
import loginHeroImage from '@/assets/login-hero.jpg';
import hblLogo from '@/assets/hbl-logo.png';


