import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./pages/Auth.tsx";
import PartsPage from "./pages/Parts.tsx";
import SuppliersPage from "./pages/Suppliers.tsx";
import SupplierDetailPage from "./pages/SupplierDetail.tsx";

import UploadPage from "./pages/Upload.tsx";

import InspectionsPage from "./pages/Inspections.tsx";
import NCRsPage from "./pages/NCRs.tsx";
import CAPAPage from "./pages/CAPA.tsx";
import CompliancePage from "./pages/Compliance.tsx";
import DocumentsPage from "./pages/Documents.tsx";

import AgentsPage from "./pages/Agents.tsx";
import AIAssistantPage from "./pages/AIAssistant.tsx";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/" element={<ProtectedRoute><AIAssistantPage /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/parts" element={<ProtectedRoute><PartsPage /></ProtectedRoute>} />
              <Route path="/suppliers" element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />
              <Route path="/suppliers/:id" element={<ProtectedRoute><SupplierDetailPage /></ProtectedRoute>} />
              <Route path="/upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
              <Route path="/inspections" element={<ProtectedRoute><InspectionsPage /></ProtectedRoute>} />
              <Route path="/ncrs" element={<ProtectedRoute><NCRsPage /></ProtectedRoute>} />
              <Route path="/capa" element={<ProtectedRoute><CAPAPage /></ProtectedRoute>} />
              <Route path="/compliance" element={<ProtectedRoute><CompliancePage /></ProtectedRoute>} />
              <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
              <Route path="/ai" element={<ProtectedRoute><AIAssistantPage /></ProtectedRoute>} />
              <Route path="/agents" element={<ProtectedRoute><AgentsPage /></ProtectedRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
