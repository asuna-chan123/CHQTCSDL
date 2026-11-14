// ============================================================================
// Các hàm thuần (pure functions) biến kết quả truy vấn Oracle thành dữ liệu
// cho Dashboard / Quản lý bệnh nhân. Tách riêng khỏi index.js để test được
// mà không cần kết nối Oracle.
// ============================================================================

export const APPOINTMENT_STATUS_LABEL = {
  CREATED: 'Đang chờ',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đang chờ', // đã đến quầy tiếp đón, đang chờ gọi vào khám
  IN_PROGRESS: 'Đang khám',
  COMPLETED: 'Đã khám',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Vắng mặt',
};

export const URGENCY_LABEL = {
  EMERGENCY: 'Cấp cứu',
  URGENT: 'Khẩn cấp',
  NORMAL: 'Thông thường',
};

export const REFERRAL_STATUS_LABEL = {
  PENDING: 'Chờ duyệt',
  ACCEPTED: 'Đã tiếp nhận',
  REJECTED: 'Từ chối',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

const PATIENT_STATUS_LABEL = {
  INPATIENT: 'Nội trú',
  WAITING: 'Chờ khám',
  DISCHARGED: 'Đã xuất viện',
  OUTPATIENT: 'Ngoại trú',
};

const num = (v) => Number(v) || 0;

/**
 * Trạng thái bệnh nhân được SUY RA từ dữ liệu thật, thứ tự ưu tiên:
 *   đang nội trú > có lịch khám đang chờ HÔM NAY > mới xuất viện (30 ngày) > ngoại trú
 */
export function buildPatientList({
  patients,
  activeAdmissions,
  waitingToday,
  recentDischarges,
  latestAppointments,
}) {
  const inpatientDept = new Map(activeAdmissions.map((a) => [a.patient_id, a.department]));
  const waiting = new Set(waitingToday.map((r) => r.patient_id));
  const discharged = new Set(recentDischarges.map((r) => r.patient_id));
  const lastDept = new Map(latestAppointments.map((a) => [a.patient_id, a.department]));

  return patients.map((p) => {
    let status_code = 'OUTPATIENT';
    if (inpatientDept.has(p.id)) status_code = 'INPATIENT';
    else if (waiting.has(p.id)) status_code = 'WAITING';
    else if (discharged.has(p.id)) status_code = 'DISCHARGED';

    return {
      ...p,
      status_code,
      status: PATIENT_STATUS_LABEL[status_code],
      department: inpatientDept.get(p.id) || lastDept.get(p.id) || null,
    };
  });
}

const shorten = (text, max = 160) => {
  const s = (text ?? '').toString().trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

/**
 * Gộp lịch khám + bệnh án + chuyển tuyến + nhập/xuất viện của MỘT bệnh nhân
 * thành một timeline, mới nhất ở trên cùng.
 */
export function buildTimeline({ appointments, records, referrals, admissions }) {
  const items = [];

  for (const a of appointments) {
    const statusLabel = APPOINTMENT_STATUS_LABEL[a.status] || a.status;
    const color =
      a.status === 'COMPLETED'
        ? 'blue'
        : a.status === 'CANCELLED' || a.status === 'NO_SHOW'
        ? 'destructive'
        : 'warning';
    items.push({
      id: `apt-${a.id}`,
      sort_key: a.event_time,
      date: a.event_time.substring(0, 16),
      type: 'appointment',
      title: `Lịch khám: ${a.department}`,
      description: `${shorten(a.symptoms) || 'Không ghi triệu chứng'} — ${statusLabel}`,
      doctor: a.doctor || undefined,
      facility: a.facility || undefined,
      status: statusLabel,
      badgeColor: color,
    });
  }

  for (const r of records) {
    items.push({
      id: `rec-${r.id}`,
      sort_key: r.event_time,
      date: r.event_time.substring(0, 16),
      type: 'record',
      title: 'Bệnh án lâm sàng',
      description: shorten(r.diagnosis) || 'Chưa có tóm tắt chẩn đoán',
      doctor: r.doctor || undefined,
      facility: r.facility || undefined,
      badgeColor: 'teal',
    });
  }

  for (const r of referrals) {
    const urgencyLabel = URGENCY_LABEL[r.urgency] || r.urgency;
    const statusLabel = REFERRAL_STATUS_LABEL[r.status] || r.status;
    items.push({
      id: `ref-${r.id}`,
      sort_key: r.event_time,
      date: r.event_time.substring(0, 16),
      type: 'referral',
      title: `Chuyển tuyến: ${r.from_hospital} → ${r.to_hospital}`,
      description: `${shorten(r.reason) || 'Không ghi lý do'} — Mức độ: ${urgencyLabel}, ${statusLabel}`,
      doctor: r.doctor || undefined,
      facility: r.from_hospital,
      status: statusLabel,
      badgeColor:
        r.status === 'REJECTED' || r.status === 'CANCELLED' || r.urgency === 'EMERGENCY'
          ? 'destructive'
          : r.urgency === 'URGENT'
          ? 'warning'
          : 'blue',
    });
  }

  for (const a of admissions) {
    const where = [a.department, a.bed_code ? `giường ${a.bed_code}` : null].filter(Boolean).join(', ');
    items.push({
      id: `adm-${a.id}`,
      sort_key: a.admitted_at,
      date: a.admitted_at.substring(0, 16),
      type: 'admission',
      title: 'Nhập viện điều trị nội trú',
      description: where ? `Tiếp nhận tại ${where}.` : 'Tiếp nhận điều trị nội trú.',
      facility: a.facility || undefined,
      status: a.status === 'ACTIVE' ? 'Đang điều trị' : undefined,
      badgeColor: 'teal',
    });
    if (a.discharged_at) {
      items.push({
        id: `adm-out-${a.id}`,
        sort_key: a.discharged_at,
        date: a.discharged_at.substring(0, 16),
        type: 'admission',
        title: 'Xuất viện & trả giường',
        description: where ? `Hoàn tất điều trị tại ${where}.` : 'Hoàn tất điều trị nội trú.',
        facility: a.facility || undefined,
        badgeColor: 'blue',
      });
    }
  }

  return items
    .sort((x, y) => (x.sort_key < y.sort_key ? 1 : x.sort_key > y.sort_key ? -1 : 0))
    .map(({ sort_key, ...rest }) => rest);
}

/** Tổng hợp số liệu cho trang Tổng quan. */
export function buildDashboardSummary({
  departments,
  todayByDept,
  todayList,
  upcomingCount,
  pendingReferralCount,
  urgentPendingCount,
  pendingReferrals,
  inpatientCount,
}) {
  const todayMap = new Map(todayByDept.map((r) => [r.department_id, num(r.cnt)]));

  const deptRows = departments.map((d) => ({
    department_id: d.department_id,
    name: d.name,
    hospital: d.hospital || null,
    total_beds: num(d.total_beds),
    occupied_beds: num(d.occupied_beds),
    available_beds: num(d.available_beds),
    today_appointments: todayMap.get(d.department_id) || 0,
  }));

  const sum = (key) => deptRows.reduce((acc, d) => acc + d[key], 0);

  return {
    today_appointments: [...todayMap.values()].reduce((a, b) => a + b, 0),
    upcoming_appointments: num(upcomingCount),
    total_beds: sum('total_beds'),
    occupied_beds: sum('occupied_beds'),
    available_beds: sum('available_beds'),
    pending_referrals: num(pendingReferralCount),
    urgent_pending_referrals: num(urgentPendingCount),
    inpatients: num(inpatientCount),
    departments: deptRows,
    today_list: todayList.map((a) => ({
      id: String(a.id),
      patient_id: String(a.patient_id),
      patient_code: a.patient_code,
      patient_name: a.patient_name,
      time_label: a.time_label,
      department: a.department,
      doctor_name: a.doctor_name || 'Chưa phân bác sĩ',
      status: APPOINTMENT_STATUS_LABEL[a.status] || a.status,
      status_code: a.status,
    })),
    pending_referral_list: pendingReferrals.map((r) => ({
      id: String(r.id),
      patient_name: r.patient_name,
      patient_code: r.patient_code,
      from_facility: r.from_hospital,
      to_facility: r.to_hospital,
      priority: URGENCY_LABEL[r.urgency] || r.urgency,
      urgency: r.urgency,
      reason: shorten(r.reason, 120),
    })),
    generated_at: new Date().toISOString(),
  };
}
