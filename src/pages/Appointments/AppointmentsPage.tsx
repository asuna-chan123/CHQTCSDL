import React, { useState } from 'react';
import {
  CalendarDays,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  ShieldAlert,
  RefreshCw,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';
import { useMedicalStore } from '@/context/MedicalStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

interface AppointmentsPageProps {
  onNavigate: (tab: string, extraId?: string) => void;
  preselectedPatientId?: string;
}

export const AppointmentsPage: React.FC<AppointmentsPageProps> = ({
  onNavigate,
  preselectedPatientId,
}) => {
  const {
    patients,
    appointments,
    timeSlots,
    addAppointment,
    cancelAppointment,
    toggleSlotConflictSimulation,
  } = useMedicalStore();
  const { success, error, warning } = useToast();

  const [selectedPatientId, setSelectedPatientId] = useState(
    preselectedPatientId || (patients[0]?.id ?? '')
  );
  const [selectedDoctor, setSelectedDoctor] = useState('BS. CKII Nguyễn Văn An');
  const [selectedDepartment, setSelectedDepartment] = useState('Khoa Tim Mạch Can Thiệp');
  const [selectedDate, setSelectedDate] = useState('2026-09-22');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [reason, setReason] = useState('Khám và tư vấn chuyên khoa');
  const [shakingSlot, setShakingSlot] = useState<string | null>(null);

  // Concurrency Conflict state banner
  const [conflictError, setConflictError] = useState<string | null>(null);

  const doctorsList = [
    { name: 'BS. CKII Nguyễn Văn An', dept: 'Khoa Tim Mạch Can Thiệp' },
    { name: 'BS. Lê Thị Bích Ngọc', dept: 'Khoa Nội Tiết & Đái Tháo Đường' },
    { name: 'BS. Trần Văn Hùng', dept: 'Khoa Tiêu Hóa' },
    { name: 'BS. Lê Mạnh Thắng', dept: 'Khoa Chấn Thương Chỉnh Hình' },
    { name: 'BS. CKI Đỗ Đình Dũng', dept: 'Khoa Hô Hấp' },
  ];

  const handleSlotSelect = (slotTime: string, isAvailable: boolean, isLocked?: boolean) => {
    setConflictError(null);
    if (isLocked) {
      const msg = `[409 CONFLICT - NGOẠI LỆ ĐỒNG THỜI]: Khung giờ ${slotTime} hiện đang bị tạm giữ bởi một yêu cầu đặt lịch khác tại Quầy tiếp đón 02. Hệ thống đã khóa phiên giao dịch để chống ghi đè dữ liệu (Double-Booking Prevention).`;
      setConflictError(msg);
      setShakingSlot(slotTime);
      window.setTimeout(() => setShakingSlot(null), 300);
      error('Xung đột đồng thời (Concurrency Lock)', msg, 'Chọn slot kế tiếp 10:00 - 10:30', () => {
        setSelectedSlot('10:00 - 10:30');
        setConflictError(null);
      });
      return;
    }

    if (!isAvailable) {
      warning('Khung giờ đã kín', `Khung giờ ${slotTime} đã có bệnh nhân khác đặt thành công.`);
      return;
    }

    setSelectedSlot(slotTime);
  };

  const handleBookAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      warning('Vui lòng chọn khung giờ', 'Hãy chọn một khung giờ khám còn trống ở bảng bên phải.');
      return;
    }

    const result = addAppointment(
      selectedPatientId,
      selectedDoctor,
      selectedDepartment,
      selectedDate,
      selectedSlot,
      reason
    );

    if (result.success) {
      success('Đặt lịch thành công!', `Đã xác nhận lịch hẹn vào lúc ${selectedSlot}, ngày ${selectedDate}`);
      setConflictError(null);
      setSelectedSlot('');
    } else {
      setConflictError(result.error || 'Đã xảy ra lỗi khi đặt lịch.');
      error('Lỗi ngoại lệ đặt lịch', result.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Concurrency Simulation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" /> Quản Lý Lịch Khám & Xử Lý Ngoại Lệ Đồng Thời
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Đặt lịch khám bệnh ngoại trú và mô phỏng cơ chế kiểm soát tranh chấp đồng thời (Optimistic/Pessimistic Concurrency Lock)
          </p>
        </div>

        {/* Demo trigger: Toggle slot conflict */}
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
          <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              Mô phỏng xung đột đồng thời:
            </p>
            <p className="text-muted-foreground">Khung giờ 09:00 - 09:30</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              toggleSlotConflictSimulation('09:00 - 09:30');
              success('Đã cập nhật trạng thái mô phỏng', 'Trạng thái khóa đồng thời của slot 09:00 - 09:30 đã thay đổi.');
            }}
            className="text-xs h-8 ml-2 border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Đổi Trạng Thái Khóa
          </Button>
        </div>
      </div>

      {/* Prominent Concurrency Error Alert Banner */}
      {conflictError && (
        <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-base text-destructive">
                Cảnh Báo Xử Lý Ngoại Lệ: Xung Đột Đặt Lịch Đồng Thời (HTTP 409 Conflict)
              </h4>
              <p className="text-sm mt-1 leading-relaxed text-destructive/90">{conflictError}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setSelectedSlot('10:00 - 10:30');
                    setConflictError(null);
                  }}
                  className="text-xs font-semibold"
                >
                  Chuyển Sang Khung Giờ Kế Tiếp (10:00 - 10:30)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConflictError(null)}
                  className="text-xs"
                >
                  Đóng Thông Báo
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Form Đặt Lịch (Trái) & Bảng Khung Giờ Slots (Phải) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Đặt Lịch (5 cols) */}
        <div className="lg:col-span-5">
          <Card className="shadow-sm border-border">
            <CardHeader className="border-b border-border/80 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-primary" /> Phiếu Đăng Ký Lịch Khám
              </CardTitle>
              <CardDescription>
                Điền thông tin và chọn khung giờ khám còn trống
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-5">
              <form onSubmit={handleBookAppointment} className="space-y-4">
                {/* Chọn bệnh nhân */}
                <div>
                  <Label required>Chọn Bệnh Nhân</Label>
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.medical_code} - {p.full_name} ({p.gender}, {p.dob})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chọn chuyên khoa */}
                <div>
                  <Label required>Chuyên Khoa Khám</Label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => {
                      setSelectedDepartment(e.target.value);
                      const matchedDoc = doctorsList.find((d) => d.dept === e.target.value);
                      if (matchedDoc) setSelectedDoctor(matchedDoc.name);
                    }}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Khoa Tim Mạch Can Thiệp">Khoa Tim Mạch Can Thiệp</option>
                    <option value="Khoa Hô Hấp">Khoa Hô Hấp</option>
                    <option value="Khoa Tiêu Hóa">Khoa Tiêu Hóa</option>
                    <option value="Khoa Nội Tiết & Đái Tháo Đường">Khoa Nội Tiết & Đái Tháo Đường</option>
                    <option value="Khoa Chấn Thương Chỉnh Hình">Khoa Chấn Thương Chỉnh Hình</option>
                  </select>
                </div>

                {/* Chọn bác sĩ */}
                <div>
                  <Label required>Bác Sĩ Phụ Trách</Label>
                  <select
                    value={selectedDoctor}
                    onChange={(e) => setSelectedDoctor(e.target.value)}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {doctorsList.map((doc) => (
                      <option key={doc.name} value={doc.name}>
                        {doc.name} ({doc.dept})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chọn ngày khám */}
                <div>
                  <Label required>Ngày Khám</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    required
                  />
                </div>

                {/* Khung giờ đã chọn */}
                <div>
                  <Label required>Khung Giờ Đã Chọn</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      readOnly
                      placeholder="Nhấp vào ô khung giờ bên phải..."
                      value={selectedSlot ? `${selectedSlot} (${selectedDate})` : ''}
                      className="font-medium bg-muted/30"
                    />
                    {selectedSlot && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    )}
                  </div>
                </div>

                {/* Lý do khám */}
                <div>
                  <Label>Lý Do Khám & Triệu Chứng Ban Đầu</Label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Mô tả lý do khám, triệu chứng cần hội chẩn..."
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-primary text-primary-foreground font-semibold text-base shadow-sm"
                >
                  Xác Nhận Đặt Lịch Khám
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Bảng Khung Giờ Slots & Giải thích Concurrency (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader className="border-b border-border/80 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Danh Sách Khung Giờ (Time Slots)</CardTitle>
                  <CardDescription>
                    Ngày tiếp đón: <strong className="text-foreground">{selectedDate}</strong>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded bg-emerald-500"></span> Trống
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded bg-rose-500"></span> Đã Đặt
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded bg-amber-500"></span> Bị Khóa
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-5">
              {/* Buổi Sáng */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Khung Giờ Buổi Sáng (08:00 - 11:30)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {timeSlots
                    .filter((s) => s.period === 'Sáng')
                    .map((slot) => {
                      const isSelected = selectedSlot === slot.time;
                      return (
                        <button
                          type="button"
                          key={slot.time}
                          onClick={() =>
                            handleSlotSelect(slot.time, slot.isAvailable, slot.isLockedByOther)
                          }
                          className={`p-3 rounded-xl border text-left transition-all duration-300 relative ${
                            slot.isLockedByOther
                              ? 'border-destructive/70 bg-destructive/10 shadow-sm shadow-destructive/10 hover:border-destructive hover:shadow-lg hover:shadow-destructive/20'
                              : isSelected
                              ? 'border-primary ring-2 ring-primary bg-primary/10 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10'
                              : slot.isAvailable
                              ? 'border-border bg-card hover:border-emerald-500/50 hover:bg-accent hover:shadow-lg hover:shadow-emerald-500/10'
                              : 'border-border/50 bg-muted/40 opacity-60 cursor-not-allowed'
                          } ${shakingSlot === slot.time ? 'animate-shake' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-semibold text-foreground">
                              {slot.time}
                            </span>
                            {slot.isLockedByOther ? (
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            ) : slot.isAvailable ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-[11px] mt-1 font-medium">
                            {slot.isLockedByOther ? (
                              <span className="text-destructive font-semibold">
                                Đang bị khóa (409)
                              </span>
                            ) : slot.isAvailable ? (
                              <span className="text-emerald-700 dark:text-emerald-400">
                                Khả dụng
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Đã kín lịch</span>
                            )}
                          </p>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Buổi Chiều */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Khung Giờ Buổi Chiều (13:30 - 16:00)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {timeSlots
                    .filter((s) => s.period === 'Chiều')
                    .map((slot) => {
                      const isSelected = selectedSlot === slot.time;
                      return (
                        <button
                          type="button"
                          key={slot.time}
                          onClick={() =>
                            handleSlotSelect(slot.time, slot.isAvailable, slot.isLockedByOther)
                          }
                          className={`p-3 rounded-xl border text-left transition-all duration-300 relative ${
                            slot.isLockedByOther
                              ? 'border-destructive/70 bg-destructive/10 shadow-sm shadow-destructive/10 hover:border-destructive hover:shadow-lg hover:shadow-destructive/20'
                              : isSelected
                              ? 'border-primary ring-2 ring-primary bg-primary/10 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10'
                              : slot.isAvailable
                              ? 'border-border bg-card hover:border-emerald-500/50 hover:bg-accent hover:shadow-lg hover:shadow-emerald-500/10'
                              : 'border-border/50 bg-muted/40 opacity-60 cursor-not-allowed'
                          } ${shakingSlot === slot.time ? 'animate-shake' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-semibold text-foreground">
                              {slot.time}
                            </span>
                            {slot.isLockedByOther ? (
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            ) : slot.isAvailable ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-[11px] mt-1 font-medium">
                            {slot.isLockedByOther ? (
                              <span className="text-destructive font-semibold">Đang bị khóa (409)</span>
                            ) : slot.isAvailable ? (
                              <span className="text-emerald-700 dark:text-emerald-400">Khả dụng</span>
                            ) : (
                              <span className="text-muted-foreground">Đã kín lịch</span>
                            )}
                          </p>
                        </button>
                      );
                    })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appointments list */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Lịch Khám Đã Đặt Trong Ngày</CardTitle>
              <CardDescription>Danh sách bệnh nhân đã được xác nhận giờ khám</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-3 rounded-lg border border-border flex items-center justify-between gap-3 text-sm hover:bg-muted/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{apt.patient_name}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                          {apt.patient_code}
                        </span>
                        <span className="text-xs font-mono font-medium text-muted-foreground">
                          {apt.slot}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {apt.department} • BS: {apt.doctor_name}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant={apt.status === 'Đã xác nhận' ? 'success' : 'destructive'}
                        className="text-[11px]"
                      >
                        {apt.status}
                      </Badge>
                      {apt.status !== 'Đã hủy' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelAppointment(apt.id)}
                          className="text-xs text-destructive hover:bg-destructive/10 h-8"
                        >
                          Hủy
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
