import React, { useState } from 'react';
import {
  Search,
  Sun,
  Moon,
  Bell,
  Menu,
  Stethoscope,
  ShieldCheck,
  UserCheck,
  HeartPulse,
  LogOut,
  ChevronDown,
  Database,
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth, DEMO_USERS } from '@/context/AuthContext';
import { useMedicalStore } from '@/context/MedicalStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QuickSearchModal } from '@/components/common/QuickSearchModal';

interface HeaderProps {
  onToggleSidebar?: () => void;
  activeTab: string;
  onNavigate: (tab: string, extraId?: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  activeTab,
  onNavigate,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, loginAsDemo, logout } = useAuth();
  const { stats, isOracleConnected } = useMedicalStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'doctor':
        return <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'nurse':
        return <HeartPulse className="h-4 w-4 text-rose-500" />;
      case 'admin':
        return <ShieldCheck className="h-4 w-4 text-sky-600 dark:text-sky-400" />;
      default:
        return <UserCheck className="h-4 w-4 text-emerald-600" />;
    }
  };

  const getRoleBadgeVariant = (role?: string) => {
    switch (role) {
      case 'doctor':
        return 'blue' as const;
      case 'nurse':
        return 'warning' as const;
      case 'admin':
        return 'default' as const;
      default:
        return 'success' as const;
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-colors">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          {/* Left section: mobile toggle & active page breadcrumb */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onToggleSidebar}
              aria-label="Mở danh mục điều hướng"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm font-semibold text-primary">MediCore OS</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-sm font-medium text-foreground capitalize">
                {activeTab === 'dashboard' && 'Tổng quan hệ thống'}
                {activeTab === 'patients' && 'Quản lý bệnh nhân & Timeline'}
                {activeTab === 'appointments' && 'Lịch khám & Xử lý đồng thời'}
                {activeTab === 'records' && 'Hồ sơ bệnh án & JSON'}
                {activeTab === 'referrals' && 'Mạng lưới chuyển tuyến (Graph)'}
                {activeTab === 'ai-search' && 'Tìm kiếm y khoa AI (Top-K)'}
                {activeTab === 'admin' && 'Nhật ký hệ thống & Danh mục'}
                {activeTab === 'auth' && 'Cổng xác thực y tế'}
              </span>
            </div>
          </div>

          {/* Center / Quick Semantic Search */}
          <div className="flex-1 max-w-md mx-4">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex w-full items-center justify-between rounded-lg border border-input bg-muted/40 px-3.5 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/70 transition-all shadow-sm"
              title="Tìm kiếm hồ sơ bệnh nhân, phác đồ, triệu chứng (Ctrl + K)"
            >
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                <span>Tìm nhanh BN, triệu chứng, bệnh án...</span>
              </span>
              <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">Ctrl</span> K
              </kbd>
            </button>
          </div>

          {/* Right section: theme toggle, notifications, user demo switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Oracle 23ai DB Status Badge */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                isOracleConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
              }`}
              title={isOracleConnected ? 'Đã kết nối Oracle Database 23ai (freepdb1)' : 'Đang chạy Local Mode (Backend API chưa bật)'}
            >
              <Database className="h-3.5 w-3.5" />
              <span>Oracle 23ai</span>
              <span className={`inline-block w-2 h-2 rounded-full ${isOracleConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            </div>

            {/* Dark / Light Mode Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full"
              aria-label="Chuyển đổi chế độ Sáng / Tối"
              title={theme === 'dark' ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5 text-amber-400 transition-transform rotate-0 hover:rotate-45" />
              ) : (
                <Moon className="h-5 w-5 text-slate-700 transition-transform rotate-0 hover:-rotate-12" />
              )}
            </Button>

            {/* Notification Bell */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative rounded-full"
                aria-label="Thông báo hệ thống"
              >
                <Bell className="h-5 w-5" />
                {stats.pendingReferrals > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive"></span>
                  </span>
                )}
              </Button>

              {/* Notification dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-card p-4 shadow-xl z-50 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <h4 className="text-sm font-semibold">Thông báo trực ban</h4>
                    <span className="text-xs text-muted-foreground">Thời gian thực</span>
                  </div>
                  <div className="mt-3 space-y-2.5 text-xs">
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-foreground">
                      <p className="font-semibold text-amber-700 dark:text-amber-400">
                        Có {stats.pendingReferrals} ca chuyển viện chờ phê duyệt
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        Ca cấp cứu từ Hải Dương và Đa Tốn đang cần điều phối giường.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-foreground">
                      <p className="font-semibold text-blue-700 dark:text-blue-400">
                        Trực giường bệnh: {stats.availableBeds}/{stats.totalBeds} giường trống
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        Khoa Hồi sức tích cực hiện còn 2 giường áp lực âm.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Current User & Fast Role Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-border hover:bg-muted/60 transition-all text-left"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20 shrink-0">
                  {currentUser?.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getRoleIcon(currentUser?.role)
                  )}
                </div>
                <div className="hidden md:block text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold leading-tight line-clamp-1">
                      {currentUser?.name || 'Chưa đăng nhập'}
                    </span>
                    <Badge variant={getRoleBadgeVariant(currentUser?.role)} className="text-[10px] py-0 px-1.5">
                      {currentUser?.role === 'doctor' && 'Bác sĩ'}
                      {currentUser?.role === 'nurse' && 'Điều dưỡng'}
                      {currentUser?.role === 'admin' && 'Admin'}
                      {currentUser?.role === 'patient' && 'Bệnh nhân'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {currentUser?.roleTitle || 'Cổng thông tin'}
                  </p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />
              </button>

              {/* Role switcher dropdown */}
              {showRoleMenu && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border bg-card p-3 shadow-xl z-50 animate-in fade-in zoom-in-95">
                  <div className="pb-2 mb-2 border-b border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Chuyển đổi vai trò Demo
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Thử nghiệm các phân quyền khác nhau trong hệ thống
                    </p>
                  </div>
                  <div className="space-y-1">
                    {DEMO_USERS.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          loginAsDemo(user.id);
                          setShowRoleMenu(false);
                        }}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left text-xs transition-colors ${
                          currentUser?.id === user.id
                            ? 'bg-primary/10 text-primary font-semibold border border-primary/20'
                            : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <div className="h-7 w-7 rounded-full overflow-hidden shrink-0 border">
                          <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{user.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{user.roleTitle}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="pt-2 mt-2 border-t border-border">
                    <button
                      onClick={() => {
                        logout();
                        setShowRoleMenu(false);
                        onNavigate('auth');
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs text-destructive hover:bg-destructive/10 transition-colors font-medium"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Đăng xuất khỏi hệ thống
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Global Quick Search Modal */}
      <QuickSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={onNavigate}
      />
    </>
  );
};
