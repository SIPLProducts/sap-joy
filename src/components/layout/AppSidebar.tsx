import { ClipboardList, Mail, Wrench, FileSpreadsheet, BarChart3, LogOut, Package, Building2, Users, Settings, PieChart, Printer, UserCog, TrendingUp, HelpCircle, FileText, Shield, Layers, GitBranch, AlertTriangle } from 'lucide-react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useRole } from '@/contexts/RoleContext';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useDashboardConfig } from '@/hooks/usePlantConfig';
import { useRoleMatrix } from '@/hooks/useRoleMatrix';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Menu items with role-based access based on User's Matrix from Database
const menuItems = [
  { title: 'KPI Dashboard', url: '/', icon: BarChart3, matrixKey: 'dashboard_kpi' },
  { title: 'MRB Worklist', url: '/worklist', icon: ClipboardList, matrixKey: 'mrb_worklist' },
  { title: 'Pending Actions', url: '/pending-actions', icon: AlertTriangle, matrixKey: 'pending_actions' },
  { title: 'Material Blocking', url: '/shop-floor/stock-selection', icon: Package, matrixKey: 'material_booking' },
  { title: 'MRB - Inward Materials', url: '/inward/report', icon: FileSpreadsheet, matrixKey: 'inward_materials' },
  { title: 'MRB - Inward InProcess', url: '/inward/inprocess', icon: Layers, matrixKey: 'inward_inprocess' },
  { title: 'MRB Print', url: '/mrb-print', icon: Printer, matrixKey: 'mrb_print' },
  { title: 'Email Log', url: '/emails', icon: Mail, matrixKey: 'email_log' },
  { title: 'Help & Support', url: '/help', icon: HelpCircle, matrixKey: 'help_support' },
];

// Role-specific dashboards based on User's Matrix from Database
const dashboardItems = [
  { title: 'MRB Analytics', url: '/dashboard/analytics', icon: TrendingUp, dashboardKey: 'analytics', matrixKey: 'analytics_dashboard' },
  { title: 'Quality Dashboard', url: '/dashboard/quality-head', icon: Settings, dashboardKey: 'quality_head', matrixKey: 'quality_dashboard' },
  { title: 'Purchase Dashboard', url: '/dashboard/purchase-head', icon: Users, dashboardKey: 'purchase_head', matrixKey: 'purchase_dashboard' },
  { title: 'Engineering Dashboard', url: '/dashboard/engineering-head', icon: Wrench, dashboardKey: 'engineering_head', matrixKey: 'engineering_dashboard' },
  { title: 'Executive Summary', url: '/dashboard/executive-summary', icon: PieChart, dashboardKey: 'executive_summary', matrixKey: 'executive_summary' },
];

const adminItems = [
  { title: 'User & Role Management', url: '/admin/users', icon: UserCog, matrixKey: 'user_management', masterOnly: false },
  { title: 'Role Access Matrix', url: '/admin/matrix', icon: Shield, matrixKey: 'role_access', masterOnly: false },
  { title: 'Plant Management', url: '/admin/plants', icon: Building2, matrixKey: 'plant_management', masterOnly: false },
  { title: 'Role Management', url: '/admin/roles', icon: Layers, matrixKey: 'role_management', masterOnly: false },
  { title: 'Workflow Routing', url: '/admin/workflow', icon: GitBranch, matrixKey: 'workflow_config', masterOnly: false },
  { title: 'SAP API Settings', url: '/admin/sap-api', icon: Settings, matrixKey: 'sap_api_settings', masterOnly: true },
  { title: 'SAP Sync Monitor', url: '/admin/sap-sync', icon: TrendingUp, matrixKey: 'sap_sync_monitor', masterOnly: true },
  { title: 'Email Configuration', url: '/admin/email-config', icon: Mail, matrixKey: 'email_config', masterOnly: false },
];

const MASTER_ADMIN_EMAIL = 'masteradmin@sharviinfotech.com';

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { roleDisplayName } = useRole();
  const { signOut, userRole, profile, user } = useAuth();
  const { isDashboardEnabled } = useDashboardConfig();
  const { hasAccess } = useRoleMatrix();
  const isMasterAdmin = profile?.email === MASTER_ADMIN_EMAIL || user?.email === MASTER_ADMIN_EMAIL;

  // Admin items filtered by permission matrix + master status
  const visibleAdminItems = adminItems.filter(item => {
    if (item.masterOnly && !isMasterAdmin) return false;
    if (userRole === 'admin') return true;
    return hasAccess(item.matrixKey);
  });

  // Filter items based on authenticated user's dynamic role matrix
  const filteredItems = menuItems.filter(item => hasAccess(item.matrixKey));

  const filteredDashboards = dashboardItems.filter(item =>
    hasAccess(item.matrixKey) && isDashboardEnabled(item.dashboardKey)
  );

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <Wrench className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">HBL MRB</h1>
            <p className="text-xs text-sidebar-foreground/70">Material Review Board</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 uppercase text-[0.7rem] tracking-widest font-semibold">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={cn(
                        'transition-colors',
                        isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
                      )}
                    >
                      <Link to={item.url}>
                        <item.icon className="h-[18px] w-[18px]" />
                        <span className="text-[0.9rem] font-medium tracking-wide">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {filteredDashboards.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60 uppercase text-[0.7rem] tracking-widest font-semibold">Role Dashboards</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredDashboards.map((item) => {
                  const isActive = location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        className={cn(
                          'transition-colors',
                          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
                        )}
                      >
                        <Link to={item.url}>
                          <item.icon className="h-[18px] w-[18px]" />
                          <span className="text-[0.9rem] font-medium tracking-wide">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleAdminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60 uppercase text-[0.7rem] tracking-widest font-semibold">Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAdminItems.map((item) => {
                  const isActive = location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        className={cn(
                          'transition-colors',
                          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
                        )}
                      >
                        <Link to={item.url}>
                          <item.icon className="h-[18px] w-[18px]" />
                          <span className="text-[0.9rem] font-medium tracking-wide">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4 space-y-3">
        <Link 
          to="/profile" 
          className="flex items-center gap-3 p-2 rounded-md hover:bg-sidebar-accent transition-colors"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-sm font-medium">
            {roleDisplayName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{roleDisplayName}</p>
            <p className="text-xs text-sidebar-foreground/60">View Profile</p>
          </div>
        </Link>
        <div className="flex items-center justify-between">
          <p className="text-xs text-sidebar-foreground/50"><p className="text-xs text-sidebar-foreground/50">© 2025 HBL Engineering Limited</p></p>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleLogout}
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
