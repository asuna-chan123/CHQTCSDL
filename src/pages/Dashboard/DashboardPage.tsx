import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  Bed,
  Network,
  Users,
  Search,
  Sparkles,
  ArrowUpRight,
  Clock,
  Activity,
  Building,
  RefreshCw,
  User,
} from 'lucide-react';
import { useMedicalStore, AI_SYMPTOM_DATABASE } from '@/context/MedicalStore';
import { normalizeText } from '@/lib/date';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DashboardPageProps {
  onNavigate: (tab: string, extraId?: string) => void;
}

type BadgeVariant = React.ComponentProps<typeof Badge>['variant'];

const appointmentBadge = (status: string): BadgeVariant => {
  if (status === 'Đã xác nhận') return 'success';
  if (status === 'Đang chờ' || status === 'Đang khám') return 'warning';
  if (status === 'Đã khám') return 'secondary';
  return 'destructive'; // Đã hủy / Vắng mặt / Xung đột
};

// Màu thanh công suất theo mức lấp đầy: càng đầy càng cần chú ý
const loadTone = (pct: number) =>
  pct >= 90
    ? { bar: 'bg-rose-600', dot: 'bg-rose-600', label: 'Gần đầy' }
    : pct >= 70
    ? { bar: 'bg-amber-500', dot: 'bg-amber-500', label: 'Cao' }
    : { bar: 'bg-emerald-600', dot: 'bg-emerald-600', label: 'Ổn định' };

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { dashboard, patients, beds, refreshDashboard } = useMedicalStore();
  const [query, setQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshDashboard();
    setIsRefreshing(false);
  };

  // ---- Ô tìm kiếm nhanh: kết quả được suy ra trực tiếp từ câu truy vấn (không cần state riêng)
  const normalizedQuery = normalizeText(query);

  const patientMatches = useMemo(() => {
    if (!normalizedQuery) return [];
    return patients
      .filter(
        (p) =>
          normalizeText(p.full_name).includes(normalizedQuery) ||
          normalizeText(p.medical_code).includes(normalizedQuery)
      )
      .slice(0, 3);
  }, [patients, normalizedQuery]);

  // Gợi ý triệu chứng: chấm theo tỷ lệ từ khóa trùng, chỉ hiện kết quả thật sự liên quan
  // (bản cũ hiển thị 2 mục đầu tiên cố định kèm "độ khớp" giả khi không khớp gì).
  const symptomMatches = useMemo(() => {
    const tokens = normalizedQuery.split(/\s+/).filter((t) => t.length > 1);
    if (tokens.length === 0) return [];
    return AI_SYMPTOM_DATABASE.map((item) => {
      const text = normalizeText(`${item.title} ${item.content} ${item.category}`);
      const hit = tokens.filter((t) => text.includes(t)).length;
      return { item, score: hit / tokens.length };
    })
      .filter((x) => x.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((x) => x.item);
  }, [normalizedQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // Gõ đúng mã hồ sơ (BN-...) và chỉ có 1 kết quả -> mở thẳng hồ sơ + timeline
    if (/^bn-/i.test(q) && patientMatches.length === 1) {
      onNavigate('patients', patientMatches[0].id);
      return;
    }
    // Còn lại: chuyển sang trung tâm tìm kiếm ngữ nghĩa và tìm luôn với câu này
    onNavigate('ai-search', q);
  };

  const bedOccupancyRate =
    dashboard.total_beds > 0 ? Math.round((dashboard.occupied_beds / dashboard.total_beds) * 100) : 0;
  const hiddenTodayCount = Math.max(0, dashboard.today_appointments - dashboard.today_list.length);
  const BED_GRID_LIMIT = 15;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Search */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-900 via-blue-800 to-sky-700 p-6 md:p-8 text-white shadow-xl">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge className="bg-blue-400/20 text-blue-100 border border-blue-300/30 text-xs">
              Hệ Thống Y Tế Trợ Năng Cao • MediCore 2026
            </Badge>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                dashboard.source === 'oracle'
                  ? 'bg-emerald-400/15 border-emerald-300/40 text-emerald-100'
                  : 'bg-amber-400/15 border-amber-300/40 text-amber-100'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  dashboard.source === 'oracle' ? 'bg-emerald-300' : 'bg-amber-300'
                }`}
              />
              {dashboard.source === 'oracle'
                ? 'Số liệu từ Oracle 23ai • tự làm mới mỗi 30 giây'
                : 'Dữ liệu cục bộ (chưa kết nối Oracle 23ai)'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Trung Tâm Điều Phối & Giám Sát Y Tế
          </h1>
          <p className="mt-2 text-blue-100/90 text-sm sm:text-base leading-relaxed">
            Theo dõi lịch khám trong ngày, giường bệnh còn trống, các ca chuyển tuyến đang chờ xử lý và tìm hồ sơ
            hoặc triệu chứng bằng ngôn ngữ tự nhiên.
          </p>

          {/* Quick Search */}
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-blue-600" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm bệnh nhân (tên, mã BN-...) hoặc mô tả triệu chứng: 'đau thắt ngực', 'khó thở'..."
                aria-label="Tìm kiếm nhanh"
                className="w-full rounded-xl bg-white pl-11 pr-4 py-3 text-slate-800 placeholder:text-slate-400 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <Button
              type="submit"
              disabled={!query.trim()}
              className="bg-white text-blue-800 hover:bg-blue-50 shadow-md font-semibold h-12 px-6 rounded-xl shrink-0 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4 mr-2 text-blue-600" /> Tra Cứu Ngữ Nghĩa
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-blue-200">
            <span>Gợi ý:</span>
            {['đau ngực lan ra cánh tay', 'khó thở khò khè', 'BN-2024-001'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQuery(s)}
                className="px-2 py-0.5 rounded bg-blue-950/40 hover:bg-blue-950/60 border border-blue-400/30 text-blue-100 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Quick results */}
        {normalizedQuery && (
          <div className="mt-6 pt-5 border-t border-blue-700/50 space-y-4">
            {patientMatches.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-blue-300" /> Bệnh nhân khớp ({patientMatches.length})
                </h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  {patientMatches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onNavigate('patients', p.id)}
                      className="text-left p-3 rounded-xl bg-white/10 backdrop-blur border border-white/15 hover:bg-white/20 transition-all"
                    >
                      <p className="font-semibold text-sm">{p.full_name}</p>
                      <p className="text-[11px] font-mono text-blue-200 mt-0.5">{p.medical_code}</p>
                      <p className="text-[11px] text-blue-100/80 mt-1">{p.status} • Xem dòng thời gian &rarr;</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {symptomMatches.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-blue-300" /> Gợi ý triệu chứng liên quan
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {symptomMatches.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onNavigate('ai-search', query.trim())}
                      className="p-3.5 rounded-xl bg-white/10 backdrop-blur border border-white/15 hover:bg-white/20 cursor-pointer transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-sm">{item.title}</h4>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-blue-400/20 text-blue-100 shrink-0">
                          {item.recommended_specialty}
                        </span>
                      </div>
                      <p className="text-xs text-blue-100/80 mt-1 line-clamp-2">{item.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {patientMatches.length === 0 && symptomMatches.length === 0 && (
              <p className="text-sm text-blue-100/90">
                Không có gợi ý nhanh phù hợp. Nhấn <strong>Tra Cứu Ngữ Nghĩa</strong> để tìm trong toàn bộ cơ sở tri
                thức y khoa.
              </p>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('ai-search', query.trim())}
              className="text-blue-100 hover:text-white hover:bg-blue-700/40 text-xs h-7"
            >
              Mở trung tâm tìm kiếm ngữ nghĩa với “{query.trim()}” &rarr;
            </Button>
          </div>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Lịch khám trong ngày */}
        <Card className="hover:border-primary/40 transition-all shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lịch khám trong ngày</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 flex items-center justify-center">
              <CalendarDays className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {dashboard.today_appointments}{' '}
              <span className="text-sm font-normal text-muted-foreground">ca hẹn</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>
                {dashboard.upcoming_appointments > 0
                  ? `Còn ${dashboard.upcoming_appointments} lịch những ngày tới`
                  : 'Chưa có lịch những ngày tới'}
              </span>
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => onNavigate('appointments')}
              className="p-0 h-auto text-xs text-primary font-semibold mt-3"
            >
              Xem lịch & đặt hẹn &rarr;
            </Button>
          </CardContent>
        </Card>

        {/* Giường trống */}
        <Card className="hover:border-primary/40 transition-all shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Số giường bệnh trống</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Bed className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {dashboard.available_beds} / {dashboard.total_beds}{' '}
              {dashboard.total_beds > 0 && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  (Trống {100 - bedOccupancyRate}%)
                </span>
              )}
            </div>
            <div className="w-full bg-muted rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-2 rounded-full transition-all"
                style={{ width: `${dashboard.total_beds > 0 ? 100 - bedOccupancyRate : 0}%` }}
              />
            </div>
            <Button
              variant="link"
              size="sm"
              onClick={() => onNavigate('admin')}
              className="p-0 h-auto text-xs text-primary font-semibold mt-3"
            >
              Quản lý buồng giường &rarr;
            </Button>
          </CardContent>
        </Card>

        {/* Chuyển tuyến đang chờ */}
        <Card className="hover:border-primary/40 transition-all shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Chuyển tuyến đang chờ</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <Network className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {dashboard.pending_referrals}{' '}
              {dashboard.urgent_pending_referrals > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold align-middle">
                  {dashboard.urgent_pending_referrals} khẩn / cấp cứu
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Phiếu chuyển tuyến chờ duyệt</p>
            <Button
              variant="link"
              size="sm"
              onClick={() => onNavigate('referrals')}
              className="p-0 h-auto text-xs text-primary font-semibold mt-3"
            >
              Xem sơ đồ đồ thị tuyến &rarr;
            </Button>
          </CardContent>
        </Card>

        {/* Nội trú */}
        <Card className="hover:border-primary/40 transition-all shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bệnh nhân nội trú</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-400 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {dashboard.inpatients}{' '}
              <span className="text-sm font-normal text-muted-foreground">người bệnh</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Activity className="h-3.5 w-3.5 text-blue-600" />
              <span>Đang chiếm {dashboard.occupied_beds} giường</span>
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => onNavigate('patients')}
              className="p-0 h-auto text-xs text-primary font-semibold mt-3"
            >
              Danh sách bệnh nhân &rarr;
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Lịch hẹn hôm nay */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Lịch Hẹn Khám Hôm Nay</CardTitle>
                <CardDescription>
                  {dashboard.today_appointments > 0
                    ? `Hiển thị ${dashboard.today_list.length}/${dashboard.today_appointments} ca, sắp xếp theo giờ khám`
                    : 'Chưa có ca hẹn nào trong ngày hôm nay'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRefresh}
                  disabled={isRefreshing || dashboard.source !== 'oracle'}
                  title="Tải lại số liệu từ Oracle 23ai"
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => onNavigate('appointments')} className="text-xs">
                  Đặt Lịch Mới <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dashboard.today_list.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CalendarDays className="h-9 w-9 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm font-medium">Hôm nay chưa có lịch khám</p>
                  <p className="text-xs mt-1">Các ca hẹn được đặt sẽ hiện ở đây theo thời gian thực.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3">Giờ</th>
                        <th className="py-2.5 px-3">Mã BN</th>
                        <th className="py-2.5 px-3">Họ và Tên</th>
                        <th className="py-2.5 px-3">Khoa / Bác Sĩ</th>
                        <th className="py-2.5 px-3">Trạng Thái</th>
                        <th className="py-2.5 px-3 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {dashboard.today_list.map((apt) => (
                        <tr key={apt.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3 whitespace-nowrap text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                              {apt.time_label}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-medium text-xs text-primary">{apt.patient_code}</td>
                          <td className="py-3 px-3 font-medium text-foreground">{apt.patient_name}</td>
                          <td className="py-3 px-3">
                            <p className="text-xs font-medium text-foreground">{apt.department}</p>
                            <p className="text-[11px] text-muted-foreground">{apt.doctor_name}</p>
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant={appointmentBadge(apt.status)} className="text-[11px]">
                              {apt.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onNavigate('patients', apt.patient_id)}
                              className="text-xs text-primary hover:bg-primary/10 h-8"
                            >
                              Hồ sơ
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onNavigate('records', apt.patient_id)}
                              className="text-xs text-primary hover:bg-primary/10 h-8"
                            >
                              Bệnh án
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {hiddenTodayCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigate('appointments')}
                      className="mt-3 w-full text-center text-xs text-primary font-semibold hover:underline"
                    >
                      Còn {hiddenTodayCount} ca hẹn khác trong ngày &rarr;
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Công suất giường theo khoa (số liệu thật) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Công Suất Giường Theo Khoa</CardTitle>
              <CardDescription>Tỷ lệ giường đang có người nằm so với tổng số giường của từng khoa</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard.departments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Chưa có dữ liệu khoa / giường.</p>
              ) : (
                <div className="space-y-4">
                  {dashboard.departments.map((d) => {
                    const pct = d.total_beds > 0 ? Math.round((d.occupied_beds / d.total_beds) * 100) : 0;
                    const tone = loadTone(pct);
                    return (
                      <div key={d.department_id}>
                        <div className="flex flex-wrap justify-between gap-x-3 text-xs font-semibold mb-1">
                          <span className="flex items-center gap-1.5">
                            <span className={`h-2.5 w-2.5 rounded-full ${d.total_beds > 0 ? tone.dot : 'bg-muted-foreground/40'}`} />
                            {d.name}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {d.total_beds > 0
                              ? `${d.occupied_beds}/${d.total_beds} giường (${pct}% – ${tone.label})`
                              : 'Chưa có giường'}
                            {d.today_appointments > 0 && ` • ${d.today_appointments} ca hẹn hôm nay`}
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${tone.bar}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Chuyển tuyến đang chờ */}
          <Card className="border-amber-500/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-foreground">
                  <Network className="h-4 w-4 text-amber-600" /> Ca Chuyển Tuyến Đang Chờ
                </CardTitle>
                <Badge variant="warning" className="text-xs">
                  {dashboard.pending_referrals} hồ sơ
                </Badge>
              </div>
              <CardDescription>Ưu tiên cấp cứu / khẩn cấp lên đầu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.pending_referral_list.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Không có ca chuyển tuyến nào đang chờ.</p>
              ) : (
                dashboard.pending_referral_list.slice(0, 3).map((ref) => (
                  <div
                    key={ref.id}
                    onClick={() => onNavigate('referrals')}
                    className="p-3 rounded-xl border border-border/80 bg-muted/30 hover:bg-muted/60 cursor-pointer transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground">{ref.patient_name}</span>
                      <Badge variant={ref.priority === 'Cấp cứu' ? 'destructive' : 'warning'} className="text-[10px]">
                        {ref.priority}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Building className="h-3 w-3 text-primary shrink-0" />
                      <span>
                        {ref.from_facility} &rarr; {ref.to_facility}
                      </span>
                    </p>
                    <p className="text-xs text-foreground/80 line-clamp-1">{ref.reason}</p>
                  </div>
                ))
              )}
              <Button variant="outline" size="sm" onClick={() => onNavigate('referrals')} className="w-full text-xs">
                Mở Bản Đồ Mạng Lưới &rarr;
              </Button>
            </CardContent>
          </Card>

          {/* Trạng thái giường */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bed className="h-4 w-4 text-emerald-600" /> Trạng Thái Giường Bệnh
              </CardTitle>
              <CardDescription>Di chuột vào ô để xem khoa và bệnh nhân đang nằm</CardDescription>
            </CardHeader>
            <CardContent>
              {beds.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Chưa có dữ liệu giường.</p>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {beds.slice(0, BED_GRID_LIMIT).map((b) => (
                    <div
                      key={b.id}
                      title={`${b.bed_code} – ${b.department} (${b.is_occupied ? 'Đang nằm: ' + (b.patient_name || 'bệnh nhân') : 'Trống'})`}
                      className={`h-12 rounded-lg border flex flex-col items-center justify-center p-1 text-[11px] font-semibold ${
                        b.is_occupied
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      <span className="truncate max-w-full">{b.bed_code}</span>
                      <span className="text-[9px] font-normal tracking-wide">{b.is_occupied ? 'BẬN' : 'TRỐNG'}</span>
                    </div>
                  ))}
                </div>
              )}
              {beds.length > BED_GRID_LIMIT && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  và {beds.length - BED_GRID_LIMIT} giường khác — xem đầy đủ ở trang quản lý buồng giường.
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded bg-emerald-500" /> Giường trống ({dashboard.available_beds})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded bg-rose-500" /> Đang nằm ({dashboard.occupied_beds})
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
