import { ReactNode, createContext, useContext } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { useAutoSyncScheduler } from '@/hooks/useAutoSyncScheduler';

type AutoSyncContextType = ReturnType<typeof useAutoSyncScheduler>;
const AutoSyncContext = createContext<AutoSyncContextType | null>(null);

export function useAutoSyncContext() {
  return useContext(AutoSyncContext);
}

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const autoSync = useAutoSyncScheduler();

  return (
    <AutoSyncContext.Provider value={autoSync}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full overflow-hidden">
          <AppSidebar />
          <div className="flex flex-1 flex-col min-w-0">
            <AppHeader />
            <main className="flex-1 overflow-y-auto p-3 md:p-6">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AutoSyncContext.Provider>
  );
}
