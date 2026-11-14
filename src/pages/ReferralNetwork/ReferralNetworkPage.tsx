import React, { useState, useEffect, useMemo } from 'react';
import {
  Network,
  ArrowRight,
  Plus,
  RefreshCw,
  Hospital as HospitalIcon,
  Activity,
  Filter,
  Database,
  Share2,
  MapPin,
  TrendingUp,
  TrendingDown,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Code
} from 'lucide-react';
import { useMedicalStore } from '../../context/MedicalStore';
import { Referral, Patient, HospitalOption, ReferralPriority, ReferralStatus } from '../../types';

// Định nghĩa linh hoạt để tương thích cả camelCase, lowercase và UPPERCASE từ Oracle DB
export interface GraphNode {
  id: number;
  code?: string;
  name: string;
  tier: string;
  city?: string;
  address?: string;
  inflow: number;
  outflow: number;
  level?: number;
  capacityBeds?: number;
  specialtyFocus?: string;
}

export interface GraphEdge {
  id: string | number;
  source: number;
  target: number;
  from_hospital?: string;
  to_hospital?: string;
  urgency?: string;
  status?: string;
  patient_name?: string;
  count?: number;
}

interface PathResult {
  FROM_HOSPITAL?: string;
  TO_HOSPITAL?: string;
  HOPS?: number;
  PATH_REFERRAL_IDS?: string;
  URGENCY_PATH?: string;
  from_hospital?: string;
  to_hospital?: string;
  hops?: number;
  path_referral_ids?: string;
  urgency_path?: string;
}

interface ReferralNetworkPageProps {
  onNavigate?: (tab: string, extraId?: string) => void;
}

// Hàm chia tên bệnh viện thành 1 hoặc 2 dòng hiển thị trọn vẹn, không bị cắt cụt ba chấm
const splitHospitalName = (name: string): string[] => {
  if (!name) return ['Cơ sở Y tế'];
  const clean = name.trim();
  if (clean.length <= 15) return [clean];

  if (clean.startsWith('Bệnh Viện Đa Khoa')) {
    return ['Bệnh Viện Đa Khoa', clean.replace('Bệnh Viện Đa Khoa', '').trim()];
  }
  if (clean.startsWith('Bệnh Viện Hữu Nghị')) {
    return ['Bệnh Viện Hữu Nghị', clean.replace('Bệnh Viện Hữu Nghị', '').trim()];
  }
  if (clean.startsWith('Trạm Y Tế')) {
    return ['Trạm Y Tế', clean.replace('Trạm Y Tế', '').trim()];
  }
  if (clean.startsWith('Bệnh Viện')) {
    const rest = clean.replace('Bệnh Viện', '').trim();
    if (rest.length <= 14) return [clean];
    return ['Bệnh Viện', rest];
  }

  const words = clean.split(' ');
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
};

