import { Home, ClipboardList, PlusCircle, Mail, Settings, Factory, Wrench } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { useRole } from '@/contexts/RoleContext';
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

const menuItems = [
  { title: 'Dashboard', url: '/', icon: Home, roles: ['quality', 'purchase', 'engineering', 'plant_head', 'shop_floor'] },
  { title: 'MRB Worklist', url: '/worklist', icon: ClipboardList, roles: ['quality', 'purchase', 'engineering', 'plant_head', 'shop_floor'] },
  { title: 'Create MRB (Quality)', url: '/create/quality', icon: PlusCircle, roles: ['quality'] },
  { title: 'Create MRB (Shop Floor)', url: '/create/shop-floor', icon: Factory, roles: ['shop_floor'] },
  { title: 'Email Log', url: '/emails', icon: Mail, roles: ['quality', 'purchase', 'engineering', 'plant_head'] },
];

export function AppSidebar() {
  const location = useLocation();
  const { currentRole } = useRole();

  const filteredItems = menuItems.filter(item => 
    item.roles.includes(currentRole)
  );

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
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <p className="text-xs text-sidebar-foreground/50">© 2024 HBL Power Systems</p>
      </SidebarFooter>
    </Sidebar>
  );
}
