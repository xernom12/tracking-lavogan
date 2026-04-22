import { Suspense, lazy, type ReactNode } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubmissionProvider } from "@/contexts/SubmissionContext";
import { useAuth } from "@/contexts/useAuth";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminKelola = lazy(() => import("./pages/AdminKelola"));

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
};

const AppRouteFallback = () => (
  <div className="min-h-screen bg-background px-4 py-12 sm:px-6">
    <div className="mx-auto max-w-6xl animate-pulse space-y-4">
      <div className="h-12 w-56 rounded-2xl bg-slate-200/80" />
      <div className="h-32 rounded-[2rem] bg-slate-200/70" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-64 rounded-[2rem] bg-slate-200/70" />
        <div className="h-64 rounded-[2rem] bg-slate-200/70" />
      </div>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <SubmissionProvider>
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={<AppRouteFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
                <Route path="/admin/kelola/:id" element={<ProtectedRoute><AdminKelola /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </SubmissionProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
