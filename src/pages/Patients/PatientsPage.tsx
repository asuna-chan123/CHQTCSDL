import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Calendar,
  FileText,
  Clock,
  AlertCircle,
  Bed,
  LogOut,
  Loader2,
  X,
} from 'lucide-react';
import { useMedicalStore, NewPatientInput } from '@/context/MedicalStore';
import { Patient, PatientTimelineItem } from '@/types';
import { ageFromDob, localDateStr, normalizeText } from '@/lib/date';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

interface PatientsPageProps {
  onNavigate: (tab: string, extraId?: string) => void;
  selectedPatientId?: string;
}

type BadgeVariant = React.ComponentProps<typeof Badge>['variant'];

const statusBadge = (status: Patient['status']): BadgeVariant =>
  status === 'Nội trú' ? 'default' : status === 'Chờ khám' ? 'warning' : status === 'Đã xuất viện' ? 'outline' : 'secondary';

const TIMELINE_TYPE_LABEL: Record<string, string> = {
  appointment: 'Lịch khám',
  record: 'Bệnh án',
  referral: 'Chuyển tuyến',
  admission: 'Nhập / xuất viện',
  prescription: 'Đơn thuốc',
};

const timelineDot = (color?: string) =>
  color === 'destructive'
    ? 'bg-destructive'
    : color === 'warning'
    ? 'bg-amber-500'
    : color === 'teal' || color === 'blue' || color === 'info'
    ? 'bg-blue-600'
    : 'bg-primary';

const FALLBACK_DEPARTMENTS = ['Khoa Tim Mạch Can Thiệp', 'Khoa Nội Tiết & Đái Tháo Đường', 'Khoa Hô Hấp'];

// Số điện thoại VN: 9–11 chữ số (chấp nhận khoảng trắng, dấu chấm, +84)
const isValidPhone = (raw: string) => {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 11 && /^[+\d][\d\s.\-]*$/.test(raw.trim());
};

