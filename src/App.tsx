import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RoleProvider } from "@/contexts/RoleContext";
import { MRBProvider } from "@/contexts/MRBContext";
import { InwardMRBProvider } from "@/contexts/InwardMRBContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import KPIDashboard from "@/pages/KPIDashboard";
import Worklist from "@/pages/Worklist";
import MRBDetail from "@/pages/MRBDetail";
import CreateMRBQuality from "@/pages/CreateMRBQuality";
import CreateMRBShopFloor from "@/pages/CreateMRBShopFloor";
import EmailLog from "@/pages/EmailLog";
import InwardReport from "@/pages/InwardReport";
import CreateInwardMRB from "@/pages/CreateInwardMRB";
import InwardWorklist from "@/pages/InwardWorklist";
import InwardMRBDetail from "@/pages/InwardMRBDetail";
import ShopFloorStockSelection from "@/pages/ShopFloorStockSelection";
import ShopFloorMaterialBlocking from "@/pages/ShopFloorMaterialBlocking";
import PlantHeadDashboard from "@/pages/PlantHeadDashboard";
import QualityHeadDashboard from "@/pages/QualityHeadDashboard";
import PurchaseHeadDashboard from "@/pages/PurchaseHeadDashboard";
import EngineeringHeadDashboard from "@/pages/EngineeringHeadDashboard";
import ExecutiveSummaryDashboard from "@/pages/ExecutiveSummaryDashboard";
import MRBPrint from "@/pages/MRBPrint";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <RoleProvider>
        <MRBProvider>
          <InwardMRBProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/*" element={
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<KPIDashboard />} />
                      <Route path="/worklist" element={<Worklist />} />
                      <Route path="/mrb/:id" element={<MRBDetail />} />
                      <Route path="/create/quality" element={<CreateMRBQuality />} />
                      <Route path="/create/shop-floor" element={<CreateMRBShopFloor />} />
                      <Route path="/emails" element={<EmailLog />} />
                      <Route path="/inward/report" element={<InwardReport />} />
                      <Route path="/inward/create-mrb" element={<CreateInwardMRB />} />
                      <Route path="/inward/worklist" element={<InwardWorklist />} />
                      <Route path="/inward/mrb/:id" element={<InwardMRBDetail />} />
                      <Route path="/shop-floor/stock-selection" element={<ShopFloorStockSelection />} />
                      <Route path="/shop-floor/material-blocking" element={<ShopFloorMaterialBlocking />} />
                      <Route path="/dashboard/plant-head" element={<PlantHeadDashboard />} />
                      <Route path="/dashboard/quality-head" element={<QualityHeadDashboard />} />
                      <Route path="/dashboard/purchase-head" element={<PurchaseHeadDashboard />} />
                      <Route path="/dashboard/engineering-head" element={<EngineeringHeadDashboard />} />
                      <Route path="/dashboard/executive-summary" element={<ExecutiveSummaryDashboard />} />
                      <Route path="/mrb-print" element={<MRBPrint />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                } />
              </Routes>
            </BrowserRouter>
          </InwardMRBProvider>
        </MRBProvider>
      </RoleProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
