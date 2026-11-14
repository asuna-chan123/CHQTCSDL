export type UserRole = 'doctor' | 'nurse' | 'admin' | 'patient';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  department?: string;
  avatar?: string;
}

export interface PatientTimelineItem {
  id: string;
  date: string;
  type: 'appointment' | 'record' | 'referral' | 'admission' | 'prescription';
  title: string;
  description: string;
  doctor?: string;
  facility?: string;
  status?: string;
  badgeColor?: string;
}

export interface Patient {
  id: string;
  medical_code: string; // vd: BN-2024-001
  full_name: string;
  dob: string;
  gender: 'Nam' | 'Nữ' | 'Khác';
  phone: string;
  insurance_id: string; // Số thẻ BHYT
  blood_type: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Chưa rõ';
  allergies: string[];
  address: string;
  status: 'Ngoại trú' | 'Nội trú' | 'Đã xuất viện' | 'Chờ khám';
  department: string;
  created_at: string;
  timeline: PatientTimelineItem[];
}

export interface TimeSlot {
  time: string; // vd: "08:00 - 08:30"
  period: 'Sáng' | 'Chiều';
  isAvailable: boolean;
  isLockedByOther?: boolean; // Mô phỏng xung đột đồng thời (concurrency)
  lockedBy?: string | null;
  lockedByInfo?: string | null;
}

export interface Appointment {
  id: string;
  patient_id: string;
  patient_code: string;
  patient_name: string;
  doctor_name: string;
  department: string;
  date: string;
  slot: string;
  status: 'Đã xác nhận' | 'Đang chờ' | 'Đang khám' | 'Đã khám' | 'Đã hủy' | 'Vắng mặt' | 'Xung đột';
  reason: string;
  created_at: string;
}

export interface Vitals {
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate: number | null;
  temperature: number | null;
  spo2: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  bmi: number | null;
}

export interface LabResultItem {
  id: string;
  test_name: string;
  value: string;
  unit: string;
  normal_range: string;
  flag: 'Bình thường' | 'Tăng cao' | 'Hạ thấp' | 'Bất thường' | 'Chưa đánh giá';
}

export interface PrescriptionItem {
  id: string;
  drug_name: string;
  dosage: string;
  quantity: string;
  frequency: string;
  instructions: string;
  warning?: string;
}

export interface MedicalRecord {
  id: string;
  record_code: string; // vd: HSBA-2024-001
  patient_id: string;
  patient_code: string;
  patient_name: string;
  visit_date: string;
  doctor_name: string;
  department: string;
  vitals: Vitals;
  symptoms: string;
  clinical_course: string;
  diagnosis_icd10: {
    code: string;
    description: string;
  };
  lab_results: LabResultItem[];
  prescriptions: PrescriptionItem[];
  doctor_advice: string;
  status: 'Đang điều trị' | 'Hoàn tất' | 'Chuyển tuyến' | 'Bản nháp';
}

export type ReferralPriority = 'Cấp cứu' | 'Khẩn cấp' | 'Thông thường';
export type ReferralStatus = 'Chờ duyệt' | 'Đã tiếp nhận' | 'Đang chuyển bệnh' | 'Từ chối' | 'Hoàn tất' | 'Đã hủy';

export interface Referral {
  id: string;
  referral_code: string;
  patient_id: string;
  patient_name: string;
  patient_code: string;
  from_facility: string; // Cơ sở chuyển
  to_facility: string; // Cơ sở tiếp nhận
  from_tier: string;
  to_tier: string;
  priority: ReferralPriority;
  reason: string;
  initial_diagnosis?: string;
  transfer_date: string;
  doctor_approval?: string;
  status: ReferralStatus;
  transport_type?: 'Xe cứu thương chuyên dụng' | 'Xe y tế tiêu chuẩn' | 'Tự túc có giám sát' | 'Chưa cập nhật';
}

export interface HospitalBed {
  id: string;
  bed_code: string;
  department: string;
  room: string;
  is_occupied: boolean;
  patient_name?: string;
  patient_code?: string;
  admitted_date?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user_name: string;
  user_role: UserRole;
  action: 'TẠO BỆNH ÁN' | 'SỬA BỆNH ÁN' | 'ĐẶT LỊCH KHÁM' | 'HỦY LỊCH' | 'DUYỆT CHUYỂN TUYẾN' | 'ĐIỀU PHỐI GIƯỜNG' | 'ĐĂNG NHẬP' | 'INSERT' | 'UPDATE' | 'DELETE';
  target_id: string;
  target_type: 'Hồ sơ bệnh án' | 'Lịch khám' | 'Chuyển tuyến' | 'Giường bệnh' | 'Tài khoản' | 'MEDICAL_RECORDS' | 'PATIENTS' | 'APPOINTMENTS' | 'ADMISSIONS';
  details: string;
  ip_address: string;
  old_data?: any;
  new_data?: any;
}

export interface AISearchResult {
  id: string;
  title: string;
  category: string;
  content: string;
  cosine_distance?: number; // Khoảng cách vector (0.01 - 0.40)
  similarity_score?: number; // 0% - 100%
  recommended_specialty?: string;
  urgency_level?: 'Khẩn' | 'Trung bình' | 'Thấp';
  citations?: string[];
  suggested_actions?: string[];
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export interface DepartmentLoad {
  department_id: number;
  name: string;
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
  today_appointments: number;
}

export interface DashboardAppointmentRow {
  id: string;
  patient_id: string;
  patient_code: string;
  patient_name: string;
  time_label: string; // "08:30" hoặc "08:30 - 09:00"
  department: string;
  doctor_name: string;
  status: string; // nhãn tiếng Việt: Đã xác nhận / Đang chờ / Đã khám / ...
}

export interface DashboardReferralRow {
  id: string;
  patient_name: string;
  patient_code: string;
  from_facility: string;
  to_facility: string;
  priority: ReferralPriority;
  reason: string;
}

export interface DashboardData {
  source: 'oracle' | 'local';
  today_appointments: number;
  upcoming_appointments: number;
  available_beds: number;
  total_beds: number;
  occupied_beds: number;
  pending_referrals: number;
  urgent_pending_referrals: number;
  inpatients: number;
  departments: DepartmentLoad[];
  today_list: DashboardAppointmentRow[];
  pending_referral_list: DashboardReferralRow[];
}

export interface DepartmentOption {
  id: number;
  name: string;
  available_beds: number;
  total_beds: number;
}

export interface DoctorOption {
  id: number;
  name: string;
  department_id: number;
  department: string;
}

export interface HospitalOption {
  id: number;
  name: string;
  level: string;
}

// Kết quả tìm kiếm nhanh (GET /api/search/quick)
export interface QuickPatientHit {
  id: string;
  medical_code: string;
  full_name: string;
  phone?: string;
}

export interface QuickSymptomHit {
  id: string;
  title: string;
  content: string;
  badge?: string; // chuyên khoa gợi ý (dữ liệu cục bộ) hoặc "Độ khớp 87%" (vector search)
}

export interface QuickSearchResponse {
  query: string;
  mode: 'vector' | 'keyword' | 'none';
  patients: QuickPatientHit[];
  symptoms: { id: string; title: string; content: string; score: number | null }[];
  warning?: string;
}
