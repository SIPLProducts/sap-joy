import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { RoleProvider } from "@/contexts/RoleContext";
import { MRBProvider } from "@/contexts/MRBContext";
import { InwardMRBProvider } from "@/contexts/InwardMRBContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MasterAdminGuard } from "@/components/auth/MasterAdminGuard";
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
import InwardMRBDetail from "@/pages/InwardMRBDetail";
import ShopFloorStockSelection from "@/pages/ShopFloorStockSelection";
import ShopFloorMaterialBlocking from "@/pages/ShopFloorMaterialBlocking";
import ShopFloorMRBDetail from "@/pages/ShopFloorMRBDetail";
import QualityHeadDashboard from "@/pages/QualityHeadDashboard";
import PurchaseHeadDashboard from "@/pages/PurchaseHeadDashboard";
import EngineeringHeadDashboard from "@/pages/EngineeringHeadDashboard";
import ExecutiveSummaryDashboard from "@/pages/ExecutiveSummaryDashboard";
import MRBAnalyticsDashboard from "@/pages/MRBAnalyticsDashboard";
import MRBPrint from "@/pages/MRBPrint";
import MRBCommitteeReview from "@/pages/MRBCommitteeReview";
import UserManagement from "@/pages/UserManagement";
import UserProfile from "@/pages/UserProfile";
import HelpSupport from "@/pages/HelpSupport";
import ProposalGenerator from "@/pages/ProposalGenerator";
import IMSRedirect from "@/pages/IMSRedirect";
import SAPApiSettings from "@/pages/SAPApiSettings";
import SAPSyncMonitor from "@/pages/SAPSyncMonitor";
import PlantManagement from "@/pages/PlantManagement";
import DepartmentManagement from "@/pages/DepartmentManagement";
import WorkflowRoutingConfig from "@/pages/WorkflowRoutingConfig";
import PendingActions from "@/pages/PendingActions";
import RoleMatrix from "@/pages/RoleMatrix";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();
const routerBasename = window.location.pathname.startsWith('/mrb') ? '/mrb' : undefined;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <RoleProvider>
          <MRBProvider>
            <InwardMRBProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter basename={routerBasename}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/ims-redirect" element={<IMSRedirect />} />
                  <Route path="/*" element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Routes>
                          <Route index element={<KPIDashboard />} />
                          <Route path="worklist" element={<Worklist />} />
                          <Route path="inward/worklist" element={<Worklist />} />
                          <Route path="mrb/:id" element={<MRBDetail />} />
                          <Route path="create/quality" element={<CreateMRBQuality />} />
                          <Route path="create/shop-floor" element={<CreateMRBShopFloor />} />
                          <Route path="emails" element={<EmailLog />} />
                          <Route path="inward/report" element={<InwardReport />} />
                          <Route path="inward/create-mrb" element={<CreateInwardMRB />} />
                          <Route path="inward/mrb/:id" element={<InwardMRBDetail />} />
                          <Route path="inward/mrb/:id/committee" element={<MRBCommitteeReview />} />
                          <Route path="shop-floor/stock-selection" element={<ShopFloorStockSelection />} />
                          <Route path="shop-floor/material-blocking" element={<ShopFloorMaterialBlocking />} />
                          <Route path="shop-floor/mrb/:id" element={<ShopFloorMRBDetail />} />
                          <Route path="dashboard/quality-head" element={<QualityHeadDashboard />} />
                          <Route path="dashboard/purchase-head" element={<PurchaseHeadDashboard />} />
                          <Route path="dashboard/engineering-head" element={<EngineeringHeadDashboard />} />
                          <Route path="dashboard/executive-summary" element={<ExecutiveSummaryDashboard />} />
                          <Route path="dashboard/analytics" element={<MRBAnalyticsDashboard />} />
                          <Route path="mrb-print" element={<MRBPrint />} />
                          <Route path="admin/users" element={<UserManagement />} />
                          <Route path="admin/plants" element={<PlantManagement />} />
                          <Route path="admin/departments" element={<DepartmentManagement />} />
                          <Route path="admin/matrix" element={<RoleMatrix />} />
                          <Route path="profile" element={<UserProfile />} />
                          <Route path="help" element={<HelpSupport />} />
                          <Route path="admin/sap-api" element={<MasterAdminGuard><SAPApiSettings /></MasterAdminGuard>} />
                          <Route path="admin/sap-sync" element={<MasterAdminGuard><SAPSyncMonitor /></MasterAdminGuard>} />
                          <Route path="proposals" element={<ProposalGenerator />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </AppLayout>
                    </ProtectedRoute>
                  } />
                </Routes>
              </BrowserRouter>
            </InwardMRBProvider>
          </MRBProvider>
        </RoleProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
