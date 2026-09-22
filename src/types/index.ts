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
  blood_type: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
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
  lockedByInfo?: string;
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
  status: 'Đã xác nhận' | 'Đang chờ' | 'Đã khám' | 'Đã hủy' | 'Xung đột';
  reason: string;
  created_at: string;
}

export interface Vitals {
  blood_pressure_systolic: number; // Huyết áp tâm thu (mmHg)
  blood_pressure_diastolic: number; // Huyết áp tâm trương (mmHg)
  heart_rate: number; // Nhịp tim (bpm)
  temperature: number; // Thân nhiệt (°C)
  spo2: number; // SpO2 (%)
  height_cm: number; // Chiều cao (cm)
  weight_kg: number; // Cân nặng (kg)
  bmi: number; // Tự tính
}

export interface LabResultItem {
  id: string;
  test_name: string;
  value: string;
  unit: string;
  normal_range: string;
  flag: 'Bình thường' | 'Tăng cao' | 'Hạ thấp' | 'Bất thường';
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
export type ReferralStatus = 'Chờ duyệt' | 'Đã tiếp nhận' | 'Đang chuyển bệnh' | 'Từ chối' | 'Hoàn tất';

export interface Referral {
  id: string;
  referral_code: string;
  patient_id: string;
  patient_name: string;
  patient_code: string;
  from_facility: string; // Cơ sở chuyển
  to_facility: string; // Cơ sở tiếp nhận
  from_tier: 'Tuyến Xã/Phường' | 'Tuyến Huyện' | 'Tuyến Tỉnh' | 'Tuyến Trung Ương';
  to_tier: 'Tuyến Xã/Phường' | 'Tuyến Huyện' | 'Tuyến Tỉnh' | 'Tuyến Trung Ương';
  priority: ReferralPriority;
  reason: string;
  initial_diagnosis: string;
  transfer_date: string;
  doctor_approval: string;
  status: ReferralStatus;
  transport_type: 'Xe cứu thương chuyên dụng' | 'Xe y tế tiêu chuẩn' | 'Tự túc có giám sát';
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
  action: 'TẠO BỆNH ÁN' | 'SỬA BỆNH ÁN' | 'ĐẶT LỊCH KHÁM' | 'HỦY LỊCH' | 'DUYỆT CHUYỂN TUYẾN' | 'ĐIỀU PHỐI GIƯỜNG' | 'ĐĂNG NHẬP';
  target_id: string;
  target_type: 'Hồ sơ bệnh án' | 'Lịch khám' | 'Chuyển tuyến' | 'Giường bệnh' | 'Tài khoản';
  details: string;
  ip_address: string;
}

export interface AISearchResult {
  id: string;
  title: string;
  category: string;
  content: string;
  cosine_distance: number; // Khoảng cách vector (0.01 - 0.40)
  similarity_score: number; // 0% - 100%
  recommended_specialty: string;
  urgency_level: 'Khẩn' | 'Trung bình' | 'Thấp';
  citations?: string[];
  suggested_actions?: string[];
}
