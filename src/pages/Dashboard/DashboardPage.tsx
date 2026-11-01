import React, { useState } from 'react';
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
  UserCheck,
  Building,
  CheckCircle,
} from 'lucide-react';
import { useMedicalStore, AI_SYMPTOM_DATABASE } from '@/context/MedicalStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface DashboardPageProps {
  onNavigate: (tab: string, extraId?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { stats, appointments, patients, beds, referrals } = useMedicalStore();
  const [semanticSearch, setSemanticSearch] = useState('');
  const [semanticResults, setSemanticResults] = useState<typeof AI_SYMPTOM_DATABASE>([]);

  const handleSemanticSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!semanticSearch.trim()) {
      setSemanticResults([]);
      return;
    }
    const q = semanticSearch.toLowerCase();
    const matches = AI_SYMPTOM_DATABASE.filter(
      (item) => item.title.toLowerCase().includes(q) || item.content.toLowerCase().includes(q)
    );
    setSemanticResults(matches.length > 0 ? matches : AI_SYMPTOM_DATABASE.slice(0, 2));
  };

  const occupiedBedsCount = beds.filter((b) => b.is_occupied).length;
  const bedOccupancyRate = Math.round((occupiedBedsCount / beds.length) * 100);

  return (
    <div className="space-y-6">
      {/* Top Banner & Semantic Search Quick Bar */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-900 via-blue-800 to-sky-700 p-6 md:p-8 text-white shadow-xl">
        <div className="max-w-3xl">
          <Badge className="bg-blue-400/20 text-blue-100 border border-blue-300/30 text-xs mb-2">
            Hệ Thống Y Tế Trợ Năng Cao • MediCore 2026
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Trung Tâm Điều Phối & Giám Sát Y Tế
          </h1>
          <p className="mt-2 text-blue-100/90 text-sm sm:text-base leading-relaxed">
            Theo dõi thời gian thực lịch khám bệnh, công suất giường bệnh tại các khoa, điều phối các ca chuyển viện khẩn cấp và tìm kiếm hồ sơ y khoa bằng ngôn ngữ tự nhiên.
          </p>

          {/* Quick Semantic Search Input */}
          <form onSubmit={handleSemanticSearch} className="mt-5 flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-blue-600" />
              <input
                type="text"
                value={semanticSearch}
                onChange={(e) => setSemanticSearch(e.target.value)}
                placeholder="Tìm kiếm ngữ nghĩa: 'đau thắt ngực', 'huyết áp cao', 'COPD', 'mã BN-2024-001'..."
                className="w-full rounded-xl bg-white pl-11 pr-4 py-3 text-slate-800 placeholder:text-slate-400 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <Button
              type="submit"
              className="bg-white text-blue-800 hover:bg-blue-50 shadow-md font-semibold h-12 px-6 rounded-xl shrink-0"
            >
              <Sparkles className="h-4 w-4 mr-2 text-blue-600" /> Tra Cứu Ngữ Nghĩa
            </Button>
          </form>

          {/* Suggested queries */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-blue-200">
            <span>Gợi ý tra cứu:</span>
            <button
              onClick={() => {
                setSemanticSearch('đau ngực lan ra cánh tay');
                setSemanticResults(AI_SYMPTOM_DATABASE.slice(0, 2));
              }}
              className="px-2 py-0.5 rounded bg-blue-950/40 hover:bg-blue-950/60 border border-blue-400/30 text-blue-100 transition-colors"
            >
              Đau ngực lan tay trái
            </button>
            <button
              onClick={() => {
                setSemanticSearch('suy hô hấp thở khò khè');
                setSemanticResults([AI_SYMPTOM_DATABASE[1]]);
              }}
              className="px-2 py-0.5 rounded bg-blue-950/40 hover:bg-blue-950/60 border border-blue-400/30 text-blue-100 transition-colors"
            >
              Khó thở khò khè đợt cấp COPD
            </button>
          </div>
        </div>

        {/* Semantic Search Quick Results Inline */}
        {semanticResults.length > 0 && (
          <div className="mt-6 pt-5 border-t border-blue-700/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-300" /> Kết quả gợi ý ngữ nghĩa nhanh ({semanticResults.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('ai-search')}
                className="text-blue-100 hover:text-white hover:bg-blue-700/40 text-xs h-7"
              >
                Mở trung tâm AI Search &rarr;
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {semanticResults.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onNavigate('ai-search')}
                  className="p-3.5 rounded-xl bg-white/10 backdrop-blur border border-white/15 hover:bg-white/20 cursor-pointer transition-all text-white"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm">{item.title}</h4>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-400/20 text-blue-200 shrink-0">
                      Độ khớp {item.similarity_score}%
                    </span>
                  </div>
                  <p className="text-xs text-blue-100/80 mt-1 line-clamp-2">{item.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Lịch khám trong ngày */}
        <Card className="hover:border-primary/40 transition-all shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lịch khám trong ngày
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 flex items-center justify-center">
              <CalendarDays className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {stats.todayAppointments} <span className="text-sm font-normal text-muted-foreground">ca hẹn</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>Tiếp nhận từ 08:00 đến 16:30</span>
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

        {/* Stat 2: Giường bệnh còn trống */}
        <Card className="hover:border-primary/40 transition-all shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Số giường bệnh trống
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Bed className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {stats.availableBeds} / {stats.totalBeds}{' '}
              <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400 font-medium">
                (Trống {100 - bedOccupancyRate}%)
              </span>
            </div>
            {/* Occupancy bar */}
            <div className="w-full bg-muted rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-2 rounded-full transition-all"
                style={{ width: `${100 - bedOccupancyRate}%` }}
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

        {/* Stat 3: Chuyển tuyến chờ duyệt */}
        <Card className="hover:border-primary/40 transition-all shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Chuyển tuyến chờ xử lý
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <Network className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {stats.pendingReferrals}{' '}
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold">
                Khẩn cấp
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Liên kết tuyến Huyện - Tỉnh - TW
            </p>
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

        {/* Stat 4: Bệnh nhân điều trị nội trú */}
        <Card className="hover:border-primary/40 transition-all shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bệnh nhân nội trú
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-400 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {stats.totalInpatients} <span className="text-sm font-normal text-muted-foreground">người bệnh</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Activity className="h-3.5 w-3.5 text-blue-600" />
              <span>Chăm sóc tích cực & can thiệp</span>
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

      {/* Main Content Split: Bed Distribution & Recent Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Appointments & Admission overview */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Tiếp Nhận Khám & Lịch Hẹn Hôm Nay</CardTitle>
                <CardDescription>
                  Theo dõi danh sách bệnh nhân đang chờ khám tại các phòng chức năng
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onNavigate('appointments')}
                className="text-xs"
              >
                Đặt Lịch Mới <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3">Mã BN</th>
                      <th className="py-2.5 px-3">Họ và Tên</th>
                      <th className="py-2.5 px-3">Khung Giờ</th>
                      <th className="py-2.5 px-3">Khoa / Bác Sĩ</th>
                      <th className="py-2.5 px-3">Trạng Thái</th>
                      <th className="py-2.5 px-3 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {appointments.slice(0, 4).map((apt) => (
                      <tr key={apt.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3 font-mono font-medium text-xs text-primary">
                          {apt.patient_code}
                        </td>
                        <td className="py-3 px-3 font-medium text-foreground">
                          {apt.patient_name}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span>{apt.slot}</span>
                        </td>
                        <td className="py-3 px-3">
                          <p className="text-xs font-medium text-foreground">{apt.department}</p>
                          <p className="text-[11px] text-muted-foreground">{apt.doctor_name}</p>
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant={
                              apt.status === 'Đã xác nhận'
                                ? 'success'
                                : apt.status === 'Đang chờ'
                                ? 'warning'
                                : 'destructive'
                            }
                            className="text-[11px]"
                          >
                            {apt.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onNavigate('records', apt.patient_id)}
                            className="text-xs text-primary hover:bg-primary/10 h-8"
                          >
                            Mở Bệnh Án
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Quick Department Load Bar Graph Demo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Phân Bổ Tải Khám Theo Chuyên Khoa</CardTitle>
              <CardDescription>
                Tỷ lệ tiếp nhận bệnh nhân ngoại trú và can thiệp chuyên sâu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-600"></span> Khoa Tim Mạch Can Thiệp
                    </span>
                    <span className="font-mono">85% công suất (34/40 ca)</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: '85%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-sky-600"></span> Khoa Hô Hấp
                    </span>
                    <span className="font-mono">70% công suất (28/40 ca)</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-sky-600 rounded-full" style={{ width: '70%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-600"></span> Khoa Nội Tiết & Đái Tháo Đường
                    </span>
                    <span className="font-mono">55% công suất (22/40 ca)</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: '55%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-600"></span> Khoa Cấp Cứu A9
                    </span>
                    <span className="font-mono">92% công suất (37/40 ca - Lưu ý)</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-amber-600 rounded-full" style={{ width: '92%' }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Urgent Referrals & Quick Bed State */}
        <div className="space-y-6">
          {/* Urgent Referrals Widget */}
          <Card className="border-amber-500/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-foreground">
                  <Network className="h-4 w-4 text-amber-600" /> Ca Chuyển Tuyến Cần Lưu Tâm
                </CardTitle>
                <Badge variant="warning" className="text-xs">
                  {referrals.length} hồ sơ
                </Badge>
              </div>
              <CardDescription>Liên kết tuyến cơ sở đến tuyến Trung ương</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {referrals.slice(0, 3).map((ref) => (
                <div
                  key={ref.id}
                  onClick={() => onNavigate('referrals')}
                  className="p-3 rounded-xl border border-border/80 bg-muted/30 hover:bg-muted/60 cursor-pointer transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{ref.patient_name}</span>
                    <Badge
                      variant={ref.priority === 'Cấp cứu' ? 'destructive' : 'warning'}
                      className="text-[10px]"
                    >
                      {ref.priority}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Building className="h-3 w-3 text-primary" />
                    <span>{ref.from_facility} &rarr; {ref.to_facility}</span>
                  </p>
                  <p className="text-xs text-foreground/80 line-clamp-1">{ref.reason}</p>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('referrals')}
                className="w-full text-xs"
              >
                Mở Bản Đồ Mạng Lưới &rarr;
              </Button>
            </CardContent>
          </Card>

          {/* Quick Bed Status Widget */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bed className="h-4 w-4 text-emerald-600" /> Trực Quan Hóa Buồng Bệnh
              </CardTitle>
              <CardDescription>
                Nhấp vào ô để thay đổi trạng thái giường Trống / Bận
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {beds.slice(0, 10).map((b) => (
                  <div
                    key={b.id}
                    title={`${b.bed_code} - ${b.department} (${b.is_occupied ? 'Đang nằm: ' + b.patient_name : 'Trống'})`}
                    className={`h-12 rounded-lg border flex flex-col items-center justify-center p-1 text-[11px] font-semibold transition-all ${
                      b.is_occupied
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    <span>{b.bed_code}</span>
                    <span className="text-[9px] font-normal font-mono">
                      {b.is_occupied ? 'BẬN' : 'TRỐNG'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded bg-emerald-500"></span> Giường Trống ({stats.availableBeds})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded bg-rose-500"></span> Đang Nằm ({occupiedBedsCount})
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
