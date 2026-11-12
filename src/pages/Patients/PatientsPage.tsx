import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Calendar,
  FileText,
  Share2,
  Clock,
  Phone,
  Shield,
  Heart,
  AlertCircle,
  Filter,
  ArrowRight,
  Activity,
  Bed,
  CheckCircle2,
  LogOut,
} from 'lucide-react';
import { useMedicalStore } from '@/context/MedicalStore';
import { Patient } from '@/types';
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

export const PatientsPage: React.FC<PatientsPageProps> = ({
  onNavigate,
  selectedPatientId,
}) => {
  const { patients, addPatient, admitPatient, dischargePatient } = useMedicalStore();
  const { success, error } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('Tất cả');
  const [statusFilter, setStatusFilter] = useState('Tất cả');

  // Selected patient for Timeline view
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (selectedPatientId) return selectedPatientId;
    return patients[0]?.id || '';
  });

  const activePatient = patients.find((p) => p.id === selectedId) || patients[0] || null;

  // Modal new patient
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newDob, setNewDob] = useState('1980-01-01');
  const [newGender, setNewGender] = useState<'Nam' | 'Nữ' | 'Khác'>('Nam');
  const [newPhone, setNewPhone] = useState('');
  const [newInsurance, setNewInsurance] = useState('');
  const [newBloodType, setNewBloodType] = useState<Patient['blood_type']>('O+');
  const [newAllergies, setNewAllergies] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newDepartment, setNewDepartment] = useState('Khoa Tim Mạch Can Thiệp');
  const [newStatus, setNewStatus] = useState<Patient['status']>('Chờ khám');

  // Modal Phân giường nội trú (Oracle PKG_HOSPITAL_OPS.ADMIT_PATIENT)
  const [isAdmitModalOpen, setIsAdmitModalOpen] = useState(false);
  const [admitDeptId, setAdmitDeptId] = useState<number>(1);
  const [isAdmitting, setIsAdmitting] = useState(false);
  const [isDischarging, setIsDischarging] = useState(false);

  const handleAdmitPatient = async () => {
    if (!activePatient) return;
    setIsAdmitting(true);
    try {
      const res = await admitPatient(activePatient.id, admitDeptId);
      if (res.success) {
        success(
          'Tiếp nhận & Cấp giường thành công!',
          `Bệnh nhân ${activePatient.full_name} đã được phân giường nội trú tự động (Mã nhập viện #${res.admission_id}).`
        );
        setIsAdmitModalOpen(false);
      } else {
        error(
          'Không thể phân giường (Xung đột đồng thời / Đã có giường)',
          res.error || 'Bệnh nhân đã có giường hoặc khoa này đã hết giường trống.'
        );
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
        success(
          'Xuất viện thành công!',
          `Bệnh nhân ${activePatient.full_name} đã hoàn tất xuất viện, giường bệnh đã được giải phóng sang trạng thái Khả dụng (AVAILABLE).`
        );
      } else {
        error('Không thể xuất viện', res.error || 'Có lỗi khi làm thủ tục xuất viện.');
      }
    } catch (err: any) {
      error('Lỗi xuất viện', err.message);
    } finally {
      setIsDischarging(false);
    }
  };

  // Filter logic
  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      p.full_name.toLowerCase().includes(q) ||
      p.medical_code.toLowerCase().includes(q) ||
      p.phone.includes(q) ||
      p.insurance_id.toLowerCase().includes(q);

    const matchDept = departmentFilter === 'Tất cả' || p.department === departmentFilter;
    const matchStatus = statusFilter === 'Tất cả' || p.status === statusFilter;

    return matchQuery && matchDept && matchStatus;
  });

  const handleCreatePatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim()) return;

    const nextCode = `BN-2024-${String(patients.length + 1).padStart(3, '0')}`;
    const created = addPatient({
      medical_code: nextCode,
      full_name: newFullName,
      dob: newDob,
      gender: newGender,
      phone: newPhone || '0900 000 000',
      insurance_id: newInsurance || 'BHYT-CHUA-CAP',
      blood_type: newBloodType,
      allergies: newAllergies ? newAllergies.split(',').map((s) => s.trim()) : ['Không ghi nhận'],
      address: newAddress || 'Hà Nội',
      department: newDepartment,
      status: newStatus,
    });

    setSelectedId(created.id);
    setIsAddModalOpen(false);
    success('Đăng ký hồ sơ thành công', `Đã cấp mã hồ sơ: ${created.medical_code} cho bệnh nhân ${created.full_name}`);

    // Reset form
    setNewFullName('');
    setNewPhone('');
    setNewInsurance('');
    setNewAllergies('');
    setNewAddress('');
  };

  const departments = [
    'Tất cả',
    'Khoa Tim Mạch Can Thiệp',
    'Khoa Hô Hấp',
    'Khoa Tiêu Hóa',
    'Khoa Nội Tiết & Đái Tháo Đường',
    'Khoa Chấn Thương Chỉnh Hình',
  ];

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Quản Lý Bệnh Nhân & Lịch Sử Y Khoa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tra cứu theo Mã hồ sơ (medical_code), họ tên và xem dòng thời gian (timeline) lịch khám, bệnh án, chuyển tuyến
          </p>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shrink-0 font-medium"
        >
          <Plus className="h-4 w-4 mr-2" /> Thêm Bệnh Nhân Mới
        </Button>
      </div>

      {/* Filter and Search Toolbar */}
      <Card className="p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search box */}
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm theo mã hồ sơ (vd: BN-2024-001) hoặc họ tên, BHYT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-base"
            />
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  Khoa: {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="Tất cả">Trạng thái: Tất cả</option>
              <option value="Ngoại trú">Ngoại trú</option>
              <option value="Nội trú">Nội trú</option>
              <option value="Chờ khám">Chờ khám</option>
              <option value="Đã xuất viện">Đã xuất viện</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main 2-column Layout: Patient List (Left) & Detailed Timeline (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Patient Cards/Table (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Tìm thấy {filteredPatients.length} bệnh nhân</span>
            <span>Nhấp vào thẻ bệnh nhân để mở Dòng thời gian</span>
          </div>

          {filteredPatients.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <AlertCircle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="font-semibold text-base">Không tìm thấy bệnh nhân nào phù hợp</p>
              <p className="text-xs mt-1">Vui lòng kiểm tra lại mã hồ sơ hoặc xóa bớt bộ lọc.</p>
            </Card>
          ) : (
            filteredPatients.map((patient) => {
              const isSelected = activePatient?.id === patient.id;
              return (
                <div
                  key={patient.id}
                  onClick={() => setSelectedId(patient.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-card border-primary ring-2 ring-primary/20 shadow-md'
                      : 'bg-card border-border hover:border-primary/40 hover:bg-muted/30 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="font-bold text-base text-foreground">
                          {patient.full_name}
                        </h3>
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs font-semibold">
                          {patient.medical_code}
                        </span>
                        <Badge
                          variant={
                            patient.status === 'Nội trú'
                              ? 'default'
                              : patient.status === 'Chờ khám'
                              ? 'warning'
                              : patient.status === 'Đã xuất viện'
                              ? 'outline'
                              : 'secondary'
                          }
                          className="text-[11px]"
                        >
                          {patient.status}
                        </Badge>
                      </div>

                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Giới tính / Tuổi: <strong className="text-foreground">{patient.gender} ({patient.dob})</strong></span>
                        <span>Nhóm máu: <strong className="text-blue-600 font-bold">{patient.blood_type}</strong></span>
                        <span>SĐT: <strong className="text-foreground">{patient.phone}</strong></span>
                        <span className="sm:col-span-2">Khoa: <strong className="text-foreground">{patient.department}</strong></span>
                        <span>BHYT: <strong className="font-mono text-foreground">{patient.insurance_id}</strong></span>
                      </div>
                    </div>

                    <Button
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className="shrink-0 text-xs h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(patient.id);
                      }}
                    >
                      Dòng thời gian &rarr;
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Interactive Patient Detail & Medical Timeline (5 Cols) */}
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
                <CardTitle className="text-xl mt-1 text-foreground">
                  {activePatient.full_name}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <span>{activePatient.gender} • Sinh ngày {activePatient.dob}</span>
                  <span>•</span>
                  <span className="text-blue-700 dark:text-blue-400 font-medium">{activePatient.department}</span>
                </CardDescription>

                {/* Patient Summary Badges */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Badge
                    variant={
                      activePatient.status === 'Nội trú'
                        ? 'default'
                        : activePatient.status === 'Đã xuất viện'
                        ? 'secondary'
                        : 'outline'
                    }
                    className="font-medium px-2 py-0.5"
                  >
                    Trạng thái: {activePatient.status}
                  </Badge>
                  <div className="px-2.5 py-1 rounded-lg bg-card border border-border text-foreground">
                    Nhóm máu: <span className="font-bold text-blue-600">{activePatient.blood_type}</span>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-card border border-border text-foreground">
                    Dị ứng:{' '}
                    <span className="font-medium text-destructive">
                      {activePatient.allergies.join(', ')}
                    </span>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-card border border-border text-foreground">
                    Thẻ BHYT: <span className="font-mono">{activePatient.insurance_id}</span>
                  </div>
                </div>

                {/* Action shortcuts: Record, Appointment, Bed Admission (Oracle 23ai) */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => onNavigate('records', activePatient.id)}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1.5" /> Mở Hồ Sơ Bệnh Án
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
                      onClick={handleDischargePatient}
                      disabled={isDischarging}
                    >
                      <LogOut className="h-3.5 w-3.5 mr-1.5" />
                      {isDischarging ? 'Đang xuất viện...' : 'Xuất Viện & Trả Giường'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      onClick={() => {
                        const deptId = activePatient.department.includes('Tiết') ? 2 : activePatient.department.includes('Hấp') ? 3 : 1;
                        setAdmitDeptId(deptId);
                        setIsAdmitModalOpen(true);
                      }}
                    >
                      <Bed className="h-3.5 w-3.5 mr-1.5" /> Tiếp Nhận & Phân Giường
                    </Button>
                  )}
                </div>
              </CardHeader>

              {/* Interactive Timeline Body */}
              <CardContent className="pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" /> Dòng Thời Gian Lịch Sử Y Tế (Timeline)
                </h4>

                {activePatient.timeline && activePatient.timeline.length > 0 ? (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    {activePatient.timeline.map((item, idx) => {
                      return (
                        <div key={item.id || idx} className="relative group">
                          {/* Dot marker */}
                          <div
                            className={`absolute -left-6 top-1 h-4 w-4 rounded-full border-2 border-background ${
                              item.badgeColor === 'destructive'
                                ? 'bg-destructive'
                                : item.badgeColor === 'warning'
                                ? 'bg-amber-500'
                                : item.badgeColor === 'teal' || item.badgeColor === 'blue'
                                ? 'bg-blue-600'
                                : 'bg-primary'
                            } shadow-sm`}
                          />

                          <div className="p-3 rounded-lg border border-border/70 bg-card hover:bg-muted/40 transition-all">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                              <span className="font-mono font-medium">{item.date}</span>
                              <span className="capitalize text-xs font-semibold text-primary">
                                {item.type === 'record' && 'Bệnh án lâm sàng'}
                                {item.type === 'referral' && 'Chuyển viện'}
                                {item.type === 'appointment' && 'Khám bệnh'}
                                {item.type === 'admission' && 'Tiếp nhận'}
                              </span>
                            </div>
                            <h5 className="text-sm font-semibold text-foreground">
                              {item.title}
                            </h5>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              {item.description}
                            </p>
                            {(item.doctor || item.facility) && (
                              <p className="text-[11px] text-blue-700 dark:text-blue-400 font-medium mt-1.5 flex items-center gap-1">
                                <span>{item.doctor ? `BS: ${item.doctor}` : ''}</span>
                                {item.doctor && item.facility ? '•' : ''}
                                <span>{item.facility ? `Cơ sở: ${item.facility}` : ''}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Chưa có sự kiện y khoa nào trong dòng thời gian của bệnh nhân này.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="font-semibold text-sm">Chưa chọn bệnh nhân</p>
              <p className="text-xs mt-1">Chọn một bệnh nhân ở danh sách bên trái để xem chi tiết dòng thời gian.</p>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog: Thêm Bệnh Nhân Mới */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Đăng Ký Hồ Sơ Bệnh Nhân Mới</DialogTitle>
            <DialogDescription>
              Nhập các thông tin hành chính để cấp mã bệnh nhân (medical_code) và tạo hồ sơ theo dõi.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePatient} className="space-y-4 py-2">
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
                <Input
                  type="date"
                  value={newDob}
                  onChange={(e) => setNewDob(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label required>Giới Tính</Label>
                <select
                  value={newGender}
                  onChange={(e) => setNewGender(e.target.value as any)}
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
                  onChange={(e) => setNewBloodType(e.target.value as any)}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="O+">O+</option>
                  <option value="A+">A+</option>
                  <option value="B+">B+</option>
                  <option value="AB+">AB+</option>
                  <option value="O-">O-</option>
                  <option value="A-">A-</option>
                  <option value="B-">B-</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>

              <div>
                <Label>Chuyên Khoa Tiếp Nhận</Label>
                <select
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {departments.filter((d) => d !== 'Tất cả').map((d) => (
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
                  placeholder="Ví dụ: Penicillin, hải sản (để trống nếu không có)"
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

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" className="bg-primary text-primary-foreground font-semibold">
                Xác Nhận Đăng Ký
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Tiếp Nhận & Cấp Giường Bệnh (Oracle 23ai PKG_HOSPITAL_OPS.ADMIT_PATIENT) */}
      <Dialog open={isAdmitModalOpen} onOpenChange={setIsAdmitModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Bed className="h-5 w-5" /> Tiếp Nhận & Phân Giường Nội Trú
            </DialogTitle>
            <DialogDescription>
              Thao tác gọi trực tiếp Stored Procedure <code>PKG_HOSPITAL_OPS.ADMIT_PATIENT</code> với cơ chế khóa hàng an toàn <code>SELECT ... FOR UPDATE SKIP LOCKED</code> trên Oracle 23ai để loại bỏ nghẽn tắc khi nhiều ca cấp cứu vào viện đồng thời.
            </DialogDescription>
          </DialogHeader>

          {activePatient && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg border border-border bg-muted/40 space-y-1 text-sm">
                <div>
                  Bệnh nhân: <strong className="text-foreground">{activePatient.full_name}</strong> ({activePatient.medical_code})
                </div>
                <div>
                  Trạng thái hiện tại: <Badge variant="secondary">{activePatient.status}</Badge>
                </div>
                <div>
                  Khoa chỉ định: <span className="font-medium text-blue-600">{activePatient.department}</span>
                </div>
              </div>

              <div>
                <Label required>Khoa Điều Trị Nội Trú & Cấp Giường</Label>
                <select
                  value={admitDeptId}
                  onChange={(e) => setAdmitDeptId(Number(e.target.value))}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary mt-1.5"
                >
                  <option value={1}>Khoa 1 - Khoa Tim Mạch Can Thiệp</option>
                  <option value={2}>Khoa 2 - Khoa Nội Tiết & Đái Tháo Đường</option>
                  <option value={3}>Khoa 3 - Khoa Hô Hấp</option>
                  <option value={4}>Khoa 4 - Khoa Tiêu Hóa</option>
                </select>
              </div>

              <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-2.5 rounded-lg border border-blue-200 dark:border-blue-900/40">
                💡 <strong>Cơ chế Oracle 23ai:</strong> Giao dịch sẽ khóa duy nhất 1 giường có trạng thái <code>AVAILABLE</code> tại khoa được chọn, đổi trạng thái sang <code>OCCUPIED</code> và ghi bản ghi vào bảng <code>ADMISSIONS</code>. Nếu khoa đã hết giường, Oracle sẽ trả lỗi <code>ORA-20001 (NO_BED_AVAILABLE)</code>.
              </div>

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAdmitModalOpen(false)}
                  disabled={isAdmitting}
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  onClick={handleAdmitPatient}
                  disabled={isAdmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5"
                >
                  {isAdmitting ? 'Đang phân giường...' : 'Xác Nhận Phân Giường'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
