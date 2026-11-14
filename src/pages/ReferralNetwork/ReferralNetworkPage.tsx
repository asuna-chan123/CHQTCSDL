import React, { useState } from 'react';
import {
  Network,
  ArrowRight,
  Building,
  Building2,
  Ambulance,
  AlertTriangle,
  CheckCircle2,
  Share2,
  Plus,
  Filter,
  MapPin,
} from 'lucide-react';
import { useMedicalStore } from '@/context/MedicalStore';
import { Referral, ReferralPriority, ReferralStatus } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

interface ReferralNetworkPageProps {
  onNavigate: (tab: string, extraId?: string) => void;
}

interface FacilityNode {
  id: string;
  name: string;
  tier: 'Tuyến Xã/Phường' | 'Tuyến Huyện' | 'Tuyến Tỉnh' | 'Tuyến Trung Ương';
  city: string;
  inflow: number;
  outflow: number;
  capacityBeds: number;
  specialtyFocus: string;
  level: number; // 1 to 4
}

const NETWORK_NODES: FacilityNode[] = [
  {
    id: 'fac-1',
    name: 'Trạm Y Tế Xã Đa Tốn',
    tier: 'Tuyến Xã/Phường',
    city: 'Hà Nội',
    inflow: 0,
    outflow: 12,
    capacityBeds: 5,
    specialtyFocus: 'Sơ cứu ban đầu & Tiêm chủng',
    level: 1,
  },
  {
    id: 'fac-2',
    name: 'BVĐK Huyện Gia Lâm',
    tier: 'Tuyến Huyện',
    city: 'Hà Nội',
    inflow: 14,
    outflow: 8,
    capacityBeds: 180,
    specialtyFocus: 'Nội - Ngoại - Sản cơ bản',
    level: 2,
  },
  {
    id: 'fac-3',
    name: 'BVĐK Tỉnh Hải Dương',
    tier: 'Tuyến Tỉnh',
    city: 'Hải Dương',
    inflow: 45,
    outflow: 19,
    capacityBeds: 600,
    specialtyFocus: 'Đa khoa chuyên sâu tuyến tỉnh',
    level: 3,
  },
  {
    id: 'fac-4',
    name: 'Bệnh Viện Bạch Mai',
    tier: 'Tuyến Trung Ương',
    city: 'Hà Nội',
    inflow: 120,
    outflow: 0,
    capacityBeds: 2500,
    specialtyFocus: 'Tim mạch, Hồi sức, Chống độc TW',
    level: 4,
  },
  {
    id: 'fac-5',
    name: 'Bệnh Viện Hữu Nghị Việt Đức',
    tier: 'Tuyến Trung Ương',
    city: 'Hà Nội',
    inflow: 85,
    outflow: 0,
    capacityBeds: 1500,
    specialtyFocus: 'Ngoại khoa, Phẫu thuật sọ não & Cột sống',
    level: 4,
  },
];

const normalizeFacilityName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .trim();

const facilityNameMatches = (facilityName: string, nodeName: string) => {
  const facility = normalizeFacilityName(facilityName);
  const node = normalizeFacilityName(nodeName);
  return facility.includes(node) || node.includes(facility);
};

