import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RoleProvider } from "@/contexts/RoleContext";
import { MRBProvider } from "@/contexts/MRBContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Worklist from "@/pages/Worklist";
import MRBDetail from "@/pages/MRBDetail";
import CreateMRBQuality from "@/pages/CreateMRBQuality";
import CreateMRBShopFloor from "@/pages/CreateMRBShopFloor";
import EmailLog from "@/pages/EmailLog";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <RoleProvider>
        <MRBProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/worklist" element={<Worklist />} />
                <Route path="/mrb/:id" element={<MRBDetail />} />
                <Route path="/create/quality" element={<CreateMRBQuality />} />
                <Route path="/create/shop-floor" element={<CreateMRBShopFloor />} />
                <Route path="/emails" element={<EmailLog />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </BrowserRouter>
        </MRBProvider>
      </RoleProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
