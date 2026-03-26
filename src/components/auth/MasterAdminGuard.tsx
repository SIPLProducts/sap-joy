import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Shield } from 'lucide-react';

const MASTER_ADMIN_EMAIL = 'masteradmin@sharviinfotech.com';

interface MasterAdminGuardProps {
  children: ReactNode;
}

export function MasterAdminGuard({ children }: MasterAdminGuardProps) {
  const { profile } = useAuth();

  if (profile?.email !== MASTER_ADMIN_EMAIL) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Shield className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Restricted</h2>
            <p className="text-muted-foreground text-center">
              This page is restricted to the Master Administrator only.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