export const ReferralNetworkPage: React.FC<ReferralNetworkPageProps> = ({
  onNavigate,
}) => {
  const { referrals, patients, addReferral, updateReferralStatus } = useMedicalStore();
  const { success } = useToast();

  const [selectedNode, setSelectedNode] = useState<FacilityNode | null>(NETWORK_NODES[3]); // Bạch Mai default
  const [priorityFilter, setPriorityFilter] = useState('Tất cả');
  const [isNewReferralModalOpen, setIsNewReferralModalOpen] = useState(false);

  // New referral form state
  const [newPatientId, setNewPatientId] = useState(patients[0]?.id || '');
  const [newFromFacility, setNewFromFacility] = useState('BVĐK Tỉnh Hải Dương');
  const [newToFacility, setNewToFacility] = useState('Bệnh Viện Bạch Mai (Hà Nội)');
  const [newPriority, setNewPriority] = useState<ReferralPriority>('Khẩn cấp');
  const [newReason, setNewReason] = useState('Vượt quá năng lực can thiệp chuyên sâu');
  const [newDiagnosis, setNewDiagnosis] = useState('Theo dõi nhồi máu cơ tim cấp');

  const filteredReferrals = referrals.filter((referral) => {
    const matchesNode =
      !selectedNode ||
      facilityNameMatches(referral.from_facility, selectedNode.name) ||
      facilityNameMatches(referral.to_facility, selectedNode.name);
    const matchesPriority =
      priorityFilter === 'Tất cả' || referral.priority === priorityFilter;
    return matchesNode && matchesPriority;
  });

  const handleCreateReferral = (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find((p) => p.id === newPatientId);
    if (!patient) return;

    const created = addReferral({
      patient_id: patient.id,
      patient_code: patient.medical_code,
      patient_name: patient.full_name,
      from_facility: newFromFacility,
      to_facility: newToFacility,
      from_tier: 'Tuyến Tỉnh',
      to_tier: 'Tuyến Trung Ương',
      priority: newPriority,
      reason: newReason,
      initial_diagnosis: newDiagnosis,
      transfer_date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      doctor_approval: 'BS. CKII Lê Văn Thành',
      status: 'Chờ duyệt',
      transport_type: 'Xe cứu thương chuyên dụng',
    });

    setIsNewReferralModalOpen(false);
    success('Khởi tạo phiếu chuyển tuyến thành công', `Mã chuyển viện: ${created.referral_code}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" /> Mạng Lưới Chuyển Tuyến Y Tế (Referral Graph)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Truy vấn đồ thị luồng điều phối bệnh nhân từ Tuyến cơ sở (Xã/Huyện) lên Tuyến chuyên sâu (Tỉnh/Trung ương)
          </p>
        </div>

        <Button
          onClick={() => setIsNewReferralModalOpen(true)}
          className="bg-primary text-primary-foreground font-semibold shadow-sm shrink-0"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Tạo Phiếu Chuyển Tuyến
        </Button>
      </div>

      {/* 1. SƠ ĐỒ MẠNG LƯỚI ĐỒ THỊ TRỰC QUAN (Interactive Graph Flow Visualization) */}
      <Card className="border-blue-600/30 shadow-md overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/80 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Share2 className="h-5 w-5 text-blue-600" /> Sơ Đồ Đồ Thị Luồng Chuyển Bệnh Nhân
              </CardTitle>
              <CardDescription>
                Nhấp vào từng node cơ sở để xem thông tin năng lực tiếp nhận, ca chuyển đến và đi
              </CardDescription>
            </div>
            <Badge variant="blue" className="text-xs">
              Mô hình Phân Tuyến BHYT Việt Nam (4 Cấp)
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {/* Visual Graph Diagram with 4 Tiers */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 relative">
            {NETWORK_NODES.map((node, index) => {
              const isSelected = selectedNode?.id === node.id;
              const hasReferralConnections = referrals.some(
                (referral) =>
                  facilityNameMatches(referral.from_facility, node.name) ||
                  facilityNameMatches(referral.to_facility, node.name)
              );
              return (
                <button
                  type="button"
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  aria-pressed={isSelected}
                  className={`relative w-full rounded-xl border p-4 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isSelected
                      ? 'border-blue-600 ring-2 ring-blue-500/30 bg-blue-500/10 shadow-lg'
                      : 'border-border bg-card hover:border-blue-500/50 hover:bg-muted/40 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      Tuyến {node.level}
                    </span>
                    <Badge
                      variant={
                        node.level === 4
                          ? 'destructive'
                          : node.level === 3
                          ? 'warning'
                          : 'secondary'
                      }
                      className="text-[10px]"
                    >
                      {node.tier}
                    </Badge>
                  </div>

                  <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-blue-700 dark:text-blue-400 shrink-0" />
                    <span className="truncate">{node.name}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {node.city}
                    {hasReferralConnections && (
                      <span
                        aria-label="Có luồng chuyển tuyến"
                        className="ml-auto h-2 w-2 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none"
                      />
                    )}
                  </p>

                  {/* Flow statistics */}
                  <div className="mt-4 pt-3 border-t border-border/70 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground text-[11px]">Chuyển đến:</p>
                      <p className="font-bold text-emerald-600">+{node.inflow} ca</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[11px]">Chuyển đi:</p>
                      <p className="font-bold text-amber-600">-{node.outflow} ca</p>
                    </div>
                  </div>

                  {/* Flow Arrow indicator */}
                  {index < NETWORK_NODES.length - 1 && (
                    <div
                      aria-hidden="true"
                      className="hidden lg:block absolute left-full top-1/2 z-10 h-2 w-4 -translate-y-1/2"
                    >
                      <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)] animate-flow-dot" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Node Detail Inspector */}
          {selectedNode && (
            <div className="mt-6 p-4 rounded-xl bg-card border border-blue-600/30 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                  <div>
                    <h4 className="font-bold text-base text-foreground">{selectedNode.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {selectedNode.tier} • {selectedNode.city}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold">
                    Quy mô: {selectedNode.capacityBeds} giường bệnh
                  </span>
                </div>
              </div>
              <div className="mt-3 text-sm text-foreground/90">
                <p>
                  <strong>Năng lực chuyên môn:</strong> {selectedNode.specialtyFocus}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Đang sẵn sàng tiếp nhận các ca chuyển tuyến khẩn cấp bằng xe cứu thương chuyên dụng 24/7.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. BẢNG TRUY VẤN KẾT QUẢ ĐỒ THỊ CHUYỂN TUYẾN (Graph Query Results Table) */}
      <Card>
        <CardHeader className="border-b border-border/80 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Danh Sách Ca Chuyển Tuyến (Graph Query Results)</CardTitle>
              <CardDescription>
                Bảng kết quả truy vấn đồ thị từ hệ thống quản trị dữ liệu bệnh viện
              </CardDescription>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
                {selectedNode && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedNode(null)}
                    className="h-9 text-xs"
                  >
                    Xem tất cả
                  </Button>
                )}
                <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Tất cả">Ưu tiên: Tất cả</option>
                <option value="Cấp cứu">Cấp cứu</option>
                <option value="Khẩn cấp">Khẩn cấp</option>
                <option value="Thông thường">Thông thường</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-3">Mã Chuyển Viện</th>
                  <th className="py-2.5 px-3">Bệnh Nhân</th>
                  <th className="py-2.5 px-3">Luồng Chuyển Tuyến (Edge)</th>
                  <th className="py-2.5 px-3">Mức Độ</th>
                  <th className="py-2.5 px-3">Lý Do / Chẩn Đoán</th>
                  <th className="py-2.5 px-3">Trạng Thái</th>
                  <th className="py-2.5 px-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredReferrals.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      Không có hồ sơ chuyển tuyến phù hợp với bộ lọc.
                    </td>
                  </tr>
                )}
                {filteredReferrals.map((ref) => (
                  <tr key={ref.id} className="hover:bg-muted/20 transition-all duration-500">
                    <td className="py-3 px-3 font-mono font-bold text-xs text-primary">
                      {ref.referral_code}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-foreground">{ref.patient_name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{ref.patient_code}</p>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        <span className="text-muted-foreground">{ref.from_facility}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span className="text-blue-700 dark:text-blue-300 font-semibold">
                          {ref.to_facility}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Phương tiện: {ref.transport_type}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <Badge
                        variant={
                          ref.priority === 'Cấp cứu'
                            ? 'destructive'
                            : ref.priority === 'Khẩn cấp'
                            ? 'warning'
                            : 'secondary'
                        }
                        className="text-[11px]"
                      >
                        {ref.priority}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 max-w-xs">
                      <p className="font-medium text-xs text-foreground line-clamp-1">
                        {ref.initial_diagnosis}
                      </p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                        {ref.reason}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={ref.status}
                        onChange={(e) =>
                          updateReferralStatus(ref.id, e.target.value as ReferralStatus)
                        }
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="Chờ duyệt">Chờ duyệt</option>
                        <option value="Đã tiếp nhận">Đã tiếp nhận</option>
                        <option value="Đang chuyển bệnh">Đang chuyển bệnh</option>
                        <option value="Hoàn tất">Hoàn tất</option>
                        <option value="Từ chối">Từ chối</option>
                      </select>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onNavigate('records', ref.patient_id)}
                        className="text-xs text-primary hover:bg-primary/10 h-8"
                      >
                        Hồ Sơ BN
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* DIALOG: TẠO PHIẾU CHUYỂN TUYẾN ĐIỆN TỬ */}
      <Dialog open={isNewReferralModalOpen} onOpenChange={setIsNewReferralModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ambulance className="h-5 w-5 text-primary" /> Lập Phiếu Chuyển Tuyến Khám Chữa Bệnh
            </DialogTitle>
            <DialogDescription>
              Theo quy định của Bộ Y Tế và Bảo hiểm Xã hội Việt Nam
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateReferral} className="space-y-4 py-2">
            <div>
              <Label required>Bệnh Nhân Cần Chuyển Tuyến</Label>
              <select
                value={newPatientId}
                onChange={(e) => setNewPatientId(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.medical_code} - {p.full_name} ({p.department})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Cơ Sở Chuyển (Nguồn)</Label>
                <Input
                  type="text"
                  value={newFromFacility}
                  onChange={(e) => setNewFromFacility(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label required>Cơ Sở Tiếp Nhận (Đích)</Label>
                <Input
                  type="text"
                  value={newToFacility}
                  onChange={(e) => setNewToFacility(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Mức Độ Ưu Tiên</Label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as any)}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Cấp cứu">Cấp cứu (Hộ tống y tế)</option>
                  <option value="Khẩn cấp">Khẩn cấp</option>
                  <option value="Thông thường">Thông thường</option>
                </select>
              </div>

              <div>
                <Label required>Chẩn Đoán Sơ Bộ</Label>
                <Input
                  type="text"
                  value={newDiagnosis}
                  onChange={(e) => setNewDiagnosis(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label required>Lý Do Chuyển Tuyến</Label>
              <textarea
                rows={3}
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                className="w-full rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewReferralModalOpen(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" className="bg-primary text-primary-foreground font-semibold">
                Xác Nhận Ký Chuyển Tuyến
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
