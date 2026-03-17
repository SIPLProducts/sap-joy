import { SidebarTrigger } from '@/components/ui/sidebar';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-10 items-center border-b bg-background px-4">
      <SidebarTrigger className="-ml-2" />
    </header>
  );
}
