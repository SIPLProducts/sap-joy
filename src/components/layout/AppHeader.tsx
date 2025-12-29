import { Bell, User } from 'lucide-react';
import { useRole } from '@/contexts/RoleContext';
import { UserRole } from '@/types/mrb';
import { getRoleDisplayName } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';

const roles: UserRole[] = ['quality', 'purchase', 'engineering', 'plant_head', 'shop_floor'];

export function AppHeader() {
  const { currentRole, currentUser, setRole } = useRole();

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4">
      <SidebarTrigger className="-ml-2" />
      
      <div className="flex-1" />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Role:</span>
          <Select value={currentRole} onValueChange={(value: UserRole) => setRole(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role} value={role}>
                  {getRoleDisplayName(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs">3</Badge>
        </Button>

        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{currentUser.name}</span>
        </div>
      </div>
    </header>
  );
}