export const PatientsPage: React.FC<PatientsPageProps> = ({ onNavigate, selectedPatientId }) => {
  const {
    patients,
    departments,
    addPatient,
    admitPatient,
    dischargePatient,
    fetchPatientTimeline,
    refreshDepartments,
    isOracleConnected,
  } = useMedicalStore();
  const { success, error } = useToast();

  // ---------------- Tìm kiếm & bộ lọc ----------------
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('Tất cả');
  const [statusFilter, setStatusFilter] = useState('Tất cả');

  const departmentOptions = useMemo(() => {
    const names = new Set<string>();
    departments.forEach((d) => names.add(d.name));
    patients.forEach((p) => p.department && names.add(p.department));
    return ['Tất cả', ...Array.from(names)];
  }, [departments, patients]);

  // Bỏ dấu khi so khớp: gõ "pham quang minh" vẫn ra "Phạm Quang Minh"
  const filteredPatients = useMemo(() => {
    const q = normalizeText(searchQuery);
    return patients.filter((p) => {
      const matchQuery =
        !q ||
        normalizeText(p.full_name).includes(q) ||
        normalizeText(p.medical_code).includes(q) ||
        p.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
        normalizeText(p.insurance_id).includes(q);
      const matchDept = departmentFilter === 'Tất cả' || p.department === departmentFilter;
      const matchStatus = statusFilter === 'Tất cả' || p.status === statusFilter;
      return matchQuery && matchDept && matchStatus;
    });
  }, [patients, searchQuery, departmentFilter, statusFilter]);

  const hasActiveFilter = searchQuery.trim() !== '' || departmentFilter !== 'Tất cả' || statusFilter !== 'Tất cả';
  const clearFilters = () => {
    setSearchQuery('');
    setDepartmentFilter('Tất cả');
    setStatusFilter('Tất cả');
  };

  // ---------------- Bệnh nhân đang chọn ----------------
  const [selectedId, setSelectedId] = useState<string>(selectedPatientId || patients[0]?.id || '');

  // Khi được điều hướng từ nơi khác (ô tìm kiếm nhanh, Dashboard...) trong lúc trang đang mở
  useEffect(() => {
    if (selectedPatientId) setSelectedId(selectedPatientId);
  }, [selectedPatientId]);

  // Đang lọc/tìm kiếm mà bệnh nhân đang xem không nằm trong kết quả -> chuyển sang kết quả đầu tiên,
  // tránh để panel bên phải hiển thị một người không khớp với danh sách bên trái.
  useEffect(() => {
    if (hasActiveFilter && filteredPatients.length > 0 && !filteredPatients.some((p) => p.id === selectedId)) {
      setSelectedId(filteredPatients[0].id);
    }
  }, [hasActiveFilter, filteredPatients, selectedId]);

  const activePatient = patients.find((p) => p.id === selectedId) || patients[0] || null;

  // ---------------- Timeline ----------------
  const [remoteTimeline, setRemoteTimeline] = useState<{ patientId: string; items: PatientTimelineItem[] } | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<string>('all');

  const activeId = activePatient?.id;
  const activeStatus = activePatient?.status; // đổi khi nhập/xuất viện -> tải lại timeline

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setTimelineLoading(true);
    setTimelineError(null);
    setTimelineFilter('all');
    fetchPatientTimeline(activeId)
      .then((items) => {
        if (!cancelled) setRemoteTimeline(items ? { patientId: activeId, items } : null);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setRemoteTimeline(null);
          setTimelineError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, activeStatus, fetchPatientTimeline]);

  const usingOracleTimeline = !!activePatient && remoteTimeline?.patientId === activePatient.id;
  const timelineItems: PatientTimelineItem[] = activePatient
    ? usingOracleTimeline
      ? remoteTimeline!.items
      : activePatient.timeline || []
    : [];

  const timelineCounts = useMemo(() => {
    const c: Record<string, number> = {};
    timelineItems.forEach((i) => (c[i.type] = (c[i.type] || 0) + 1));
    return c;
  }, [timelineItems]);

  const visibleTimeline = timelineFilter === 'all' ? timelineItems : timelineItems.filter((i) => i.type === timelineFilter);

  // ---------------- Thêm bệnh nhân ----------------
  const defaultDepartment = departments[0]?.name || FALLBACK_DEPARTMENTS[0];
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newDob, setNewDob] = useState('');
  const [newGender, setNewGender] = useState<Patient['gender']>('Nam');
  const [newPhone, setNewPhone] = useState('');
  const [newInsurance, setNewInsurance] = useState('');
  const [newBloodType, setNewBloodType] = useState<Patient['blood_type']>('Chưa rõ');
  const [newAllergies, setNewAllergies] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Patient | null>(null);

  const departmentChoices = departments.length > 0 ? departments.map((d) => d.name) : FALLBACK_DEPARTMENTS;

  const resetForm = () => {
    setNewFullName('');
    setNewDob('');
    setNewGender('Nam');
    setNewPhone('');
    setNewInsurance('');
    setNewBloodType('Chưa rõ');
    setNewAllergies('');
    setNewAddress('');
    setNewDepartment('');
    setFormError(null);
    setDuplicate(null);
  };

  const createPatient = async () => {
    const input: NewPatientInput = {
      full_name: newFullName.trim().replace(/\s+/g, ' '),
      dob: newDob,
      gender: newGender,
      phone: newPhone.trim(),
      insurance_id: newInsurance.trim(),
      blood_type: newBloodType,
      allergies: newAllergies.trim()
        ? newAllergies.split(',').map((s) => s.trim()).filter(Boolean)
        : ['Không ghi nhận'],
      address: newAddress.trim(),
      department: newDepartment || defaultDepartment,
      status: 'Ngoại trú',
    };
    setIsSubmitting(true);
    try {
      const created = await addPatient(input);
      setSelectedId(created.id);
      setIsAddModalOpen(false);
      resetForm();
      success('Đăng ký hồ sơ thành công', `Đã cấp mã hồ sơ ${created.medical_code} cho bệnh nhân ${created.full_name}.`);
    } catch (err: any) {
      setFormError(err.message || 'Không thể đăng ký hồ sơ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePatient = (e: React.FormEvent, force = false) => {
    e.preventDefault();
    setFormError(null);

    if (!newFullName.trim()) return setFormError('Vui lòng nhập họ tên bệnh nhân.');
    if (!newDob) return setFormError('Vui lòng chọn ngày sinh.');
    if (newDob > localDateStr()) return setFormError('Ngày sinh không được ở tương lai.');
    if (!isValidPhone(newPhone)) return setFormError('Số điện thoại không hợp lệ (cần 9–11 chữ số).');

    // Hồ sơ trùng (cùng họ tên + ngày sinh) là lỗi nghiệp vụ rất hay gặp ở bệnh viện -> cảnh báo trước khi tạo
    if (!force) {
      const same = patients.find(
        (p) => normalizeText(p.full_name) === normalizeText(newFullName) && p.dob === newDob
      );
      if (same) {
        setDuplicate(same);
        return;
      }
    }
    setDuplicate(null);
    void createPatient();
  };

  // ---------------- Nhập viện / xuất viện ----------------
  const [isAdmitModalOpen, setIsAdmitModalOpen] = useState(false);
  const [admitDeptId, setAdmitDeptId] = useState<number | null>(null);
  const [isAdmitting, setIsAdmitting] = useState(false);
  const [isDischargeOpen, setIsDischargeOpen] = useState(false);
  const [isDischarging, setIsDischarging] = useState(false);

  const openAdmitModal = () => {
    if (!activePatient) return;
    void refreshDepartments(); // số giường trống hiển thị phải mới nhất
    const own = departments.find((d) => d.name === activePatient.department && d.available_beds > 0);
    const firstFree = departments.find((d) => d.available_beds > 0);
    setAdmitDeptId((own || firstFree || departments[0])?.id ?? null);
    setIsAdmitModalOpen(true);
  };

  const selectedAdmitDept = departments.find((d) => d.id === admitDeptId) || null;

  const handleAdmitPatient = async () => {
    if (!activePatient || admitDeptId === null) return;
    setIsAdmitting(true);
    try {
      const res = await admitPatient(activePatient.id, admitDeptId);
      if (res.success) {
        success('Tiếp nhận & cấp giường thành công', `${activePatient.full_name} đã được phân giường nội trú (mã nhập viện #${res.admission_id}).`);
        setIsAdmitModalOpen(false);
      } else {
        error('Không thể phân giường', res.error);
      }
    } catch (err: any) {
      error('Lỗi tiếp nhận bệnh nhân', err.message);
    } finally {
      setIsAdmitting(false);
    }
  };

  const handleDischargePatient = async () => {
    if (!activePatient) return;
    setIsDischarging(true);
    try {
      const res = await dischargePatient(activePatient.id);
      if (res.success) {
        success('Xuất viện thành công', `${activePatient.full_name} đã xuất viện, giường bệnh được trả về trạng thái trống.`);
        setIsDischargeOpen(false);
      } else {
        error('Không thể xuất viện', res.error);
      }
    } catch (err: any) {
      error('Lỗi xuất viện', err.message);
    } finally {
      setIsDischarging(false);
    }
  };

  const ageLabel = (p: Patient) => {
    const age = ageFromDob(p.dob);
    return age === null ? 'Chưa rõ ngày sinh' : `${age} tuổi (${p.dob})`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Quản Lý Bệnh Nhân & Lịch Sử Y Khoa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tra cứu theo mã hồ sơ (medical_code) hoặc họ tên; xem dòng thời gian lịch khám, bệnh án và chuyển tuyến.
          </p>
        </div>
        <Button
          onClick={() => {
            setIsAddModalOpen(true);
            setNewDepartment(defaultDepartment);
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shrink-0 font-medium"
        >
          <Plus className="h-4 w-4 mr-2" /> Thêm Bệnh Nhân Mới
        </Button>
      </div>

      {/* Toolbar */}
      <Card className="p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm theo mã hồ sơ (vd: BN-2024-001) hoặc họ tên — không cần gõ dấu"
              aria-label="Tìm bệnh nhân"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 text-base"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Xóa từ khóa"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            aria-label="Lọc theo khoa"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {departmentOptions.map((dept) => (
              <option key={dept} value={dept}>
                Khoa: {dept}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Lọc theo trạng thái"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="Tất cả">Trạng thái: Tất cả</option>
            <option value="Ngoại trú">Ngoại trú</option>
            <option value="Nội trú">Nội trú</option>
            <option value="Chờ khám">Chờ khám</option>
            <option value="Đã xuất viện">Đã xuất viện</option>
          </select>
        </div>
      </Card>

      {/* Danh sách + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Danh sách */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              {hasActiveFilter
                ? `Tìm thấy ${filteredPatients.length} / ${patients.length} bệnh nhân`
                : `${patients.length} bệnh nhân`}
            </span>
            {hasActiveFilter ? (
              <button type="button" onClick={clearFilters} className="text-primary font-semibold hover:underline">
                Xóa bộ lọc
              </button>
            ) : (
              <span>Chọn một bệnh nhân để xem dòng thời gian</span>
            )}
          </div>

          {filteredPatients.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <AlertCircle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="font-semibold text-base">Không tìm thấy bệnh nhân nào phù hợp</p>
              <p className="text-xs mt-1">Kiểm tra lại mã hồ sơ / họ tên hoặc bỏ bớt bộ lọc.</p>
              {hasActiveFilter && (
                <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              )}
            </Card>
          ) : (
            filteredPatients.map((patient) => {
              const isSelected = activePatient?.id === patient.id;
              return (
                <div
                  key={patient.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(patient.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(patient.id);
                    }
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                    isSelected
                      ? 'bg-card border-primary ring-2 ring-primary/20 shadow-md'
                      : 'bg-card border-border hover:border-primary/40 hover:bg-muted/30 shadow-sm'
                  }`}
                >
                  <div className="flex items-center flex-wrap gap-2.5">
                    <h3 className="font-bold text-base text-foreground">{patient.full_name}</h3>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs font-semibold">
                      {patient.medical_code}
                    </span>
                    <Badge variant={statusBadge(patient.status)} className="text-[11px]">
                      {patient.status}
                    </Badge>
                  </div>

                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {patient.gender} • <strong className="text-foreground">{ageLabel(patient)}</strong>
                    </span>
                    <span>
                      SĐT: <strong className="text-foreground">{patient.phone || '—'}</strong>
                    </span>
                    <span>
                      Khoa: <strong className="text-foreground">{patient.department}</strong>
                    </span>
                    <span>
                      BHYT: <strong className="font-mono text-foreground">{patient.insurance_id || 'Chưa có'}</strong>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Chi tiết + Timeline */}
        <div className="lg:col-span-5">
          {activePatient ? (
            <Card className="sticky top-20 shadow-md border-primary/30">
              <CardHeader className="border-b border-border pb-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
                    Hồ Sơ Y Khoa Chi Tiết
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Mã BN: <strong className="text-foreground">{activePatient.medical_code}</strong>
                  </span>
                </div>
                <CardTitle className="text-xl mt-1 text-foreground">{activePatient.full_name}</CardTitle>
                <CardDescription className="mt-1">
                  {activePatient.gender} • {ageLabel(activePatient)} •{' '}
                  <span className="text-blue-700 dark:text-blue-400 font-medium">{activePatient.department}</span>
                </CardDescription>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant={statusBadge(activePatient.status)} className="font-medium px-2 py-0.5">
                    {activePatient.status}
                  </Badge>
                  <div className="px-2.5 py-1 rounded-lg bg-card border border-border text-foreground">
                    Nhóm máu:{' '}
                    <span className={activePatient.blood_type === 'Chưa rõ' ? 'text-muted-foreground' : 'font-bold text-blue-600'}>
                      {activePatient.blood_type}
                    </span>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-card border border-border text-foreground">
                    Dị ứng: <span className="font-medium text-destructive">{activePatient.allergies.join(', ')}</span>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-card border border-border text-foreground">
                    BHYT: <span className="font-mono">{activePatient.insurance_id || 'Chưa có'}</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button size="sm" className="w-full text-xs" onClick={() => onNavigate('records', activePatient.id)}>
                    <FileText className="h-3.5 w-3.5 mr-1.5" /> Hồ Sơ Bệnh Án
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => onNavigate('appointments', activePatient.id)}
                  >
                    <Calendar className="h-3.5 w-3.5 mr-1.5" /> Đặt Lịch Khám
                  </Button>

                  {activePatient.status === 'Nội trú' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs font-semibold text-rose-700 dark:text-rose-400 border-rose-500/40 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={() => setIsDischargeOpen(true)}
                    >
                      <LogOut className="h-3.5 w-3.5 mr-1.5" /> Xuất Viện
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!isOracleConnected}
                      title={isOracleConnected ? undefined : 'Cần kết nối Oracle 23ai để phân giường'}
                      className="w-full text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      onClick={openAdmitModal}
                    >
                      <Bed className="h-3.5 w-3.5 mr-1.5" /> Nhập Viện
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-primary" /> Dòng thời gian y tế
                  </h4>
                  <span className="text-[10px] text-muted-foreground">
                    {timelineLoading ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Đang tải…
                      </span>
                    ) : usingOracleTimeline ? (
                      'Nguồn: Oracle 23ai'
                    ) : (
                      'Nguồn: dữ liệu cục bộ'
                    )}
                  </span>
                </div>

                {timelineError && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-2">
                    Không tải được timeline từ Oracle ({timelineError}). Đang hiển thị dữ liệu cục bộ.
                  </p>
                )}

                {/* Bộ lọc loại sự kiện */}
                {timelineItems.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {[
                      ['all', `Tất cả (${timelineItems.length})`],
                      ...(['appointment', 'record', 'referral', 'admission'] as const)
                        .filter((t) => timelineCounts[t])
                        .map((t) => [t, `${TIMELINE_TYPE_LABEL[t]} (${timelineCounts[t]})`]),
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTimelineFilter(key)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                          timelineFilter === key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="max-h-[55vh] overflow-y-auto pr-1">
                  {visibleTimeline.length > 0 ? (
                    <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                      {visibleTimeline.map((item, idx) => (
                        <div key={item.id || idx} className="relative">
                          <div
                            className={`absolute -left-6 top-1 h-4 w-4 rounded-full border-2 border-background shadow-sm ${timelineDot(item.badgeColor)}`}
                          />
                          <div className="p-3 rounded-lg border border-border/70 bg-card hover:bg-muted/40 transition-all">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                              <span className="font-mono font-medium">{item.date}</span>
                              <span className="text-xs font-semibold text-primary">
                                {TIMELINE_TYPE_LABEL[item.type] || item.type}
                              </span>
                            </div>
                            <h5 className="text-sm font-semibold text-foreground">{item.title}</h5>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
                            {(item.doctor || item.facility) && (
                              <p className="text-[11px] text-blue-700 dark:text-blue-400 font-medium mt-1.5">
                                {[item.doctor && `BS: ${item.doctor}`, item.facility && `Cơ sở: ${item.facility}`]
                                  .filter(Boolean)
                                  .join(' • ')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground py-6 text-center">
                      {timelineItems.length === 0
                        ? 'Bệnh nhân chưa có lịch khám, bệnh án hay phiếu chuyển tuyến nào.'
                        : 'Không có sự kiện thuộc loại này.'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="font-semibold text-sm">Chưa có bệnh nhân</p>
              <p className="text-xs mt-1">Nhấn “Thêm Bệnh Nhân Mới” để đăng ký hồ sơ đầu tiên.</p>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog: Thêm bệnh nhân */}
      <Dialog
        open={isAddModalOpen}
        onOpenChange={(open) => {
          if (isSubmitting) return;
          setIsAddModalOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Đăng Ký Hồ Sơ Bệnh Nhân Mới</DialogTitle>
            <DialogDescription>
              Mã hồ sơ (medical_code) sẽ được hệ thống tự cấp theo dạng BN-năm-số thứ tự, không cần nhập tay.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => handleCreatePatient(e)} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label required>Họ và Tên Bệnh Nhân</Label>
                <Input
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn Hoàng"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label required>Ngày Sinh</Label>
                <Input type="date" max={localDateStr()} value={newDob} onChange={(e) => setNewDob(e.target.value)} required />
              </div>

              <div>
                <Label required>Giới Tính</Label>
                <select
                  value={newGender}
                  onChange={(e) => setNewGender(e.target.value as Patient['gender'])}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>

              <div>
                <Label required>Số Điện Thoại</Label>
                <Input
                  type="tel"
                  placeholder="0912 345 678"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label>Mã Thẻ BHYT (nếu có)</Label>
                <Input
                  type="text"
                  placeholder="GD-4-01-01-xxxx"
                  value={newInsurance}
                  onChange={(e) => setNewInsurance(e.target.value)}
                />
              </div>

              <div>
                <Label>Nhóm Máu</Label>
                <select
                  value={newBloodType}
                  onChange={(e) => setNewBloodType(e.target.value as Patient['blood_type'])}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {(['Chưa rõ', 'O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'] as const).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Chuyên Khoa Tiếp Nhận</Label>
                <select
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {departmentChoices.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <Label>Tiền Sử Dị Ứng Thuốc / Thức Ăn</Label>
                <Input
                  type="text"
                  placeholder="Ví dụ: Penicillin, hải sản (để trống nếu chưa ghi nhận)"
                  value={newAllergies}
                  onChange={(e) => setNewAllergies(e.target.value)}
                />
              </div>

              <div className="col-span-2">
                <Label>Địa Chỉ Cư Trú</Label>
                <Input
                  type="text"
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh..."
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                />
              </div>
            </div>

            {duplicate && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
                <p className="font-semibold">Có thể trùng hồ sơ đã có</p>
                <p className="text-xs mt-1">
                  {duplicate.full_name} ({duplicate.medical_code}) cùng họ tên và ngày sinh. Nên mở hồ sơ cũ thay vì tạo mới.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedId(duplicate.id);
                      setIsAddModalOpen(false);
                      resetForm();
                    }}
                  >
                    Mở hồ sơ cũ
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={(e) => handleCreatePatient(e, true)}>
                    Vẫn tạo hồ sơ mới
                  </Button>
                </div>
              </div>
            )}

            {formError && (
              <p role="alert" className="text-sm text-destructive font-medium">
                {formError}
              </p>
            )}

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetForm();
                }}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-primary text-primary-foreground font-semibold">
                {isSubmitting ? 'Đang lưu…' : 'Xác Nhận Đăng Ký'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nhập viện & cấp giường */}
      <Dialog open={isAdmitModalOpen} onOpenChange={(open) => !isAdmitting && setIsAdmitModalOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Bed className="h-5 w-5" /> Tiếp Nhận & Phân Giường Nội Trú
            </DialogTitle>
            <DialogDescription>
              Hệ thống chọn tự động một giường trống của khoa. Nếu hai ca cùng vào một lúc, mỗi ca sẽ nhận một giường khác nhau
              (<code>FOR UPDATE SKIP LOCKED</code>), không bao giờ trùng giường.
            </DialogDescription>
          </DialogHeader>

          {activePatient && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg border border-border bg-muted/40 space-y-1 text-sm">
                <div>
                  Bệnh nhân: <strong className="text-foreground">{activePatient.full_name}</strong> ({activePatient.medical_code})
                </div>
                <div>
                  Trạng thái hiện tại: <Badge variant={statusBadge(activePatient.status)}>{activePatient.status}</Badge>
                </div>
              </div>

              <div>
                <Label required>Khoa điều trị nội trú</Label>
                {departments.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1.5">Chưa tải được danh sách khoa từ Oracle 23ai.</p>
                ) : (
                  <select
                    value={admitDeptId ?? ''}
                    onChange={(e) => setAdmitDeptId(Number(e.target.value))}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary mt-1.5"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id} disabled={d.available_beds === 0}>
                        {d.name} — còn {d.available_beds}/{d.total_beds} giường
                      </option>
                    ))}
                  </select>
                )}
                {selectedAdmitDept && selectedAdmitDept.available_beds === 0 && (
                  <p className="text-xs text-destructive mt-1.5">Khoa này đã hết giường trống.</p>
                )}
              </div>

              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setIsAdmitModalOpen(false)} disabled={isAdmitting}>
                  Hủy
                </Button>
                <Button
                  type="button"
                  onClick={handleAdmitPatient}
                  disabled={isAdmitting || !selectedAdmitDept || selectedAdmitDept.available_beds === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {isAdmitting ? 'Đang phân giường…' : 'Xác Nhận Phân Giường'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: xác nhận xuất viện */}
      <Dialog open={isDischargeOpen} onOpenChange={(open) => !isDischarging && setIsDischargeOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <LogOut className="h-5 w-5" /> Xác nhận xuất viện
            </DialogTitle>
            <DialogDescription>
              {activePatient?.full_name} ({activePatient?.medical_code}) sẽ được đóng lượt điều trị nội trú và giường bệnh sẽ
              được trả về trạng thái trống. Thao tác này được ghi vào nhật ký hệ thống.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setIsDischargeOpen(false)} disabled={isDischarging}>
              Hủy
            </Button>
            <Button
              type="button"
              onClick={handleDischargePatient}
              disabled={isDischarging}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {isDischarging ? 'Đang xử lý…' : 'Xác Nhận Xuất Viện'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
