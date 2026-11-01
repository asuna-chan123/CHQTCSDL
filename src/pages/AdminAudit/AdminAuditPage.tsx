import React, { useState } from 'react';
import {
  ShieldAlert,
  History,
  Bed,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Building,
  RefreshCw,
  Sliders,
  Download,
} from 'lucide-react';
import { useMedicalStore } from '@/context/MedicalStore';
import { AuditLog, HospitalBed } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';

interface AdminAuditPageProps {
  onNavigate: (tab: string, extraId?: string) => void;
}

export const AdminAuditPage: React.FC<AdminAuditPageProps> = ({ onNavigate }) => {
  const { logs, beds, toggleBedStatus, stats } = useMedicalStore();
  const { success } = useToast();

  const [activeTab, setActiveTab] = useState<'logs' | 'beds' | 'catalogs'>('logs');
  const [logSearch, setLogSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('Tất cả');
  const [departmentBedFilter, setDepartmentBedFilter] = useState('Tất cả');

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const q = logSearch.toLowerCase().trim();
    const matchQ =
      !q ||
      log.user_name.toLowerCase().includes(q) ||
      log.target_id.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q);

    const matchAction = actionFilter === 'Tất cả' || log.action === actionFilter;
    return matchQ && matchAction;
  });

  // Filter beds
  const filteredBeds = beds.filter((bed) => {
    if (departmentBedFilter === 'Tất cả') return true;
    return bed.department === departmentBedFilter;
  });

  const getActionBadgeVariant = (action: AuditLog['action']) => {
    switch (action) {
      case 'TẠO BỆNH ÁN':
        return 'blue' as const;
      case 'SỬA BỆNH ÁN':
        return 'warning' as const;
      case 'DUYỆT CHUYỂN TUYẾN':
        return 'default' as const;
      case 'HỦY LỊCH':
        return 'destructive' as const;
      default:
        return 'secondary' as const;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary" /> Quản Trị Hệ Thống & Nhật Ký Truy Vết (Audit Logs)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ghi vết lịch sử thay đổi hồ sơ bệnh án, phân quyền người dùng và quản lý danh mục buồng giường bệnh viện.
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs
        defaultValue="logs"
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as any)}
        className="w-full"
      >
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span>1. Nhật Ký Hệ Thống (Audit Logs)</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-mono">
              {logs.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="beds" className="flex items-center gap-2">
            <Bed className="h-4 w-4" />
            <span>2. Quản Lý Danh Mục Giường Bệnh</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-mono">
              {stats.availableBeds} trống
            </span>
          </TabsTrigger>
          <TabsTrigger value="catalogs" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span>3. Danh Mục Khoa Phòng & Dược Phẩm</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: AUDIT LOGS */}
        <TabsContent value="logs" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b border-border/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Nhật Ký Giao Dịch & Thay Đổi Bệnh Án</CardTitle>
                  <CardDescription>Bảo đảm tính toàn vẹn và bất biến (Immutable Audit Trail)</CardDescription>
                </div>

                {/* Filter and search */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Tìm nhật ký..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>

                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="h-9 rounded-lg border border-input bg-background px-3 text-xs w-full sm:w-auto"
                  >
                    <option value="Tất cả">Hành động: Tất cả</option>
                    <option value="TẠO BỆNH ÁN">TẠO BỆNH ÁN</option>
                    <option value="SỬA BỆNH ÁN">SỬA BỆNH ÁN</option>
                    <option value="ĐẶT LỊCH KHÁM">ĐẶT LỊCH KHÁM</option>
                    <option value="DUYỆT CHUYỂN TUYẾN">DUYỆT CHUYỂN TUYẾN</option>
                    <option value="ĐIỀU PHỐI GIƯỜNG">ĐIỀU PHỐI GIƯỜNG</option>
                    <option value="HỦY LỊCH">HỦY LỊCH</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3">Thời Gian</th>
                      <th className="py-2.5 px-3">Người Thao Tác</th>
                      <th className="py-2.5 px-3">Hành Động</th>
                      <th className="py-2.5 px-3">Mục Tiêu</th>
                      <th className="py-2.5 px-3">Nội Dung Chi Tiết</th>
                      <th className="py-2.5 px-3">Địa Chỉ IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredLogs.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/20 text-xs">
                        <td className="py-3 px-3 font-mono text-muted-foreground whitespace-nowrap">
                          {item.timestamp}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-foreground">{item.user_name}</p>
                          <span className="text-[10px] text-muted-foreground uppercase">
                            {item.user_role}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={getActionBadgeVariant(item.action)} className="text-[10px]">
                            {item.action}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono font-semibold text-primary">{item.target_id}</span>
                          <p className="text-[10px] text-muted-foreground">{item.target_type}</p>
                        </td>
                        <td className="py-3 px-3 max-w-md">
                          <p className="text-foreground/90 leading-relaxed">{item.details}</p>
                        </td>
                        <td className="py-3 px-3 font-mono text-muted-foreground whitespace-nowrap">
                          {item.ip_address}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: QUẢN LÝ GIƯỜNG BỆNH */}
        <TabsContent value="beds" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b border-border/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Quản Lý Danh Mục Buồng & Giường Bệnh</CardTitle>
                  <CardDescription>
                    Nhấp vào nút "Đổi trạng thái" để cập nhật trực tiếp tình trạng phòng bệnh
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={departmentBedFilter}
                    onChange={(e) => setDepartmentBedFilter(e.target.value)}
                    className="h-9 rounded-lg border border-input bg-background px-3 text-xs"
                  >
                    <option value="Tất cả">Khoa: Tất cả</option>
                    <option value="Hồi Sức Tích Cực (ICU)">Hồi Sức Tích Cực (ICU)</option>
                    <option value="Khoa Tim Mạch Can Thiệp">Khoa Tim Mạch Can Thiệp</option>
                    <option value="Khoa Hô Hấp">Khoa Hô Hấp</option>
                    <option value="Khoa Cấp Cứu A9">Khoa Cấp Cứu A9</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBeds.map((bed) => (
                  <div
                    key={bed.id}
                    className={`p-4 rounded-xl border transition-all ${
                      bed.is_occupied
                        ? 'border-rose-500/30 bg-rose-500/5'
                        : 'border-emerald-500/30 bg-emerald-500/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-base text-foreground">
                        {bed.bed_code}
                      </span>
                      <Badge
                        variant={bed.is_occupied ? 'destructive' : 'success'}
                        className="text-xs"
                      >
                        {bed.is_occupied ? 'Đang Nằm' : 'Còn Trống'}
                      </Badge>
                    </div>

                    <p className="text-xs font-semibold text-foreground mt-2">{bed.department}</p>
                    <p className="text-xs text-muted-foreground">{bed.room}</p>

                    {bed.is_occupied && (
                      <div className="mt-3 pt-2 border-t border-border/60 text-xs">
                        <p className="text-muted-foreground">Bệnh nhân: <strong className="text-foreground">{bed.patient_name}</strong></p>
                        <p className="text-muted-foreground">Mã BN: <strong className="font-mono text-primary">{bed.patient_code}</strong></p>
                      </div>
                    )}

                    <div className="mt-4 pt-2">
                      <Button
                        size="sm"
                        variant={bed.is_occupied ? 'outline' : 'default'}
                        onClick={() => {
                          toggleBedStatus(bed.id);
                          success('Đã cập nhật giường bệnh', `Giường ${bed.bed_code} đã chuyển sang trạng thái ${!bed.is_occupied ? 'Đang Nằm' : 'Còn Trống'}`);
                        }}
                        className="w-full text-xs h-8"
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        {bed.is_occupied ? 'Chuyển Sang Trống' : 'Gán Cho BN Mới'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: DANH MỤC KHOA PHÒNG & DƯỢC */}
        <TabsContent value="catalogs" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3 border-b border-border/80">
                <CardTitle className="text-base">Danh Mục Chuyên Khoa Bệnh Viện</CardTitle>
                <CardDescription>Cơ cấu tổ chức và nhân sự lâm sàng</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {[
                  { name: 'Khoa Tim Mạch Can Thiệp', code: 'TM-01', lead: 'BS. CKII Nguyễn Văn An', staff: 24 },
                  { name: 'Khoa Hô Hấp', code: 'HH-02', lead: 'BS. CKI Đỗ Đình Dũng', staff: 18 },
                  { name: 'Khoa Tiêu Hóa', code: 'TH-03', lead: 'BS. Trần Văn Hùng', staff: 15 },
                  { name: 'Khoa Nội Tiết & ĐTĐ', code: 'NT-04', lead: 'BS. Lê Thị Bích Ngọc', staff: 12 },
                  { name: 'Khoa Hồi Sức Tích Cực (ICU)', code: 'ICU-05', lead: 'TS. BS. Vũ Quốc Tuấn', staff: 35 },
                ].map((dept) => (
                  <div key={dept.code} className="p-3 rounded-lg border border-border flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{dept.name}</p>
                      <p className="text-muted-foreground mt-0.5">Trưởng khoa: {dept.lead} • Nhân sự: {dept.staff} cán bộ</p>
                    </div>
                    <span className="font-mono font-bold text-primary">{dept.code}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b border-border/80">
                <CardTitle className="text-base">Danh Mục Dược Phẩm Thiết Yếu (BHYT)</CardTitle>
                <CardDescription>Các nhóm hoạt chất tim mạch, nội tiết và kháng sinh</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {[
                  { name: 'Aspirin (Cardipirin)', type: 'Chống ngưng tập tiểu cầu', dose: '100mg', stock: 4500 },
                  { name: 'Atorvastatin (Lipitor)', type: 'Hạ lipid máu nhóm Statin', dose: '20mg', stock: 3200 },
                  { name: 'Amlodipine (Norvasc)', type: 'Chẹn kênh canxi hạ HA', dose: '5mg', stock: 5100 },
                  { name: 'Metformin HCl (Glucophage)', type: 'Hạ đường huyết Biguanide', dose: '500mg', stock: 6800 },
                  { name: 'Augmentin (Amoxicillin/Clavulanate)', type: 'Kháng sinh Penicillin', dose: '1g', stock: 2400 },
                ].map((drug, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{drug.name}</p>
                      <p className="text-muted-foreground mt-0.5">{drug.type} • Hàm lượng: {drug.dose}</p>
                    </div>
                    <span className="text-blue-700 dark:text-blue-400 font-semibold font-mono">
                      Kho: {drug.stock} viên
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
