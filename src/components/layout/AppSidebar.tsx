import { ClipboardList, Mail, Wrench, FileSpreadsheet, BarChart3, LogOut, Package, Building2, Users, Settings, PieChart, Printer, UserCog, TrendingUp, HelpCircle } from 'lucide-react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useRole } from '@/contexts/RoleContext';
import { useAuth, AppRole } from '@/contexts/AuthContext';
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

// Menu items with role-based access (using new AppRole types)
const menuItems = [
  { title: 'KPI Dashboard', url: '/', icon: BarChart3, roles: ['quality', 'quality_head', 'purchase', 'purchase_head', 'engineering', 'engineering_head', 'shop_floor', 'executive', 'admin', 'mrb_committee'] },
  { title: 'MRB Worklist', url: '/worklist', icon: ClipboardList, roles: ['quality', 'quality_head', 'purchase', 'purchase_head', 'engineering', 'engineering_head', 'shop_floor', 'executive', 'admin', 'mrb_committee'] },
  { title: 'Material Blocking', url: '/shop-floor/stock-selection', icon: Package, roles: ['shop_floor', 'admin'] },
  { title: 'MRB - Inward Materials', url: '/inward/report', icon: FileSpreadsheet, roles: ['quality', 'quality_head', 'purchase', 'purchase_head', 'engineering', 'engineering_head', 'executive', 'admin', 'mrb_committee'] },
  { title: 'MRB Print', url: '/mrb-print', icon: Printer, roles: ['quality', 'quality_head', 'purchase', 'purchase_head', 'engineering', 'engineering_head', 'shop_floor', 'executive', 'admin', 'mrb_committee'] },
  { title: 'Email Log', url: '/emails', icon: Mail, roles: ['quality', 'quality_head', 'purchase', 'purchase_head', 'engineering', 'engineering_head', 'executive', 'admin', 'mrb_committee'] },
  { title: 'Help & Support', url: '/help', icon: HelpCircle, roles: ['quality', 'quality_head', 'purchase', 'purchase_head', 'engineering', 'engineering_head', 'shop_floor', 'executive', 'admin', 'mrb_committee'] },
];

// Role-specific dashboards
const dashboardItems = [
  { title: 'MRB Analytics', url: '/dashboard/analytics', icon: TrendingUp, roles: ['quality', 'quality_head', 'purchase', 'purchase_head', 'engineering', 'engineering_head', 'executive', 'admin', 'mrb_committee'] },
  { title: 'Quality Dashboard', url: '/dashboard/quality-head', icon: Settings, roles: ['quality', 'quality_head', 'executive', 'admin', 'mrb_committee'] },
  { title: 'Purchase Dashboard', url: '/dashboard/purchase-head', icon: Users, roles: ['purchase', 'purchase_head', 'executive', 'admin', 'mrb_committee'] },
  { title: 'Engineering Dashboard', url: '/dashboard/engineering-head', icon: Wrench, roles: ['engineering', 'engineering_head', 'executive', 'admin', 'mrb_committee'] },
  { title: 'Executive Summary', url: '/dashboard/executive-summary', icon: PieChart, roles: ['executive', 'admin', 'mrb_committee'] },
];

// Admin items
const adminItems = [
  { title: 'User Management', url: '/admin/users', icon: UserCog, roles: ['admin'] },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { roleDisplayName } = useRole();
  const { signOut, userRole } = useAuth();

  // Filter items based on authenticated user's role
  const filteredItems = menuItems.filter(item => 
    userRole && item.roles.includes(userRole)
  );

  const filteredDashboards = dashboardItems.filter(item =>
    userRole && item.roles.includes(userRole)
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
          <SidebarGroupLabel className="text-sidebar-foreground/60">Navigation</SidebarGroupLabel>
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
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
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
            <SidebarGroupLabel className="text-sidebar-foreground/60">Role Dashboards</SidebarGroupLabel>
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
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {userRole === 'admin' && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60">Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => {
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
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
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
            <p className="text-sm font-medium text-sidebar-foreground truncate">{roleDisplayName}</p>
            <p className="text-xs text-sidebar-foreground/60">View Profile</p>
          </div>
        </Link>
        <div className="flex items-center justify-between">
          <p className="text-xs text-sidebar-foreground/50">© 2024 HBL Power Systems</p>
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