export const ReferralNetworkPage: React.FC<ReferralNetworkPageProps> = ({ onNavigate }) => {
  const { hospitals, patients, referrals, addReferral, updateReferralStatus, refreshReferrals } = useMedicalStore();

  // State đồ thị
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loadingGraph, setLoadingGraph] = useState<boolean>(true);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  // State Path Finder (GRAPH_TABLE)
  const [finderFromId, setFinderFromId] = useState<number | ''>('');
  const [finderToId, setFinderToId] = useState<number | ''>('');
  const [pathResults, setPathResults] = useState<PathResult[] | null>(null);
  const [executedSql, setExecutedSql] = useState<string>('');
  const [findingPath, setFindingPath] = useState<boolean>(false);

  // State Modal Tạo phiếu
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    patientId: '',
    fromHospitalId: '',
    toHospitalId: '',
    reason: 'Vượt quá năng lực can thiệp chuyên sâu tuyến dưới',
    diagnosis: 'Theo dõi nhồi máu cơ tim cấp ST chênh lên',
    priority: 'Khẩn cấp' as ReferralPriority,
    transportMode: 'Xe cứu thương chuyên dụng'
  });

  // Tải dữ liệu đồ thị từ Backend Oracle 23ai
  const fetchGraphData = async () => {
    setLoadingGraph(true);
    try {
      const res = await fetch('/api/graph/overview');
      if (res.ok) {
        const data = await res.json();
        const rawNodes = Array.isArray(data.nodes) ? data.nodes : [];
        const rawEdges = Array.isArray(data.edges) ? data.edges : [];

        // Chuẩn hóa nodes an toàn
        const normalizedNodes: GraphNode[] = rawNodes.map((n: any) => ({
          id: Number(n.id ?? n.HOSPITAL_ID ?? 0),
          code: String(n.code ?? n.CODE ?? ''),
          name: String(n.name ?? n.HOSPITAL_NAME ?? 'Cơ sở Y tế'),
          tier: String(n.tier ?? n.LEVEL_NAME ?? 'Tuyến Cơ Sở'),
          city: String(n.city ?? n.PROVINCE ?? 'Hà Nội'),
          address: String(n.address ?? n.ADDRESS ?? ''),
          inflow: Number(n.inflow ?? n.INFLOW_COUNT ?? 0),
          outflow: Number(n.outflow ?? n.OUTFLOW_COUNT ?? 0),
          level: Number(n.level ?? 1),
          capacityBeds: Number(n.capacityBeds ?? n.BED_CAPACITY ?? 200),
          specialtyFocus: String(n.specialtyFocus ?? 'Đa khoa tiếp nhận')
        }));

        // Chuẩn hóa edges: gom nhóm các cạnh có cùng source và target để đếm số ca
        const edgeMap = new Map<string, GraphEdge>();
        rawEdges.forEach((e: any) => {
          const s = Number(e.source ?? e.from_id ?? e.FROM_HOSPITAL_ID ?? 0);
          const t = Number(e.target ?? e.to_id ?? e.TO_HOSPITAL_ID ?? 0);
          if (s && t) {
            const key = `${s}->${t}`;
            if (edgeMap.has(key)) {
              const existing = edgeMap.get(key)!;
              existing.count = (existing.count || 1) + 1;
            } else {
              edgeMap.set(key, {
                id: e.id ?? key,
                source: s,
                target: t,
                from_hospital: e.from_hospital,
                to_hospital: e.to_hospital,
                urgency: e.urgency,
                status: e.status,
                patient_name: e.patient_name,
                count: 1
              });
            }
          }
        });

        const normalizedEdges = Array.from(edgeMap.values());

        setNodes(normalizedNodes);
        setEdges(normalizedEdges);

        if (normalizedNodes.length > 0 && !selectedNodeId) {
          setSelectedNodeId(normalizedNodes[0].id);
        }
      } else {
        console.warn('API /api/graph/overview trả về lỗi');
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu đồ thị:', err);
    } finally {
      setLoadingGraph(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

  // Layout đồ thị mạng lưới Topology (SVG Canvas)
  // Phân tầng theo 4 Tuyến: Tuyến 1 -> Tuyến 2 -> Tuyến 3 -> Tuyến 4
  const layoutNodes = useMemo(() => {
    const canvasHeight = 440;

    const groups: { [key: string]: GraphNode[] } = {
      'Tuyến 1': [],
      'Tuyến 2': [],
      'Tuyến 3': [],
      'Tuyến 4': [],
      'Khác': []
    };

    (nodes || []).forEach((n) => {
      const lvl = n.tier || '';
      if (lvl.includes('Tuyến 1') || lvl.includes('Xã') || lvl.includes('Cơ sở') || n.level === 1) {
        groups['Tuyến 1'].push(n);
      } else if (lvl.includes('Tuyến 2') || lvl.includes('Huyện') || lvl.includes('Quận') || n.level === 2) {
        groups['Tuyến 2'].push(n);
      } else if (lvl.includes('Tuyến 3') || lvl.includes('Tỉnh') || n.level === 3) {
        groups['Tuyến 3'].push(n);
      } else if (lvl.includes('Tuyến 4') || lvl.includes('Trung ương') || lvl.includes('TW') || n.level === 4) {
        groups['Tuyến 4'].push(n);
      } else {
        groups['Khác'].push(n);
      }
    });

    const colX: { [key: string]: number } = {
      'Tuyến 1': 100,
      'Tuyến 2': 320,
      'Tuyến 3': 540,
      'Tuyến 4': 760
    };

    const nodePositions = new Map<number, { x: number; y: number; node: GraphNode }>();

    ['Tuyến 1', 'Tuyến 2', 'Tuyến 3', 'Tuyến 4'].forEach((tier) => {
      const tierNodes = groups[tier] || [];
      const count = tierNodes.length;
      tierNodes.forEach((node, idx) => {
        const x = colX[tier];
        const spacing = canvasHeight / (count + 1);
        const y = spacing * (idx + 1);
        nodePositions.set(node.id, { x, y, node });
      });
    });

    (groups['Khác'] || []).forEach((node, idx) => {
      const x = 120 + idx * 160;
      const y = canvasHeight - 40;
      nodePositions.set(node.id, { x, y, node });
    });

    return nodePositions;
  }, [nodes]);

  // Node đang chọn
  const activeNode = useMemo(() => {
    if (!nodes || nodes.length === 0) return null;
    return nodes.find((n) => n.id === selectedNodeId) || nodes[0] || null;
  }, [nodes, selectedNodeId]);

  // Xử lý tìm đường bằng Oracle 23ai GRAPH_TABLE
  const handleFindPath = async () => {
    if (!finderFromId || !finderToId) {
      alert('Vui lòng chọn cả điểm xuất phát và điểm đích để truy vấn đồ thị');
      return;
    }
    setFindingPath(true);
    setPathResults(null);
    try {
      const res = await fetch('/api/graph/path-finder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_id: Number(finderFromId),
          to_id: Number(finderToId)
        })
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setPathResults(data.paths || []);
        setExecutedSql(data.sql_used || data.query_sql || '');
      } else {
        alert(data.error || 'Lỗi khi tìm lộ trình đồ thị');
      }
    } catch (err) {
      console.error('Lỗi gọi API path-finder:', err);
      alert('Không thể kết nối đến Oracle Database 23ai');
    } finally {
      setFindingPath(false);
    }
  };

  // Xử lý tạo phiếu chuyển tuyến mới lưu thẳng vào Oracle DB
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientId || !formData.fromHospitalId || !formData.toHospitalId) {
      setNotification({ type: 'error', message: 'Vui lòng điền đầy đủ bệnh nhân và cơ sở chuyển tuyến' });
      return;
    }
    if (formData.fromHospitalId === formData.toHospitalId) {
      setNotification({ type: 'error', message: 'Cơ sở chuyển đi và cơ sở tiếp nhận không được trùng nhau' });
      return;
    }

    setCreating(true);
    setNotification(null);
    try {
      const fromHosp = (hospitals || []).find((h: HospitalOption) => String(h.id) === String(formData.fromHospitalId));
      const toHosp = (hospitals || []).find((h: HospitalOption) => String(h.id) === String(formData.toHospitalId));
      const patient = (patients || []).find((p: Patient) => String(p.id) === String(formData.patientId));

      await addReferral({
        patient_id: formData.patientId,
        patient_name: patient?.full_name || 'Bệnh nhân',
        patient_code: patient?.medical_code || `BN-${formData.patientId}`,
        from_facility: fromHosp?.name || 'Bệnh viện Tuyến Dưới',
        to_facility: toHosp?.name || 'Bệnh viện Bạch Mai',
        from_tier: fromHosp?.level || 'Tuyến Huyện',
        to_tier: toHosp?.level || 'Tuyến Trung Ương',
        priority: formData.priority,
        reason: formData.reason,
        initial_diagnosis: formData.diagnosis,
        transfer_date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        doctor_approval: 'BS. Trực Chuyển Tuyến',
        status: 'Chờ duyệt',
        transport_type: formData.transportMode as any
      });

      setNotification({ type: 'success', message: 'Tạo phiếu chuyển tuyến và ghi nhận đồ thị Oracle thành công!' });
      setShowCreateModal(false);
      // Tải lại đồ thị và danh sách
      await fetchGraphData();
      await refreshReferrals();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Lỗi khi lưu phiếu chuyển tuyến vào CSDL' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shadow-sm">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex flex-wrap items-center gap-2">
                Mạng Lưới Chuyển Tuyến Y Tế (Referral Graph)
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Oracle 23ai Property Graph
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Mô hình đồ thị phân tích luồng điều phối bệnh nhân từ Tuyến cơ sở (Xã/Huyện) lên Tuyến chuyên sâu (Tỉnh/Trung ương)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchGraphData();
              refreshReferrals();
            }}
            disabled={loadingGraph}
            className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loadingGraph ? 'animate-spin' : ''}`} />
            Làm mới đồ thị
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Tạo Phiếu Chuyển Tuyến
          </button>
        </div>
      </div>

      {/* Thông báo nếu có */}
      {notification && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-xs sm:text-sm ${notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
            }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOPOLOGY GRAPH CANVAS: ĐỒ THỊ TRỰC QUAN */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-800 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-blue-600" />
              Sơ Đồ Mạng Lưới Đồ Thị Luồng Chuyển Bệnh Nhân (Topology Canvas)
            </h2>
            <p className="text-xs text-slate-500">
              Biểu diễn trực quan các Đỉnh (Bệnh viện) & Cạnh có hướng (Ca chuyển viện) được đọc trực tiếp từ CSDL Oracle
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Tuyến 1 (Xã/Cơ sở)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span> Tuyến 2 (Huyện/Quận)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-500"></span> Tuyến 3 (Tỉnh)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500"></span> Tuyến 4 (Trung ương)
            </div>
          </div>
        </div>

        {/* Khung vẽ đồ thị tương tác bằng SVG */}
        <div className="relative w-full bg-gradient-to-b from-slate-900 via-slate-850 to-slate-900 p-4 select-none min-h-[460px] flex items-center justify-center overflow-x-auto">
          {loadingGraph ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
              <span className="text-sm">Đang tải cấu trúc đồ thị từ Oracle 23ai...</span>
            </div>
          ) : !nodes || nodes.length === 0 ? (
            <div className="text-slate-400 text-sm">Chưa có dữ liệu đồ thị. Vui lòng kiểm tra kết nối CSDL Oracle.</div>
          ) : (
            <svg viewBox="0 0 860 440" className="w-full min-w-[700px] h-auto max-h-[460px] drop-shadow-md">
              <defs>
                {/* Marker mũi tên định hướng cho Cạnh đồ thị */}
                <marker
                  id="graph-arrow"
                  viewBox="0 0 10 10"
                  refX="26"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#60a5fa" />
                </marker>
                <marker
                  id="graph-arrow-active"
                  viewBox="0 0 10 10"
                  refX="26"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                </marker>
                {/* Hiệu ứng Glow cho node được chọn */}
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Lưới tọa độ ngầm (Grid Lines cho 4 Cột Tuyến) */}
              <g stroke="#334155" strokeDasharray="3 3" strokeWidth="1" opacity="0.4">
                <line x1="100" y1="20" x2="100" y2="420" />
                <line x1="320" y1="20" x2="320" y2="420" />
                <line x1="540" y1="20" x2="540" y2="420" />
                <line x1="760" y1="20" x2="760" y2="420" />
              </g>

              {/* Tiêu đề cột các tuyến */}
              <text x="100" y="24" fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="bold">TUYẾN 1 (XÃ)</text>
              <text x="320" y="24" fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="bold">TUYẾN 2 (HUYỆN)</text>
              <text x="540" y="24" fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="bold">TUYẾN 3 (TỈNH)</text>
              <text x="760" y="24" fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="bold">TUYẾN 4 (TRUNG ƯƠNG)</text>

              {/* Vẽ CẠNH ĐỒ THỊ (EDGES) CÓ HƯỚNG */}
              {edges.map((edge, index) => {
                const src = layoutNodes.get(edge.source);
                const dst = layoutNodes.get(edge.target);
                if (!src || !dst) return null;

                const isConnectedToSelected = selectedNodeId === edge.source || selectedNodeId === edge.target;
                const dx = dst.x - src.x;
                const cx1 = src.x + dx * 0.5;
                const cy1 = src.y;
                const cx2 = src.x + dx * 0.5;
                const cy2 = dst.y;
                const midX = (src.x + dst.x) / 2;
                const midY = (src.y + dst.y) / 2 - 8;

                return (
                  <g key={`edge-${index}`}>
                    <path
                      d={`M ${src.x} ${src.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${dst.x} ${dst.y}`}
                      fill="none"
                      stroke={isConnectedToSelected ? '#38bdf8' : '#475569'}
                      strokeWidth={isConnectedToSelected ? 3 : 1.5}
                      strokeDasharray={isConnectedToSelected ? 'none' : '4 2'}
                      markerEnd={isConnectedToSelected ? 'url(#graph-arrow-active)' : 'url(#graph-arrow)'}
                      className="transition-all duration-300"
                    />
                    {/* Nhãn số ca chuyển tuyến trên cạnh */}
                    <rect
                      x={midX - 16}
                      y={midY - 9}
                      width={32}
                      height={18}
                      rx={9}
                      fill="#0f172a"
                      stroke={isConnectedToSelected ? '#38bdf8' : '#64748b'}
                      strokeWidth={1}
                    />
                    <text
                      x={midX}
                      y={midY + 4}
                      fill={isConnectedToSelected ? '#38bdf8' : '#cbd5e1'}
                      fontSize="10"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {edge.count || 1} ca
                    </text>
                  </g>
                );
              })}

              {/* Vẽ ĐỈNH ĐỒ THỊ (VERTICES / NODES) */}
              {Array.from(layoutNodes.values()).map(({ x, y, node }) => {
                const isSelected = selectedNodeId === node.id;
                const lvl = node.tier || '';
                let nodeColor = '#3b82f6';
                if (lvl.includes('Tuyến 1') || lvl.includes('Xã')) nodeColor = '#10b981';
                else if (lvl.includes('Tuyến 2') || lvl.includes('Huyện')) nodeColor = '#0284c7';
                else if (lvl.includes('Tuyến 3') || lvl.includes('Tỉnh')) nodeColor = '#a855f7';
                else if (lvl.includes('Tuyến 4') || lvl.includes('Trung ương') || lvl.includes('Đặc Biệt')) nodeColor = '#f43f5e';

                const nodeDisplayName = node.name || 'Cơ sở Y tế';
                const lines = splitHospitalName(nodeDisplayName);
                const isTwoLines = lines.length > 1;
                const boxWidth = 154;
                const boxHeight = isTwoLines ? 34 : 22;
                const boxX = x - boxWidth / 2;
                const boxY = y + 28;

                return (
                  <g
                    key={`node-${node.id}`}
                    onClick={() => setSelectedNodeId(node.id)}
                    className="cursor-pointer group"
                  >
                    <title>{`${node.name} (${node.tier}) - Quy mô: ${node.capacityBeds || 500} giường - Đến: +${node.inflow} / Đi: -${node.outflow}`}</title>
                    {/* Vòng tròn pulse cố định quanh tâm khi được chọn */}
                    {isSelected && (
                      <circle
                        cx={x}
                        cy={y}
                        r={32}
                        fill="none"
                        stroke={nodeColor}
                        strokeWidth={2}
                        opacity={0.7}
                        className="animate-pulse"
                      />
                    )}
                    {/* Thân Node: Không dùng CSS transform scale để tránh văng lệch tâm trong SVG */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 25 : 23}
                      fill="#1e293b"
                      stroke={nodeColor}
                      strokeWidth={isSelected ? 3 : 2}
                      filter={isSelected ? 'url(#glow)' : undefined}
                      className="transition-colors duration-200 group-hover:stroke-white"
                    />
                    <text
                      x={x}
                      y={y + 5}
                      fill="#ffffff"
                      fontSize="14"
                      textAnchor="middle"
                      fontWeight="bold"
                      className="pointer-events-none select-none"
                    >
                      🏥
                    </text>
                    {/* Khung nhãn tên bệnh viện đầy đủ */}
                    <rect
                      x={boxX}
                      y={boxY}
                      width={boxWidth}
                      height={boxHeight}
                      rx={5}
                      fill="rgba(15, 23, 42, 0.92)"
                      stroke={isSelected ? nodeColor : '#334155'}
                      strokeWidth={isSelected ? 1.5 : 1}
                      className="transition-colors group-hover:stroke-slate-400"
                    />
                    {isTwoLines ? (
                      <text
                        x={x}
                        y={boxY + 13}
                        fill={isSelected ? '#ffffff' : '#e2e8f0'}
                        fontSize="10"
                        textAnchor="middle"
                        fontWeight={isSelected ? 'bold' : '500'}
                        className="pointer-events-none select-none"
                      >
                        <tspan x={x} dy="0">{lines[0]}</tspan>
                        <tspan x={x} dy="13" fill={isSelected ? '#38bdf8' : '#94a3b8'}>{lines[1]}</tspan>
                      </text>
                    ) : (
                      <text
                        x={x}
                        y={boxY + 15}
                        fill={isSelected ? '#ffffff' : '#e2e8f0'}
                        fontSize="10.5"
                        textAnchor="middle"
                        fontWeight={isSelected ? 'bold' : 'normal'}
                        className="pointer-events-none select-none"
                      >
                        {lines[0]}
                      </text>
                    )}
                    {/* Badge In/Out */}
                    <g transform={`translate(${x - 30}, ${y - 36})`}>
                      <rect width="60" height="15" rx="7.5" fill="#020617" stroke="#475569" strokeWidth="0.5" />
                      <text x="30" y="11" fill="#38bdf8" fontSize="8" textAnchor="middle" fontWeight="bold">
                        +{node.inflow} / -{node.outflow}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Thông tin chi tiết Đỉnh đang chọn (Đọc động từ DB) */}
        {activeNode && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <HospitalIcon className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-base">{activeNode.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-100 text-blue-700">
                  {activeNode.tier}
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {activeNode.city || 'Hà Nội'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Mã cơ sở: #{activeNode.id} • Quy mô: {activeNode.capacityBeds || 500} giường bệnh • Chuyên khoa: {activeNode.specialtyFocus || 'Đa khoa tiếp nhận'}
              </p>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Chuyển đến (Inflow)</div>
                  <div className="text-sm font-bold text-emerald-600">+{activeNode.inflow} ca</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                <TrendingDown className="w-4 h-4 text-amber-600" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Chuyển đi (Outflow)</div>
                  <div className="text-sm font-bold text-amber-600">-{activeNode.outflow} ca</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CÔNG CỤ TRUY VẤN GRAPH_TABLE CỦA ORACLE 23AI */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600 shrink-0" />
            <div>
              <h2 className="font-bold text-slate-800 text-sm sm:text-base">
                Công Cụ Tìm Lộ Trình Chuyển Tuyến (Oracle 23ai GRAPH_TABLE)
              </h2>
              <p className="text-xs text-slate-500">
                Thực thi cú pháp chuẩn ISO/IEC PGQL: <code className="bg-slate-100 text-indigo-700 px-1 py-0.5 rounded font-mono">GRAPH_TABLE(hospital_referral_graph MATCH (src)-[r]-&gt;{'{1,2}'}(dst))</code>
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md self-start sm:self-auto">
            SQL Graph Pattern Matching
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Điểm bắt đầu (From Hospital):</label>
            <select
              value={finderFromId}
              onChange={(e) => setFinderFromId(e.target.value ? Number(e.target.value) : '')}
              className="w-full text-xs sm:text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">-- Chọn bệnh viện xuất phát --</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.tier})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Điểm đích cần đến (To Hospital):</label>
            <select
              value={finderToId}
              onChange={(e) => setFinderToId(e.target.value ? Number(e.target.value) : '')}
              className="w-full text-xs sm:text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">-- Chọn bệnh viện tiếp nhận --</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.tier})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleFindPath}
            disabled={findingPath || !finderFromId || !finderToId}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50 transition-colors"
          >
            {findingPath ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Network className="w-4 h-4" />
            )}
            Truy Vấn Đường Đi (GRAPH_TABLE)
          </button>
        </div>

        {/* Hiển thị SQL Câu lệnh và Kết quả Path Finder */}
        {executedSql && (
          <div className="bg-slate-900 rounded-lg p-3 text-slate-200 text-xs font-mono overflow-x-auto border border-slate-700">
            <div className="flex items-center justify-between text-slate-400 mb-1 text-[11px]">
              <span className="flex items-center gap-1 font-sans">
                <Code className="w-3.5 h-3.5 text-emerald-400" />
                Câu lệnh thực thi trực tiếp trên Oracle Database 23ai:
              </span>
              <span className="text-emerald-400">Status: 200 OK</span>
            </div>
            <pre className="text-emerald-300 leading-relaxed">{executedSql}</pre>
          </div>
        )}

        {pathResults && (
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Kết quả đường đi phát hiện được ({pathResults.length} lộ trình):
            </h4>
            {pathResults.length === 0 ? (
              <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Không tìm thấy lộ trình chuyển tuyến trực tiếp hoặc qua 1 trạm trung gian giữa 2 cơ sở này trong dữ liệu đồ thị hiện tại.
              </div>
            ) : (
              <div className="space-y-2">
                {pathResults.map((p, idx) => {
                  const fromHosp = p.FROM_HOSPITAL || p.from_hospital || 'Cơ sở xuất phát';
                  const toHosp = p.TO_HOSPITAL || p.to_hospital || 'Cơ sở tiếp nhận';
                  const hops = p.HOPS ?? p.hops ?? 1;
                  const pathIds = p.PATH_REFERRAL_IDS || p.path_referral_ids || '';
                  const urgency = p.URGENCY_PATH || p.urgency_path || '';

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2 font-medium text-slate-800">
                        <span className="px-2 py-0.5 rounded bg-indigo-200 text-indigo-800 font-bold">
                          Lộ trình #{idx + 1}
                        </span>
                        <span className="font-semibold text-blue-700">{fromHosp}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-rose-700">{toHosp}</span>
                        {pathIds && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-mono">
                            Mã ca: [{pathIds}]
                          </span>
                        )}
                        {urgency && (
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[11px]">
                            Cấp cứu: {urgency}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-600 font-mono text-[11px] font-semibold">
                        {hops === 1 ? 'Chuyển thẳng (1 Chặng)' : `Chuyển qua trạm (${hops} Chặng)`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DANH SÁCH CÁC CA CHUYỂN TUYẾN (DỮ LIỆU THỰC TỪ ORACLE) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Danh Sách Ca Chuyển Tuyến (Graph Query Results)
            </h2>
            <p className="text-xs text-slate-500">
              Bảng kết quả các cạnh chuyển viện thực tế lưu trữ trong bảng <code className="font-mono text-blue-700">REFERRALS</code>
            </p>
          </div>
          <div className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
            Tổng cộng: {referrals.length} ca
          </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-3 px-4 whitespace-nowrap">Mã Chuyển Viện</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[140px]">Bệnh Nhân</th>
                  <th className="py-3 px-4 min-w-[320px]">Luồng Chuyển Tuyến (Edge)</th>
                  <th className="py-3 px-4 whitespace-nowrap text-center">Mức Độ</th>
                  <th className="py-3 px-4 min-w-[240px]">Lý Do / Chẩn Đoán</th>
                  <th className="py-3 px-4 whitespace-nowrap">Trạng Thái</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {referrals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      Chưa có ca chuyển tuyến nào trong hệ thống.
                    </td>
                  </tr>
                ) : (
                  referrals.map((r: Referral) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600 whitespace-nowrap align-top">
                          {r.referral_code || r.id}
                        </td>
                          <td className="py-3.5 px-4 whitespace-nowrap align-top min-w-[140px]">
                            <div className="font-bold text-slate-800">{r.patient_name}</div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">{r.patient_code || r.patient_id}</div>
                          </td>
                              <td className="py-3.5 px-4 min-w-[320px] align-top">
                                <div className="flex flex-col gap-1 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wider shrink-0">Từ</span>
                                    <span className="font-medium text-slate-700">{r.from_facility}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase tracking-wider shrink-0">Đến</span>
                                    <span className="font-semibold text-blue-700">{r.to_facility}</span>
                                  </div>
                                </div>
                                  <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                                    <span>🚑</span> {r.transport_type || 'Xe cứu thương chuyên dụng'}
                                  </div>
                              </td>
                                <td className="py-3.5 px-4 whitespace-nowrap align-top text-center">
                                  <span
                        className={`inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ${r.priority === 'Cấp cứu'
                                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                        : r.priority === 'Khẩn cấp'
                                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                                      }`}
                                  >
                                    {r.priority}
                                  </span>
                                </td>
                                    <td className="py-3.5 px-4 min-w-[240px] max-w-sm align-top">
                                      <div className="font-medium text-slate-800 leading-snug">
                                        {r.initial_diagnosis || 'Theo dõi chuyên khoa'}
                                      </div>
                                        <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                          {r.reason}
                                        </div>
                                    </td>
                                      <td className="py-3.5 px-4 whitespace-nowrap align-top">
                                        <select
                                          value={r.status}
                                          onChange={(e) => updateReferralStatus(r.id, e.target.value as ReferralStatus)}
                                          className={`text-xs rounded-lg font-medium px-2.5 py-1.5 border outline-none shadow-sm transition-colors cursor-pointer ${
                                            r.status === 'Đã tiếp nhận'
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100/70'
                                                  : r.status === 'Đang chuyển bệnh'
                                                      ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100/70'
                                                      : r.status === 'Từ chối'
                                                          ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100/70'
                                                          : r.status === 'Hoàn tất'
                                                            ? 'bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100/70'
                                                            : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100/70'
                        }`}
                      >
                        <option value="Chờ duyệt">Chờ duyệt</option>
                        <option value="Đang chuyển bệnh">Đang chuyển bệnh</option>
                        <option value="Đã tiếp nhận">Đã tiếp nhận</option>
                        <option value="Từ chối">Từ chối</option>
                        <option value="Hoàn tất">Hoàn tất</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap align-top">
                      <button
                        onClick={() => {
                          if (onNavigate) {
                            onNavigate('records', r.patient_id);
                          } else {
                            alert(`Xem chi tiết bệnh án điện tử ca chuyển tuyến ${r.referral_code || r.id}`);
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium transition-colors"
                      >
                        Hồ Sơ BN
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL TẠO PHIẾU CHUYỂN TUYẾN (LƯU THẬT VÀO ORACLE DB) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-xl w-full overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/50">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-base">
                <Plus className="w-5 h-5" />
                Tạo Phiếu Chuyển Tuyến Y Tế Mới
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Chọn Bệnh Nhân (*):</label>
                <select
                  required
                  value={formData.patientId}
                  onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Chọn bệnh nhân từ CSDL --</option>
                  {(patients || []).map((p: Patient) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} - #{p.medical_code || p.id} ({p.gender || 'Nam'}, {p.dob || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cơ sở chuyển đi (From):</label>
                  <select
                    required
                    value={formData.fromHospitalId}
                    onChange={(e) => setFormData({ ...formData, fromHospitalId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">-- Chọn cơ sở gửi --</option>
                    {(hospitals || []).map((h: HospitalOption) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.level})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cơ sở tiếp nhận (To):</label>
                  <select
                    required
                    value={formData.toHospitalId}
                    onChange={(e) => setFormData({ ...formData, toHospitalId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">-- Chọn cơ sở tiếp nhận --</option>
                    {(hospitals || []).map((h: HospitalOption) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.level})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mức độ ưu tiên:</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as ReferralPriority })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Thông thường">Thông thường</option>
                    <option value="Khẩn cấp">Khẩn cấp</option>
                    <option value="Cấp cứu">Cấp cứu</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phương tiện di chuyển:</label>
                  <select
                    value={formData.transportMode}
                    onChange={(e) => setFormData({ ...formData, transportMode: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Xe cứu thương chuyên dụng">Xe cứu thương chuyên dụng</option>
                    <option value="Xe y tế tiêu chuẩn">Xe y tế tiêu chuẩn</option>
                    <option value="Tự túc có giám sát">Tự túc có giám sát</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tóm tắt chẩn đoán:</label>
                <input
                  type="text"
                  required
                  value={formData.diagnosis}
                  onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                  placeholder="VD: Theo dõi nhồi máu cơ tim..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lý do chuyển tuyến:</label>
                <textarea
                  rows={2}
                  required
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="VD: Vượt quá năng lực can thiệp chuyên sâu tuyến dưới"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50 transition-all"
                >
                  {creating && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Lưu vào CSDL Oracle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferralNetworkPage;
