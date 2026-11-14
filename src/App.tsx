import React, { useState, useEffect } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { MedicalStoreProvider } from '@/context/MedicalStore';
import { ToastProvider } from '@/components/ui/toast';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

// Pages
import { DashboardPage } from '@/pages/Dashboard/DashboardPage';
import { PatientsPage } from '@/pages/Patients/PatientsPage';
import { AppointmentsPage } from '@/pages/Appointments/AppointmentsPage';
import { MedicalRecordPage } from '@/pages/MedicalRecord/MedicalRecordPage';
import { ReferralNetworkPage } from '@/pages/ReferralNetwork/ReferralNetworkPage';
import { AISearchPage } from '@/pages/AISearch/AISearchPage';
import { AdminAuditPage } from '@/pages/AdminAudit/AdminAuditPage';
import { AuthPage } from '@/pages/Auth/AuthPage';

// Hàm lấy tab từ URL hiện tại
function getTabFromUrl(): string {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '') || window.location.hash.replace(/^[#\/]+/, '');
  if (path === 'admin-audit' || path === 'audit' || path === 'admin') return 'admin';
  if (path === 'appointments' || path === 'lich-kham') return 'appointments';
  if (path === 'patients' || path === 'benh-nhan') return 'patients';
  if (path === 'records' || path === 'medical-records' || path === 'benh-an') return 'records';
  if (path === 'referrals' || path === 'chuyen-tuyen') return 'referrals';
  if (path === 'ai-search' || path === 'tim-kiem-ai') return 'ai-search';
  if (path === 'auth' || path === 'login') return 'auth';
  return 'dashboard';
}

function MedicalPortalApp() {
  const [activeTab, setActiveTab] = useState(getTabFromUrl);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [extraPatientId, setExtraPatientId] = useState<string | undefined>(undefined);

  // Đồng bộ activeTab với URL trên trình duyệt
  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (tab: string, extraId?: string) => {
    setActiveTab(tab);
    // Luôn ghi đè (kể cả undefined) để id/từ khóa của lần điều hướng trước không "dính" sang trang khác.
    // Với tab 'ai-search', extraId là câu truy vấn cần tìm.
    setExtraPatientId(extraId);
    // Cập nhật URL trên thanh địa chỉ trình duyệt
    const path = tab === 'admin' ? '/admin-audit' : `/${tab}`;
    window.history.pushState(null, '', path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground transition-colors duration-200">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          handleNavigate(tab);
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          activeTab={activeTab}
          onNavigate={handleNavigate}
        />

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-200">
          {activeTab === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}
          {activeTab === 'patients' && (
            <PatientsPage onNavigate={handleNavigate} selectedPatientId={extraPatientId} />
          )}
          {activeTab === 'appointments' && (
            <AppointmentsPage onNavigate={handleNavigate} preselectedPatientId={extraPatientId} />
          )}
          {activeTab === 'records' && (
            <MedicalRecordPage onNavigate={handleNavigate} selectedPatientId={extraPatientId} />
          )}
          {activeTab === 'referrals' && <ReferralNetworkPage onNavigate={handleNavigate} />}
          {activeTab === 'ai-search' && <AISearchPage onNavigate={handleNavigate} initialQuery={extraPatientId} />}
          {activeTab === 'admin' && <AdminAuditPage onNavigate={handleNavigate} />}
          {activeTab === 'auth' && <AuthPage onNavigate={handleNavigate} />}
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <MedicalStoreProvider>
            <MedicalPortalApp />
          </MedicalStoreProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
