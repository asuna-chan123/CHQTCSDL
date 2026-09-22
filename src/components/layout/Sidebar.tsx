import React from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileSpreadsheet,
  Network,
  Sparkles,
  ShieldAlert,
  LogIn,
  HeartPulse,
  X,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useMedicalStore } from '@/context/MedicalStore';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpen,
  onClose,
}) => {
  const { stats } = useMedicalStore();

  const navigationItems = [
    {
      id: 'dashboard',
      label: 'Tổng quan',
      sublabel: 'Dashboard chỉ số & giường',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'patients',
      label: 'Quản lý Bệnh nhân',
      sublabel: 'Hồ sơ mã BN & Timeline',
      icon: Users,
      badge: null,
    },
    {
      id: 'appointments',
      label: 'Quản lý Lịch khám',
      sublabel: 'Xử lý ngoại lệ đồng thời',
      icon: CalendarDays,
      badge: stats.todayAppointments > 0 ? `${stats.todayAppointments} hôm nay` : null,
      badgeVariant: 'blue' as const,
    },
    {
      id: 'records',
      label: 'Hồ sơ Bệnh án',
      sublabel: 'Editor lâm sàng & JSON',
      icon: FileSpreadsheet,
      badge: null,
    },
    {
      id: 'referrals',
      label: 'Mạng lưới Chuyển tuyến',
      sublabel: 'Truy vấn đồ thị & Sơ đồ',
      icon: Network,
      badge: stats.pendingReferrals > 0 ? `${stats.pendingReferrals} chờ` : null,
      badgeVariant: 'warning' as const,
    },
    {
      id: 'ai-search',
      label: 'Tìm kiếm Y khoa AI',
      sublabel: 'Triệu chứng & Phác đồ Top-K',
      icon: Sparkles,
      badge: 'AI Smart',
      badgeVariant: 'success' as const,
    },
    {
      id: 'admin',
      label: 'Quản trị & Nhật ký',
      sublabel: 'Audit Log & Danh mục',
      icon: ShieldAlert,
      badge: null,
    },
    {
      id: 'auth',
      label: 'Đăng nhập / Đăng ký',
      sublabel: 'Cổng phân quyền y tế',
      icon: LogIn,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card text-card-foreground transition-transform duration-300 ease-in-out lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
              <HeartPulse className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-foreground">MediCore</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300">
                  Health
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Hệ thống Y tế Thông minh</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Facility Info Card */}
        <div className="p-4 mx-3 mt-3 rounded-xl bg-muted/50 border border-border/80">
          <div className="flex items-center gap-2.5">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                Bệnh Viện Đa Khoa Trung Ương
              </p>
              <p className="text-[11px] text-muted-foreground">Tuyến 1 • Mã BV: 01001</p>
            </div>
          </div>
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">
            Phân hệ chức năng
          </p>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={cn(
                  'group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all text-left',
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/20'
                    : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0 transition-colors',
                      isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-primary'
                    )}
                  />
                  <div className="min-w-0">
                    <p className="truncate leading-tight">{item.label}</p>
                    <p
                      className={cn(
                        'text-[11px] truncate mt-0.5',
                        isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      )}
                    >
                      {item.sublabel}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.badge && (
                    <Badge
                      variant={isActive ? 'secondary' : item.badgeVariant || 'default'}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {item.badge}
                    </Badge>
                  )}
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100',
                      isActive && 'opacity-100'
                    )}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer info: Standardized UI note */}
        <div className="p-4 border-t border-border/80 bg-card">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Đồng bộ CSDL Y tế
            </span>
            <span className="font-mono">v1.0.4-ui</span>
          </div>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            Chuẩn WAI-ARIA • Text 16px • shadcn/ui
          </p>
        </div>
      </aside>
    </>
  );
};
