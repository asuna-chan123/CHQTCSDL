import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Patient,
  Appointment,
  MedicalRecord,
  Referral,
  HospitalBed,
  AuditLog,
  TimeSlot,
  AISearchResult,
  PatientTimelineItem,
  DashboardData,
  DepartmentOption,
  DoctorOption,
  HospitalOption,
  QuickSearchResponse,
} from '@/types';
import { localDateStr, localDateTimeStr } from '@/lib/date';
import { apiRequest } from '@/lib/api';

// "Hôm nay" của dữ liệu mẫu: lấy theo ngày thật để Dashboard luôn có số liệu khi chạy không có Oracle
const TODAY = localDateStr();

// Mã bệnh nhân trong DB Oracle là số (vd "101"). Dữ liệu mẫu cục bộ dùng "pat-001".."pat-005"
// tương ứng PATIENT_ID 1..5 trong 02_seed.sql. Bệnh nhân tạo offline ("pat-<timestamp>") chưa có trong Oracle.
const toOracleId = (id: string): number | null => {
  if (/^\d+$/.test(id)) return Number(id);
  const seeded = /^pat-(\d{3})$/.exec(id);
  return seeded ? Number(seeded[1]) : null;
};

// Mã hồ sơ cục bộ: BN-<năm>-<số thứ tự lớn nhất + 1>, không dùng patients.length để tránh trùng mã
const nextLocalMedicalCode = (patients: Patient[]): string => {
  const prefix = `BN-${new Date().getFullYear()}-`;
  const maxSeq = patients.reduce((max, p) => {
    if (!p.medical_code.startsWith(prefix)) return max;
    const n = Number(p.medical_code.slice(prefix.length));
    return Number.isInteger(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
};

export type NewPatientInput = Omit<Patient, 'id' | 'created_at' | 'timeline' | 'medical_code'> & {
  medical_code?: string;
};

// Mock Initial Data
const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'pat-001',
    medical_code: 'BN-2024-001',
    full_name: 'Phạm Quang Minh',
    dob: '1968-05-14',
    gender: 'Nam',
    phone: '0912 345 678',
    insurance_id: 'DN-4-01-01-2093847',
    blood_type: 'O+',
    allergies: ['Penicillin', 'Aspirin'],
    address: 'Số 42 Phố Huế, Hoàn Kiếm, Hà Nội',
    status: 'Nội trú',
    department: 'Khoa Tim Mạch Can Thiệp',
    created_at: '2024-01-15',
    timeline: [
      {
        id: 'tl-1',
        date: '2024-09-20 09:30',
        type: 'record',
        title: 'Hội chẩn & Chỉ định can thiệp mạch vành',
        description: 'Chẩn đoán Đau thắt ngực không ổn định (I20.0). Chỉ định chụp MSCT động mạch vành.',
        doctor: 'BS. CKII Nguyễn Văn An',
        facility: 'Bệnh Viện Bạch Mai',
        badgeColor: 'blue',
      },
      {
        id: 'tl-2',
        date: '2024-09-18 14:15',
        type: 'referral',
        title: 'Tiếp nhận chuyển tuyến từ BVĐK Cầu Giấy',
        description: 'Ca chuyển viện cấp cứu tim mạch có bảo lãnh BHYT tuyến tỉnh.',
        facility: 'BVĐK Cầu Giấy -> Bệnh Viện Bạch Mai',
        badgeColor: 'warning',
      },
      {
        id: 'tl-3',
        date: '2024-09-15 08:00',
        type: 'appointment',
        title: 'Khám sơ bộ tại phòng khám ngoại trú',
        description: 'Bệnh nhân than phiền khó thở khi gắng sức, hồi hộp trống ngực.',
        doctor: 'BS. Trần Mai Anh',
        badgeColor: 'info',
      },
    ],
  },
  {
    id: 'pat-002',
    medical_code: 'BN-2024-002',
    full_name: 'Hoàng Thị Mai Lan',
    dob: '1975-11-23',
    gender: 'Nữ',
    phone: '0988 765 432',
    insurance_id: 'GD-2-79-01-5582910',
    blood_type: 'A+',
    allergies: ['Không ghi nhận'],
    address: '28 Đường Nguyễn Trãi, Thanh Xuân, Hà Nội',
    status: 'Ngoại trú',
    department: 'Khoa Nội Tiết & Đái Tháo Đường',
    created_at: '2024-02-10',
    timeline: [
      {
        id: 'tl-4',
        date: '2024-09-21 10:00',
        type: 'record',
        title: 'Tái khám định kỳ Đái tháo đường Type 2',
        description: 'Chỉ số HbA1c: 6.8%, đường huyết đói 6.2 mmol/L. Điều chỉnh liều Metformin.',
        doctor: 'BS. Lê Thị Bích Ngọc',
        facility: 'Bệnh Viện Bạch Mai',
        badgeColor: 'blue',
      },
      {
        id: 'tl-5',
        date: '2024-08-20 08:30',
        type: 'appointment',
        title: 'Khám xét nghiệm sinh hóa máu',
        description: 'Đánh giá chức năng gan, thận và bilan lipid máu.',
        doctor: 'BS. Lê Thị Bích Ngọc',
        badgeColor: 'info',
      },
    ],
  },
  {
    id: 'pat-003',
    medical_code: 'BN-2024-003',
    full_name: 'Vũ Đình Cường',
    dob: '1952-03-08',
    gender: 'Nam',
    phone: '0903 112 334',
    insurance_id: 'HT-1-01-02-3394851',
    blood_type: 'B+',
    allergies: ['Sulfonamides'],
    address: 'Khu Đô Thị Ecopark, Văn Giang, Hưng Yên',
    status: 'Nội trú',
    department: 'Khoa Hô Hấp',
    created_at: '2024-03-01',
    timeline: [
      {
        id: 'tl-6',
        date: '2024-09-22 06:45',
        type: 'record',
        title: 'Theo dõi đợt cấp COPD mức độ nặng',
        description: 'SpO2 92% có thở oxy kính 2L/phút. Phun khí dung Combivent + Pulmicort.',
        doctor: 'BS. Nguyễn Văn An',
        facility: 'Bệnh Viện Bạch Mai',
        badgeColor: 'destructive',
      },
      {
        id: 'tl-7',
        date: '2024-09-21 21:30',
        type: 'admission',
        title: 'Nhập viện cấp cứu ban đêm',
        description: 'Khó thở thì thở ra dữ dội, co kéo cơ hô hấp phụ.',
        facility: 'Khoa Cấp Cứu A9',
        badgeColor: 'warning',
      },
    ],
  },
  {
    id: 'pat-004',
    medical_code: 'BN-2024-004',
    full_name: 'Đặng Thúy Ngân',
    dob: '1992-09-30',
    gender: 'Nữ',
    phone: '0975 443 221',
    insurance_id: 'CA-3-01-03-9948210',
    blood_type: 'AB+',
    allergies: ['Hải sản'],
    address: 'Phường Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
    status: 'Chờ khám',
    department: 'Khoa Tiêu Hóa',
    created_at: '2024-04-12',
    timeline: [
      {
        id: 'tl-8',
        date: '2024-09-22 08:30',
        type: 'appointment',
        title: 'Đăng ký khám nội soi dạ dày đại tràng gây mê',
        description: 'Đau tức thượng vị âm ỉ kèm ợ hơi, sụt cân nhẹ.',
        doctor: 'BS. Trần Văn Hùng',
        badgeColor: 'info',
      },
    ],
  },
  {
    id: 'pat-005',
    medical_code: 'BN-2024-005',
    full_name: 'Trịnh Quốc Bảo',
    dob: '1984-12-05',
    gender: 'Nam',
    phone: '0936 889 900',
    insurance_id: 'QN-5-01-04-7749201',
    blood_type: 'O-',
    allergies: ['Không ghi nhận'],
    address: 'Phường Hồng Gai, TP. Hạ Long, Quảng Ninh',
    status: 'Đã xuất viện',
    department: 'Khoa Chấn Thương Chỉnh Hình',
    created_at: '2024-05-18',
    timeline: [
      {
        id: 'tl-9',
        date: '2024-09-10 11:00',
        type: 'record',
        title: 'Xuất viện sau phẫu thuật nội soi khớp gối',
        description: 'Phục hồi tốt, tập đi với nạng, hẹn tái khám sau 4 tuần.',
        doctor: 'BS. Lê Mạnh Thắng',
        facility: 'Bệnh Viện Việt Đức',
        badgeColor: 'blue',
      },
    ],
  },
];

const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-001',
    patient_id: 'pat-001',
    patient_code: 'BN-2024-001',
    patient_name: 'Phạm Quang Minh',
    doctor_name: 'BS. CKII Nguyễn Văn An',
    department: 'Khoa Tim Mạch Can Thiệp',
    date: TODAY,
    slot: '08:30 - 09:00',
    status: 'Đã xác nhận',
    reason: 'Tái khám định kỳ van tim & kiểm tra điện tâm đồ',
    created_at: '2026-09-20 14:00',
  },
  {
    id: 'apt-002',
    patient_id: 'pat-002',
    patient_code: 'BN-2024-002',
    patient_name: 'Hoàng Thị Mai Lan',
    doctor_name: 'BS. Lê Thị Bích Ngọc',
    department: 'Khoa Nội Tiết & Đái Tháo Đường',
    date: TODAY,
    slot: '09:30 - 10:00',
    status: 'Đã xác nhận',
    reason: 'Đánh giá đường huyết & chỉ định thuốc thế hệ mới',
    created_at: '2026-09-21 09:15',
  },
  {
    id: 'apt-003',
    patient_id: 'pat-004',
    patient_code: 'BN-2024-004',
    patient_name: 'Đặng Thúy Ngân',
    doctor_name: 'BS. Trần Văn Hùng',
    department: 'Khoa Tiêu Hóa',
    date: TODAY,
    slot: '10:00 - 10:30',
    status: 'Đang chờ',
    reason: 'Nội soi dạ dày gây mê',
    created_at: '2026-09-21 16:30',
  },
];

// Time slots for demo and concurrency handling
export const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { time: '08:00 - 08:30', period: 'Sáng', isAvailable: false },
  { time: '08:30 - 09:00', period: 'Sáng', isAvailable: false },
  {
    time: '09:00 - 09:30',
    period: 'Sáng',
    isAvailable: false,
    isLockedByOther: true, // Slot bị giữ mô phỏng xung đột đồng thời!
    lockedBy: 'Quầy Tiếp Đón 02 (Yêu cầu đặt lịch #REQ-9821)',
    lockedByInfo: 'Đang bị giữ bởi Quầy Tiếp Đón 02 (Yêu cầu đặt lịch #REQ-9821)',
  },
  { time: '09:30 - 10:00', period: 'Sáng', isAvailable: false },
  { time: '10:00 - 10:30', period: 'Sáng', isAvailable: true },
  { time: '10:30 - 11:00', period: 'Sáng', isAvailable: true },
  { time: '11:00 - 11:30', period: 'Sáng', isAvailable: true },
  { time: '13:30 - 14:00', period: 'Chiều', isAvailable: true },
  { time: '14:00 - 14:30', period: 'Chiều', isAvailable: true },
  { time: '14:30 - 15:00', period: 'Chiều', isAvailable: true },
  { time: '15:00 - 15:30', period: 'Chiều', isAvailable: true },
  { time: '15:30 - 16:00', period: 'Chiều', isAvailable: true },
];

const INITIAL_RECORDS: MedicalRecord[] = [
  {
    id: 'rec-001',
    record_code: 'HSBA-2024-001',
    patient_id: 'pat-001',
    patient_code: 'BN-2024-001',
    patient_name: 'Phạm Quang Minh',
    visit_date: '2026-09-22',
    doctor_name: 'BS. CKII Nguyễn Văn An',
    department: 'Khoa Tim Mạch Can Thiệp',
    vitals: {
      blood_pressure_systolic: 145,
      blood_pressure_diastolic: 92,
      heart_rate: 88,
      temperature: 36.8,
      spo2: 97,
      height_cm: 168,
      weight_kg: 72,
      bmi: 25.5,
    },
    symptoms: 'Bệnh nhân cảm thấy hồi hộp, đau tức nhẹ vùng sau xương ức khi leo cầu thang, kèm mệt mỏi vào buổi chiều.',
    clinical_course: 'Tiền sử tăng huyết áp 5 năm điều trị không liên tục. Điện tâm đồ ghi nhận dày thất trái, thiếu máu cơ tim cục bộ thành dưới.',
    diagnosis_icd10: {
      code: 'I20.0',
      description: 'Đau thắt ngực không ổn định (Unstable angina pectoris)',
    },
    lab_results: [
      {
        id: 'lab-1',
        test_name: 'Troponin T độ nhạy cao (hs-cTnT)',
        value: '14.2',
        unit: 'ng/L',
        normal_range: '< 14.0',
        flag: 'Tăng cao',
      },
      {
        id: 'lab-2',
        test_name: 'Cholesterol toàn phần',
        value: '6.4',
        unit: 'mmol/L',
        normal_range: '3.9 - 5.2',
        flag: 'Tăng cao',
      },
      {
        id: 'lab-3',
        test_name: 'LDL-Cholesterol',
        value: '4.1',
        unit: 'mmol/L',
        normal_range: '< 3.4',
        flag: 'Tăng cao',
      },
      {
        id: 'lab-4',
        test_name: 'Glucose máu lúc đói',
        value: '5.6',
        unit: 'mmol/L',
        normal_range: '3.9 - 6.4',
        flag: 'Bình thường',
      },
    ],
    prescriptions: [
      {
        id: 'rx-1',
        drug_name: 'Aspirin (Cardipirin)',
        dosage: '100mg',
        quantity: '30 viên',
        frequency: 'Uống 1 viên / ngày sau ăn trưa',
        instructions: 'Uống nguyên viên với nhiều nước, không nhai bẻ viên thuốc',
        warning: 'Lưu ý tiền sử xuất huyết tiêu hóa',
      },
      {
        id: 'rx-2',
        drug_name: 'Atorvastatin (Lipitor)',
        dosage: '20mg',
        quantity: '30 viên',
        frequency: 'Uống 1 viên / tối trước khi đi ngủ',
        instructions: 'Tránh ăn bưởi chùm trong thời gian dùng thuốc',
      },
      {
        id: 'rx-3',
        drug_name: 'Amlodipine (Norvasc)',
        dosage: '5mg',
        quantity: '30 viên',
        frequency: 'Uống 1 viên / sáng sau ăn',
        instructions: 'Theo dõi huyết áp hằng ngày',
      },
    ],
    doctor_advice: 'Hạn chế ăn mặn (<5g muối/ngày), ngưng hoàn toàn hút thuốc lá, nghỉ ngơi tránh căng thẳng. Hẹn tái khám sau 2 tuần hoặc đến viện ngay nếu đau ngực dữ dội kéo dài trên 15 phút.',
    status: 'Đang điều trị',
  },
];

const INITIAL_REFERRALS: Referral[] = [
  {
    id: 'ref-001',
    referral_code: 'CT-2024-889',
    patient_id: 'pat-001',
    patient_name: 'Phạm Quang Minh',
    patient_code: 'BN-2024-001',
    from_facility: 'BVĐK Tỉnh Hải Dương',
    to_facility: 'Bệnh Viện Bạch Mai (Hà Nội)',
    from_tier: 'Tuyến Tỉnh',
    to_tier: 'Tuyến Trung Ương',
    priority: 'Khẩn cấp',
    reason: 'Vượt quá khả năng can thiệp mạch vành chuyên sâu tại tuyến cơ sở',
    initial_diagnosis: 'Hội chứng vành cấp nghi tắc nhánh LAD',
    transfer_date: '2026-09-22 07:30',
    doctor_approval: 'BS. CKII Lê Văn Thành (GĐ BV Tỉnh)',
    status: 'Đã tiếp nhận',
    transport_type: 'Xe cứu thương chuyên dụng',
  },
  {
    id: 'ref-002',
    referral_code: 'CT-2024-890',
    patient_id: 'pat-003',
    patient_name: 'Vũ Đình Cường',
    patient_code: 'BN-2024-003',
    from_facility: 'Trạm Y Tế Xã Đa Tốn',
    to_facility: 'BVĐK Huyện Gia Lâm',
    from_tier: 'Tuyến Xã/Phường',
    to_tier: 'Tuyến Huyện',
    priority: 'Cấp cứu',
    reason: 'Suy hô hấp cấp trên nền bệnh nhân COPD tiến triển, thiếu máy thở HFNC',
    initial_diagnosis: 'Đợt cấp COPD suy hô hấp type 2',
    transfer_date: '2026-09-22 08:15',
    doctor_approval: 'Y sĩ Trưởng trạm Hoàng Lan',
    status: 'Đang chuyển bệnh',
    transport_type: 'Xe cứu thương chuyên dụng',
  },
  {
    id: 'ref-003',
    referral_code: 'CT-2024-891',
    patient_id: 'pat-005',
    patient_name: 'Trịnh Quốc Bảo',
    patient_code: 'BN-2024-005',
    from_facility: 'BVĐK Huyện Cẩm Phả',
    to_facility: 'Bệnh Viện Hữu Nghị Việt Đức',
    from_tier: 'Tuyến Huyện',
    to_tier: 'Tuyến Trung Ương',
    priority: 'Thông thường',
    reason: 'Chỉ định phẫu thuật tái tạo dây chằng chéo trước khớp gối chuyên sâu',
    initial_diagnosis: 'Đứt hoàn toàn ACL gối phải do chấn thương thể thao',
    transfer_date: '2026-09-21 15:00',
    doctor_approval: 'BS. CKI Đỗ Đình Dũng',
    status: 'Chờ duyệt',
    transport_type: 'Tự túc có giám sát',
  },
];

const INITIAL_BEDS: HospitalBed[] = [
  { id: 'bed-101', bed_code: 'G-101', department: 'Hồi Sức Tích Cực (ICU)', room: 'Phòng Áp Lực Âm 01', is_occupied: true, patient_name: 'Vũ Đình Cường', patient_code: 'BN-2024-003', admitted_date: '2026-09-21' },
  { id: 'bed-102', bed_code: 'G-102', department: 'Hồi Sức Tích Cực (ICU)', room: 'Phòng Áp Lực Âm 02', is_occupied: false },
  { id: 'bed-103', bed_code: 'G-103', department: 'Hồi Sức Tích Cực (ICU)', room: 'Phòng Theo Dõi 01', is_occupied: false },
  { id: 'bed-201', bed_code: 'G-201', department: 'Khoa Tim Mạch Can Thiệp', room: 'Phòng Nội Trú 201', is_occupied: true, patient_name: 'Phạm Quang Minh', patient_code: 'BN-2024-001', admitted_date: '2026-09-20' },
  { id: 'bed-202', bed_code: 'G-202', department: 'Khoa Tim Mạch Can Thiệp', room: 'Phòng Nội Trú 201', is_occupied: false },
  { id: 'bed-203', bed_code: 'G-203', department: 'Khoa Tim Mạch Can Thiệp', room: 'Phòng Nội Trú 202', is_occupied: false },
  { id: 'bed-301', bed_code: 'G-301', department: 'Khoa Hô Hấp', room: 'Phòng 301', is_occupied: false },
  { id: 'bed-302', bed_code: 'G-302', department: 'Khoa Hô Hấp', room: 'Phòng 301', is_occupied: true, patient_name: 'Trần Văn Tiến', patient_code: 'BN-2024-012', admitted_date: '2026-09-19' },
  { id: 'bed-401', bed_code: 'G-401', department: 'Khoa Cấp Cứu A9', room: 'Khu Vực Lưu Bệnh 01', is_occupied: false },
  { id: 'bed-402', bed_code: 'G-402', department: 'Khoa Cấp Cứu A9', room: 'Khu Vực Lưu Bệnh 01', is_occupied: false },
];

const INITIAL_LOGS: AuditLog[] = [
  {
    id: 'log-001',
    timestamp: '2026-09-22 09:15:22',
    user_name: 'BS. CKII Nguyễn Văn An',
    user_role: 'doctor',
    action: 'TẠO BỆNH ÁN',
    target_id: 'HSBA-2024-001',
    target_type: 'Hồ sơ bệnh án',
    details: 'Khởi tạo hồ sơ lâm sàng cho bệnh nhân Phạm Quang Minh (BN-2024-001). Cập nhật sinh tồn: HA 145/92 mmHg, kê đơn 3 loại thuốc.',
    ip_address: '192.168.1.104',
  },
  {
    id: 'log-002',
    timestamp: '2026-09-22 08:30:10',
    user_name: 'ĐD. Trần Thị Mai',
    user_role: 'nurse',
    action: 'ĐIỀU PHỐI GIƯỜNG',
    target_id: 'G-201',
    target_type: 'Giường bệnh',
    details: 'Xếp bệnh nhân Phạm Quang Minh vào giường G-201 Khoa Tim Mạch.',
    ip_address: '192.168.1.55',
  },
  {
    id: 'log-003',
    timestamp: '2026-09-22 07:45:00',
    user_name: 'BS. CKII Lê Văn Thành',
    user_role: 'doctor',
    action: 'DUYỆT CHUYỂN TUYẾN',
    target_id: 'CT-2024-889',
    target_type: 'Chuyển tuyến',
    details: 'Phê duyệt giấy chuyển viện khẩn cấp ca bệnh nghi tắc LAD sang Bệnh Viện Bạch Mai.',
    ip_address: '10.20.4.12',
  },
  {
    id: 'log-004',
    timestamp: '2026-09-21 16:30:45',
    user_name: 'Lê Hoàng Nam (Admin)',
    user_role: 'admin',
    action: 'ĐĂNG NHẬP',
    target_id: 'usr-adm-01',
    target_type: 'Tài khoản',
    details: 'Đăng nhập thành công từ thiết bị quản trị trung tâm phòng CNTT.',
    ip_address: '192.168.1.2',
  },
];

export const AI_SYMPTOM_DATABASE: AISearchResult[] = [
  {
    id: 'sym-1',
    title: 'Hội chứng vành cấp / Đau thắt ngực không ổn định',
    category: 'Tim Mạch Can Thiệp',
    content: 'Đau thắt ngực vùng sau xương ức, cảm giác đè nặng bóp nghẹt, lan lên hàm dưới, vai trái hoặc mặt trong cánh tay trái. Thường khởi phát khi gắng sức hoặc xúc cảm mạnh, kèm vã mồ hôi, khó thở, buồn nôn.',
    cosine_distance: 0.084,
    similarity_score: 96.2,
    recommended_specialty: 'Khoa Cấp Cứu / Tim Mạch Can Thiệp',
    urgency_level: 'Khẩn',
    citations: ['Hướng dẫn chẩn đoán HCVC - Hội Tim Mạch Học Việt Nam (VNHA 2022)', 'ESC Guidelines on NSTE-ACS'],
    suggested_actions: ['Đo điện tâm đồ 12 chuyển đạo trong vòng 10 phút', 'Định lượng men tim hs-cTnT/I', 'Chống ngưng tập tiểu cầu kép'],
  },
  {
    id: 'sym-2',
    title: 'Đợt cấp Bệnh phổi tắc nghẽn mạn tính (COPD)',
    category: 'Hô Hấp',
    content: 'Bệnh nhân có tiền sử hút thuốc lá nhiều năm, xuất hiện khó thở tăng dần, ho khạc đờm nhiều, thay đổi màu sắc đờm sang đờm mủ đục. Thở khò khè thì thở ra, co kéo hõm ức.',
    cosine_distance: 0.125,
    similarity_score: 91.8,
    recommended_specialty: 'Khoa Hô Hấp',
    urgency_level: 'Khẩn',
    citations: ['GOLD Report 2024', 'Hướng dẫn chẩn đoán và điều trị COPD - Bộ Y Tế 2023'],
    suggested_actions: ['Thở oxy liều thấp kiểm soát SpO2 88-92%', 'Phun khí dung giãn phế quản tác dụng ngắn SABA + SAMA', 'Kháng sinh theo tiêu chuẩn Anthonisen'],
  },
  {
    id: 'sym-3',
    title: 'Cơn bão giáp trạng / Nhiễm độc giáp cấp',
    category: 'Nội Tiết',
    content: 'Sốt cao 39-40 độ C, nhịp tim rất nhanh > 140 bpm, rối loạn nhịp tim (rung nhĩ), bồn chồn kích động, nôn mửa, tiêu chảy, vàng da nhẹ, tiền sử bệnh Basedow.',
    cosine_distance: 0.198,
    similarity_score: 84.5,
    recommended_specialty: 'Khoa Hồi Sức Tích Cực / Nội Tiết',
    urgency_level: 'Khẩn',
    citations: ['Burch-Wartofsky Point Scale for Thyrotoxicosis', 'Hướng dẫn xử trí cấp cứu Nội tiết'],
    suggested_actions: ['Thang điểm Burch-Wartofsky', 'Thuốc kháng giáp Propylthiouracil (PTU) liều tải', 'Chẹn beta propranolol và hạ sốt'],
  },
  {
    id: 'sym-4',
    title: 'Trào ngược dạ dày thực quản (GERD)',
    category: 'Tiêu Hóa',
    content: 'Ợ chua, ợ nóng sau xương ức, cảm giác vướng ở cổ họng hạt đờm, ho khan kéo dài về đêm khi nằm ngửa, tăng nặng sau khi ăn no hoặc dùng thức uống có ga/cà phê.',
    cosine_distance: 0.231,
    similarity_score: 79.4,
    recommended_specialty: 'Khoa Tiêu Hóa',
    urgency_level: 'Trung bình',
    citations: ['ACG Guidelines for the Diagnosis and Management of GERD', 'Hội Khoa Học Tiêu Hóa Việt Nam'],
    suggested_actions: ['Thử nghiệm điều trị ức chế bơm proton PPI 4-8 tuần', 'Nội soi thực quản dạ dày nếu có dấu hiệu báo động (nuốt nghẹn, sụt cân)'],
  },
];

export const AI_MEDICAL_DOCS: AISearchResult[] = [
  {
    id: 'doc-1',
    title: 'Phác đồ chẩn đoán và điều trị Sốt xuất huyết Dengue người lớn (Quyết định 2760/QĐ-BYT)',
    category: 'Truyền Nhiễm / Bộ Y Tế',
    content: 'Tiêu chuẩn chẩn đoán SXH Dengue có dấu hiệu cảnh báo: vật vã lừ đừ, đau bụng nhiều vùng gan, nôn ói liên tục >= 3 lần/1h, xuất huyết niêm mạc (chảy máu cam, chân răng), tiểu ít, Hct tăng cao đi kèm tiểu cầu giảm nhanh < 100 G/L.',
    cosine_distance: 0.092,
    similarity_score: 95.1,
    recommended_specialty: 'Khoa Truyền Nhiễm & Cấp Cứu',
    urgency_level: 'Khẩn',
    citations: ['Quyết định 2760/QĐ-BYT ngày 04/07/2023 của Bộ Y Tế', 'Tổ chức Y tế Thế giới (WHO Dengue Guidelines)'],
    suggested_actions: ['Theo dõi sát Hct mỗi 2-4 giờ', 'Bù dịch đẳng trương Ringer Lactate kịp thời khi có dấu hiệu cảnh báo', 'Không truyền dịch ồ ạt khi chưa có chỉ định'],
  },
  {
    id: 'doc-2',
    title: 'Khuyến cáo quản lý Tăng huyết áp người lớn - Phân tầng nguy cơ tim mạch (VNHA/VSH 2022)',
    category: 'Tim Mạch / Hướng dẫn Quốc gia',
    content: 'Ngưỡng chẩn đoán THA tại phòng khám: Huyết áp tâm thu >= 140 mmHg và/hoặc Huyết áp tâm trương >= 90 mmHg. Mục tiêu điều trị đưa về < 130/80 mmHg nếu dung nạp tốt. Khởi đầu phối hợp 2 thuốc liều thấp (ACEi/ARB + CCB hoặc Lợi tiểu thiazide-like) cho hầu hết bệnh nhân THA độ 2 trở lên.',
    cosine_distance: 0.114,
    similarity_score: 92.6,
    recommended_specialty: 'Khoa Khám Bệnh / Tim Mạch',
    urgency_level: 'Trung bình',
    citations: ['Hội Tim Mạch Học Việt Nam (VNHA)', 'Phân hội Tăng Huyết Áp Việt Nam (VSH)'],
    suggested_actions: ['Đo HA lưu động 24h (ABPM) loại trừ THA áo choàng trắng', 'Đánh giá tổn thương cơ quan đích (vi đạm niệu, dày thất trái)'],
  },
  {
    id: 'doc-3',
    title: 'Quy trình Chuyển tuyến khám bệnh, chữa bệnh Bảo hiểm y tế (Thông tư 14/2014/TT-BYT)',
    category: 'Chính Sách & Pháp Lý Y Tế',
    content: 'Quy định các trường hợp chuyển tuyến kỹ thuật: chuyển từ tuyến dưới lên tuyến trên khi cơ sở không đủ điều kiện nhân lực, trang thiết bị; chuyển từ tuyến trên về tuyến dưới khi tình trạng bệnh đã ổn định để tiếp tục quản lý, điều trị ngoại trú; chuyển tuyến giữa các cơ sở cùng tuyến.',
    cosine_distance: 0.165,
    similarity_score: 87.2,
    recommended_specialty: 'Phòng Kế Hoạch Tổng Hợp / Quản Trị Y Tế',
    urgency_level: 'Thấp',
    citations: ['Thông tư số 14/2014/TT-BYT', 'Luật Khám bệnh, chữa bệnh sửa đổi 2023'],
    suggested_actions: ['Lập Giấy chuyển tuyến mẫu số 01', 'Kèm bản tóm tắt hồ sơ bệnh án và kết quả xét nghiệm liên quan'],
  },
];

interface MedicalStoreContextType {
  // Patients
  patients: Patient[];
  addPatient: (patient: NewPatientInput) => Promise<Patient>;
  refreshPatients: () => Promise<void>;
  fetchPatientTimeline: (patientId: string) => Promise<PatientTimelineItem[] | null>;
  quickSearch: (query: string, signal?: AbortSignal) => Promise<QuickSearchResponse | null>;
  updatePatient: (id: string, updates: Partial<Patient>) => void;
  getPatientById: (id: string) => Patient | undefined;
  getPatientByCode: (code: string) => Patient | undefined;
  
  // Appointments
  appointments: Appointment[];
  refreshAppointments: () => Promise<void>;
  timeSlots: TimeSlot[];
  addAppointment: (
    patientId: string,
    doctorName: string,
    department: string,
    date: string,
    slot: string,
    reason: string
  ) => Promise<{ success: boolean; error?: string; appointment?: Appointment }>;
  cancelAppointment: (id: string) => Promise<void>;
  updateAppointmentStatus: (id: string, status: Appointment['status']) => Promise<void>;
  toggleSlotConflictSimulation: (slotTime: string) => void;

  // Medical Records
  records: MedicalRecord[];
  addRecord: (record: Omit<MedicalRecord, 'id' | 'record_code'>) => Promise<MedicalRecord>;
  updateRecord: (id: string, updates: Partial<MedicalRecord>) => Promise<void>;
  getRecordByPatientId: (patientId: string) => MedicalRecord | undefined;

  // Referrals
  referrals: Referral[];
  refreshReferrals: () => Promise<void>;
  addReferral: (referral: Omit<Referral, 'id' | 'referral_code'>) => Promise<Referral>;
  updateReferralStatus: (id: string, status: Referral['status']) => Promise<void>;

  // Hospital Beds & Admissions
  beds: HospitalBed[];
  toggleBedStatus: (bedId: string) => void;
  admitPatient: (patientId: string, departmentId: number) => Promise<{ success: boolean; admission_id?: number; error?: string }>;
  dischargePatient: (patientId: string) => Promise<{ success: boolean; admission_id?: number; error?: string }>;

  // Audit Logs
  logs: AuditLog[];
  refreshAuditLogs: () => Promise<void>;
  addLog: (action: AuditLog['action'], targetId: string, targetType: AuditLog['target_type'], details: string) => void;

  // Dashboard & danh mục khoa
  dashboard: DashboardData;
  refreshDashboard: () => Promise<void>;
  departments: DepartmentOption[];
  refreshDepartments: () => Promise<void>;
  doctors: DoctorOption[];
  refreshDoctors: () => Promise<void>;
  hospitals: HospitalOption[];
  refreshHospitals: () => Promise<void>;

  // Quick stats
  stats: {
    todayAppointments: number;
    availableBeds: number;
    totalBeds: number;
    pendingReferrals: number;
    totalInpatients: number;
  };
  isOracleConnected: boolean;
}

// Biến dòng bệnh nhân Oracle thành Patient của UI.
// DB chưa có cột nhóm máu / BHYT / dị ứng nên các trường này chỉ lấy từ dữ liệu cục bộ (nếu có),
// KHÔNG tự bịa giá trị mặc định (ví dụ nhóm máu O+) vì đây là dữ liệu y tế.
const mapOraclePatients = (dbPatients: any[], prev: Patient[]): Patient[] =>
  dbPatients.map((p) => {
    const existing = prev.find((item) => item.medical_code === p.medical_code);
    return {
      id: String(p.id),
      medical_code: p.medical_code,
      full_name: p.full_name,
      dob: p.dob || '',
      gender: p.gender || 'Khác',
      phone: p.phone || '',
      insurance_id: existing?.insurance_id || '',
      blood_type: existing?.blood_type || 'Chưa rõ',
      allergies: existing?.allergies || ['Không ghi nhận'],
      address: p.address || '',
      // Trạng thái & khoa do Oracle suy ra từ lịch khám / nhập viện nên luôn lấy từ DB
      status: (p.status || existing?.status || 'Ngoại trú') as Patient['status'],
      department: p.department || existing?.department || 'Chưa phân khoa',
      created_at: p.created_at || localDateStr(),
      timeline: existing?.timeline || [],
    };
  });

const appointmentStatusLabels: Record<string, Appointment['status']> = {
  CREATED: 'Đang chờ',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đang chờ',
  IN_PROGRESS: 'Đang khám',
  COMPLETED: 'Đã khám',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Vắng mặt',
  SCHEDULED: 'Đã xác nhận',
};

const mapOracleAppointments = (rows: Array<Record<string, unknown>>): Appointment[] =>
  rows.map((row) => {
    const scheduledAt = String(row.scheduled_at || '').replace(' ', 'T');
    const [date, time = ''] = scheduledAt.split('T');
    const match = /^(\d{2}):(\d{2})/.exec(time);
    if (!date || !match) {
      throw new Error(`Lịch khám #${String(row.id)} có thời gian không hợp lệ.`);
    }
    const status = appointmentStatusLabels[String(row.status)];
    if (!status) {
      throw new Error(`Lịch khám #${String(row.id)} có trạng thái không được hỗ trợ.`);
    }

    const startMinutes = Number(match[1]) * 60 + Number(match[2]);
    const endMinutes = startMinutes + 30;
    const formatTime = (minutes: number) =>
      `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

    return {
      id: String(row.id),
      patient_id: String(row.patient_id),
      patient_code: String(row.medical_code || ''),
      patient_name: String(row.patient_name || ''),
      doctor_name: String(row.doctor_name || ''),
      department: String(row.department || ''),
      date,
      slot: `${formatTime(startMinutes)} - ${formatTime(endMinutes)}`,
      status,
      reason: String(row.symptoms || ''),
      created_at: scheduledAt,
    };
  });

const parseRecordJson = (value: unknown, recordId: string): Record<string, unknown> => {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Dữ liệu bệnh án #${recordId} từ API không hợp lệ.`);
  }
  return parsed as Record<string, unknown>;
};

const mapOracleRecords = (rows: Array<Record<string, unknown>>): MedicalRecord[] =>
  rows.map((row) => {
    const id = String(row.id);
    const data = parseRecordJson(row.record_json, id);
    const clinical = data.clinical_examination && typeof data.clinical_examination === 'object'
      ? data.clinical_examination as Record<string, unknown>
      : {};
    const sourceVitalsValue = data.vitals || clinical.vitals;
    const sourceVitals = sourceVitalsValue && typeof sourceVitalsValue === 'object'
      ? sourceVitalsValue as Record<string, unknown>
      : {};
    const bloodPressure = String(sourceVitals.blood_pressure || '').match(/^\s*(\d+)\s*\/\s*(\d+)/);
    const numberOrNull = (value: unknown): number | null =>
      typeof value === 'number' && Number.isFinite(value) ? value : null;
    const systolic = numberOrNull(sourceVitals.blood_pressure_systolic) ??
      (bloodPressure ? Number(bloodPressure[1]) : null);
    const diastolic = numberOrNull(sourceVitals.blood_pressure_diastolic) ??
      (bloodPressure ? Number(bloodPressure[2]) : null);
    const height = numberOrNull(sourceVitals.height_cm);
    const weight = numberOrNull(sourceVitals.weight_kg);
    const bmi = numberOrNull(sourceVitals.bmi) ??
      (height && weight ? Number((weight / ((height / 100) ** 2)).toFixed(1)) : null);
    const diagnosisValue = data.diagnosis_icd10 || clinical.diagnosis ||
      (Array.isArray(data.diagnoses) ? data.diagnoses[0] : undefined);
    const diagnosis = diagnosisValue && typeof diagnosisValue === 'object'
      ? diagnosisValue as Record<string, unknown>
      : {};
    const sourceSymptoms = data.symptoms ?? clinical.chief_complaint;
    const symptoms = Array.isArray(sourceSymptoms)
      ? sourceSymptoms.map((item) => {
          if (!item || typeof item !== 'object') return String(item || '');
          const symptom = item as Record<string, unknown>;
          const details = [
            symptom.severity != null ? `mức độ ${String(symptom.severity)}/10` : '',
            symptom.duration ? `kéo dài ${String(symptom.duration)}` : '',
          ].filter(Boolean);
          const name = String(symptom.name || '');
          return details.length ? `${name} (${details.join(', ')})` : name;
        }).filter(Boolean).join('; ')
      : String(sourceSymptoms || '');
    const labResults = Array.isArray(data.lab_results)
      ? data.lab_results
      : Array.isArray(data.diagnostic_lab_results) ? data.diagnostic_lab_results : [];
    const medications = Array.isArray(data.prescriptions)
      ? data.prescriptions
      : Array.isArray(data.medications) ? data.medications
      : Array.isArray(data.medications_prescribed) ? data.medications_prescribed : [];
    const createdAt = String(row.created_at || '');
    const diagnosisCode = String(diagnosis.code || diagnosis.icd10_code || '');
    const diagnosisDescription = String(
      diagnosis.description || diagnosis.name || diagnosis.icd10_text || row.diagnosis_summary || ''
    );

    return {
      id,
      record_code: String(data.record_code || `HSBA-${createdAt.slice(0, 4)}-${id}`),
      patient_id: String(row.patient_id),
      patient_code: String(row.patient_code || data.patient_code || ''),
      patient_name: String(row.patient_name || data.patient_name || ''),
      visit_date: createdAt.slice(0, 10),
      doctor_name: String(row.doctor_name || ''),
      department: String(row.department || ''),
      vitals: {
        blood_pressure_systolic: systolic,
        blood_pressure_diastolic: diastolic,
        heart_rate: numberOrNull(sourceVitals.heart_rate ?? sourceVitals.heart_rate_bpm),
        temperature: numberOrNull(sourceVitals.temperature ?? sourceVitals.temperature_celsius),
        spo2: numberOrNull(sourceVitals.spo2 ?? sourceVitals.spo2_percentage),
        height_cm: height,
        weight_kg: weight,
        bmi,
      },
      symptoms,
      clinical_course: String(data.clinical_course || data.notes || clinical.clinical_notes || ''),
      diagnosis_icd10: {
        code: diagnosisCode,
        description: diagnosisDescription,
      },
      lab_results: labResults.map((item, index) => {
        const lab = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return {
          id: String(lab.id || index + 1),
          test_name: String(lab.test_name || lab.test || ''),
          value: String(lab.value ?? ''),
          unit: String(lab.unit || ''),
          normal_range: String(lab.normal_range || ''),
          flag: lab.flag === 'Bình thường' || lab.flag === 'Tăng cao' ||
            lab.flag === 'Hạ thấp' || lab.flag === 'Bất thường'
            ? lab.flag
            : 'Chưa đánh giá',
        };
      }),
      prescriptions: medications.map((item, index) => {
        const medication = item && typeof item === 'object'
          ? item as Record<string, unknown>
          : {};
        return {
          id: String(medication.id || index + 1),
          drug_name: String(medication.drug_name || medication.name || ''),
          dosage: String(medication.dosage || medication.dose || ''),
          quantity: String(medication.quantity || ''),
          frequency: String(medication.frequency || ''),
          instructions: String(medication.instructions || ''),
          ...(medication.warning ? { warning: String(medication.warning) } : {}),
        };
      }),
      doctor_advice: String(data.doctor_advice || data.doctor_recommendation || ''),
      status: 'Đang điều trị',
    };
  });

const referralPriorityLabels: Record<string, Referral['priority']> = {
  EMERGENCY: 'Cấp cứu',
  URGENT: 'Khẩn cấp',
  NORMAL: 'Thông thường',
};

const referralStatusLabels: Record<string, Referral['status']> = {
  PENDING: 'Chờ duyệt',
  ACCEPTED: 'Đã tiếp nhận',
  REJECTED: 'Từ chối',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

const mapOracleReferrals = (rows: Array<Record<string, unknown>>): Referral[] =>
  rows.map((row) => {
    const id = String(row.id);
    const priority = referralPriorityLabels[String(row.urgency)];
    const status = referralStatusLabels[String(row.status)];
    if (!priority || !status) {
      throw new Error(`Phiếu chuyển tuyến #${id} có mức độ hoặc trạng thái không hợp lệ.`);
    }

    return {
      id,
      referral_code: `CT-${new Date().getFullYear()}-${id}`,
      patient_id: String(row.patient_id),
      patient_name: String(row.patient_name || ''),
      patient_code: String(row.medical_code || ''),
      from_facility: String(row.from_hospital || ''),
      to_facility: String(row.to_hospital || ''),
      from_tier: String(row.from_level || 'Chưa phân loại'),
      to_tier: String(row.to_level || 'Chưa phân loại'),
      priority,
      reason: String(row.reason || ''),
      transfer_date: String(row.referral_time || ''),
      doctor_approval: row.doctor_name ? String(row.doctor_name) : undefined,
      status,
      transport_type: 'Chưa cập nhật',
    };
  });

const MedicalStoreContext = createContext<MedicalStoreContextType | undefined>(undefined);

export const MedicalStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize state with localStorage persistence
  const [patients, setPatients] = useState<Patient[]>(() => {
    const saved = localStorage.getItem('medicore_patients');
    return saved ? JSON.parse(saved) : INITIAL_PATIENTS;
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const saved = localStorage.getItem('medicore_appointments');
    return saved ? JSON.parse(saved) : INITIAL_APPOINTMENTS;
  });

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(() => {
    const saved = localStorage.getItem('medicore_slots');
    return saved ? JSON.parse(saved) : DEFAULT_TIME_SLOTS;
  });

  const [records, setRecords] = useState<MedicalRecord[]>(() => {
    const saved = localStorage.getItem('medicore_records');
    return saved ? JSON.parse(saved) : INITIAL_RECORDS;
  });

  const [referrals, setReferrals] = useState<Referral[]>(() => {
    const saved = localStorage.getItem('medicore_referrals');
    return saved ? JSON.parse(saved) : INITIAL_REFERRALS;
  });

  const [beds, setBeds] = useState<HospitalBed[]>(() => {
    const saved = localStorage.getItem('medicore_beds');
    return saved ? JSON.parse(saved) : INITIAL_BEDS;
  });

  const [logs, setLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('medicore_logs');
    return saved ? JSON.parse(saved) : INITIAL_LOGS;
  });

  const [isOracleConnected, setIsOracleConnected] = useState<boolean>(false);
  const [oracleSummary, setOracleSummary] = useState<Omit<DashboardData, 'source'> | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);

  // Sync with Oracle Database 23ai Backend
  const refreshAuditLogs = useCallback(async () => {
    try {
      const data = await apiRequest<Array<Record<string, any>>>('/audit-logs');
      setLogs(data.map((l) => ({
        id: `ora-${l.id}`,
        timestamp: l.timestamp,
        user_name: l.actor_name || 'HỆ THỐNG / BÁC SĨ',
        user_role: 'doctor' as const,
        action: (l.action === 'UPDATE' ? 'SỬA BỆNH ÁN' : l.action === 'INSERT' && l.entity_name === 'MEDICAL_RECORDS' ? 'TẠO BỆNH ÁN' : l.action === 'INSERT' && l.entity_name === 'PATIENTS' ? 'TẠO BỆNH ÁN' : 'ĐIỀU PHỐI GIƯỜNG') as any,
        target_id: `${l.entity_name} #${l.entity_id}`,
        target_type: (l.entity_name === 'MEDICAL_RECORDS' ? 'Hồ sơ bệnh án' : l.entity_name === 'PATIENTS' ? 'Hồ sơ bệnh án' : 'Giường bệnh') as any,
        details: `[Oracle Trigger ${l.entity_name}] Thao tác ${l.action} trên bản ghi #${l.entity_id}. Dữ liệu: ${JSON.stringify(l.new_data || {}).substring(0, 70)}...`,
        ip_address: '127.0.0.1 (Oracle 23ai)',
        old_data: l.old_data,
        new_data: l.new_data,
      })));
    } catch (err) {
      console.warn('refreshAuditLogs failed:', err);
    }
  }, []);

  const refreshBeds = useCallback(async () => {
    try {
      const data = await apiRequest<Array<Record<string, any>>>('/beds');
      setBeds(data.map((b) => ({
        id: String(b.id),
        bed_code: b.code,
        department: b.department_name,
        room: `${b.room_number} (${b.room_type || 'Tiêu chuẩn'})`,
        is_occupied: b.status === 'OCCUPIED',
        patient_name: b.patient_name || undefined,
        patient_code: b.patient_code || undefined,
        admitted_date: b.admitted_date || undefined,
      })));
    } catch (err) {
      console.warn('refreshBeds failed:', err);
    }
  }, []);

  const refreshPatients = useCallback(async () => {
    try {
      const data = await apiRequest<Array<Record<string, any>>>('/patients');
      setPatients((prev) => mapOraclePatients(data, prev));
    } catch (err) {
      console.warn('refreshPatients failed:', err);
    }
  }, []);

  const refreshAppointments = useCallback(async () => {
    try {
      const data = await apiRequest<Array<Record<string, unknown>>>('/appointments');
      setAppointments(mapOracleAppointments(data));
    } catch (err) {
      console.warn('refreshAppointments failed:', err);
    }
  }, []);

  const refreshRecords = useCallback(async () => {
    try {
      const data = await apiRequest<Array<Record<string, unknown>>>('/records');
      setRecords(mapOracleRecords(data));
    } catch (err) {
      console.warn('refreshRecords failed:', err);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    try {
      setOracleSummary(await apiRequest<Omit<DashboardData, 'source'>>('/dashboard/summary'));
    } catch (err) {
      console.warn('refreshDashboard failed:', err);
    }
  }, []);

  const refreshDepartments = useCallback(async () => {
    try {
      const data = await apiRequest<Array<Record<string, any>>>('/departments');
      setDepartments(data.map((d) => ({
        id: Number(d.id),
        name: d.name,
        available_beds: Number(d.available_beds) || 0,
        total_beds: Number(d.total_beds) || 0,
      })));
    } catch (err) {
      console.warn('refreshDepartments failed:', err);
    }
  }, []);

  const refreshDoctors = useCallback(async () => {
    try {
      const data = await apiRequest<Array<Record<string, any>>>('/doctors');
      setDoctors(data.map((d) => ({
        id: Number(d.id),
        name: String(d.name),
        department_id: Number(d.department_id),
        department: String(d.department),
      })));
    } catch (err) {
      console.warn('refreshDoctors failed:', err);
    }
  }, []);

  const refreshHospitals = useCallback(async () => {
    try {
      const data = await apiRequest<Array<Record<string, any>>>('/hospitals');
      setHospitals(data.map((hospital) => ({
        id: Number(hospital.id),
        name: String(hospital.name),
        level: String(hospital.level || ''),
      })));
    } catch (err) {
      console.warn('refreshHospitals failed:', err);
    }
  }, []);

  const refreshReferrals = useCallback(async () => {
    try {
      const data = await apiRequest<Array<Record<string, unknown>>>('/referrals');
      setReferrals(mapOracleReferrals(data));
    } catch (err) {
      console.warn('refreshReferrals failed:', err);
    }
  }, []);

  // Tìm kiếm nhanh qua Oracle; trả về null khi chưa kết nối hoặc lỗi để UI dùng gợi ý cục bộ
  const quickSearch = useCallback(
    async (query: string, signal?: AbortSignal): Promise<QuickSearchResponse | null> => {
      if (!isOracleConnected) return null;
      return apiRequest<QuickSearchResponse>(
        `/search/quick?q=${encodeURIComponent(query)}`,
        { signal }
      );
    },
    [isOracleConnected]
  );

  const fetchPatientTimeline = useCallback(
    async (patientId: string): Promise<PatientTimelineItem[] | null> => {
      const oracleId = /^\d+$/.test(patientId) ? patientId : null;
      if (!isOracleConnected || oracleId === null) return null; // dùng timeline cục bộ
      return apiRequest<PatientTimelineItem[]>(`/patients/${oracleId}/timeline`);
    },
    [isOracleConnected]
  );

  useEffect(() => {
    let isMounted = true;
    async function syncWithOracle() {
      try {
        const health = await apiRequest<{ status: string }>('/health');
        if (health.status !== 'healthy') throw new Error('Oracle API chưa sẵn sàng.');
        if (isMounted) setIsOracleConnected(true);
        await Promise.all([
          refreshPatients(),
          refreshAppointments(),
          refreshRecords(),
          refreshBeds(),
          refreshAuditLogs(),
          refreshDashboard(),
          refreshDepartments(),
          refreshDoctors(),
          refreshHospitals(),
          refreshReferrals(),
        ]);
      } catch (err) {
        console.warn('Không thể kết nối Oracle API:', err);
        if (isMounted) setIsOracleConnected(false);
      }
    }
    syncWithOracle();
    return () => { isMounted = false; };
  }, [
    refreshAppointments,
    refreshAuditLogs,
    refreshBeds,
    refreshDashboard,
    refreshDepartments,
    refreshDoctors,
    refreshHospitals,
    refreshReferrals,
    refreshPatients,
    refreshRecords,
  ]);

  // Làm mới số liệu Dashboard mỗi 30 giây khi tab đang hiển thị (lịch hẹn/giường có thể đổi từ nơi khác)
  useEffect(() => {
    if (!isOracleConnected) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshDashboard();
        refreshBeds();
        refreshAppointments();
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [isOracleConnected, refreshDashboard, refreshBeds, refreshAppointments]);

  // Sync with LocalStorage
  useEffect(() => {
    localStorage.setItem('medicore_patients', JSON.stringify(patients));
  }, [patients]);

  useEffect(() => {
    localStorage.setItem('medicore_appointments', JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => {
    localStorage.setItem('medicore_slots', JSON.stringify(timeSlots));
  }, [timeSlots]);

  useEffect(() => {
    localStorage.setItem('medicore_records', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('medicore_referrals', JSON.stringify(referrals));
  }, [referrals]);

  useEffect(() => {
    localStorage.setItem('medicore_beds', JSON.stringify(beds));
  }, [beds]);

  useEffect(() => {
    localStorage.setItem('medicore_logs', JSON.stringify(logs));
  }, [logs]);

  // Log action helper
  const addLog = useCallback(
    (action: AuditLog['action'], targetId: string, targetType: AuditLog['target_type'], details: string) => {
      const newLog: AuditLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        user_name: 'Người dùng hiện tại',
        user_role: 'doctor',
        action,
        target_id: targetId,
        target_type: targetType,
        details,
        ip_address: '192.168.1.100',
      };
      setLogs((prev) => [newLog, ...prev]);
    },
    []
  );

  // Patient Actions
  // Khi đã kết nối Oracle: ghi vào DB TRƯỚC, dùng PATIENT_ID và medical_code do DB cấp.
  // (Trước đây UI tự đặt id "pat-<timestamp>" nên sau này không gọi được thủ tục phân giường / đặt lịch
  // cho bệnh nhân vừa tạo, và mã BN-2024-00X tính theo patients.length dễ trùng UNIQUE medical_code.)
  const addPatient = useCallback(
    async (patientData: NewPatientInput): Promise<Patient> => {
      let id = `pat-${Date.now()}`;
      let medicalCode = patientData.medical_code || nextLocalMedicalCode(patients);

      if (isOracleConnected) {
        const data = await apiRequest<{
          success: boolean;
          patientId: number;
          medical_code: string;
          error?: string;
        }>('/patients', {
          method: 'POST',
          body: JSON.stringify({
            medical_code: patientData.medical_code,
            full_name: patientData.full_name,
            dob: patientData.dob,
            gender: patientData.gender,
            phone: patientData.phone,
            address: patientData.address,
          }),
        });
        if (!data.success) {
          throw new Error(data.error || 'Oracle 23ai từ chối đăng ký bệnh nhân.');
        }
        id = String(data.patientId);
        medicalCode = data.medical_code;
      }

      const newPatient: Patient = {
        ...patientData,
        medical_code: medicalCode,
        id,
        created_at: localDateStr(),
        timeline: [
          {
            id: `tl-${Date.now()}`,
            date: localDateTimeStr(),
            type: 'admission',
            title: 'Tiếp đón và tạo hồ sơ bệnh nhân',
            description: `Khởi tạo hồ sơ ban đầu (${patientData.department}).`,
            badgeColor: 'blue',
          },
        ],
      };
      setPatients((prev) => [newPatient, ...prev]);
      addLog('TẠO BỆNH ÁN', medicalCode, 'Hồ sơ bệnh án', `Đăng ký hồ sơ bệnh nhân mới: ${patientData.full_name}`);
      if (isOracleConnected) {
        refreshDashboard();
      }
      return newPatient;
    },
    [isOracleConnected, patients, addLog, refreshDashboard]
  );

  const updatePatient = useCallback((id: string, updates: Partial<Patient>) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  const getPatientById = useCallback(
    (id: string) => patients.find((p) => p.id === id),
    [patients]
  );

  const getPatientByCode = useCallback(
    (code: string) =>
      patients.find(
        (p) => p.medical_code.toLowerCase() === code.trim().toLowerCase()
      ),
    [patients]
  );

  // Appointment Actions with Concurrency Simulation
  const addAppointment = useCallback(
    async (
      patientId: string,
      doctorName: string,
      department: string,
      date: string,
      slotTime: string,
      reason: string
    ): Promise<{ success: boolean; error?: string; appointment?: Appointment }> => {
      // 1. Kiểm tra mô phỏng xung đột đồng thời (Concurrency check)
      const targetSlot = timeSlots.find((s) => s.time === slotTime);
      if (targetSlot?.isLockedByOther) {
        return {
          success: false,
          error: `[409 CONFLICT - NGOẠI LỆ ĐỒNG THỜI]: Khung giờ ${slotTime} hiện đang bị khóa/giữ bởi một phiên tiếp đón bệnh nhân khác tại Quầy 02. Vui lòng chọn khung giờ kế tiếp hoặc làm mới danh sách slot!`,
        };
      }

      // 2. Kiểm tra slot của BÁC SĨ đó trong ngày đó đã được đặt chưa (theo BR02)
      const existing = appointments.find(
        (a) =>
          a.doctor_name === doctorName &&
          a.date === date &&
          a.slot === slotTime &&
          a.status !== 'Đã hủy'
      );
      if (existing) {
        return {
          success: false,
          error: `Bác sĩ ${doctorName} đã có lịch khám vào khung giờ ${slotTime} ngày ${date} (Bệnh nhân: ${existing.patient_name}). Vui lòng chọn giờ khác hoặc bác sĩ khác!`,
        };
      }

      const patient = patients.find((p) => p.id === patientId);
      if (isOracleConnected) {
        const patientOracleId = toOracleId(patientId);
        const doctor = doctors.find((item) => item.name === doctorName && item.department === department);
        if (patientOracleId === null || !doctor) {
          return {
            success: false,
            error: 'Bệnh nhân hoặc bác sĩ chưa có mã Oracle hợp lệ. Hãy tải lại danh sách trước khi đặt lịch.',
          };
        }

        try {
          const created = await apiRequest<{ success: boolean; appointment_id: number | string }>('/appointments', {
            method: 'POST',
            body: JSON.stringify({
              patient_id: patientOracleId,
              doctor_id: doctor.id,
              department_id: doctor.department_id,
              scheduled_at: `${date}T${slotTime.substring(0, 5)}:00`,
              symptoms: reason || 'Khám chuyên khoa',
            }),
          });
          if (!created.success || !created.appointment_id) {
            throw new Error('API không xác nhận lịch khám đã được tạo.');
          }

          const newAppointment: Appointment = {
            id: String(created.appointment_id),
            patient_id: patientId,
            patient_code: patient?.medical_code || '',
            patient_name: patient?.full_name || '',
            doctor_name: doctor.name,
            department: doctor.department,
            date,
            slot: slotTime,
            status: 'Đã xác nhận',
            reason,
            created_at: localDateTimeStr(),
          };
          setAppointments((prev) => [newAppointment, ...prev.filter((item) => item.id !== newAppointment.id)]);
          await Promise.all([refreshDashboard(), refreshAuditLogs()]);
          return { success: true, appointment: newAppointment };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : 'Không thể lưu lịch khám vào Oracle.',
          };
        }
      }

      const newApt: Appointment = {
        id: `apt-${Date.now()}`,
        patient_id: patientId,
        patient_code: patient ? patient.medical_code : 'BN-VANG-LAI',
        patient_name: patient ? patient.full_name : 'Bệnh nhân chưa định danh',
        doctor_name: doctorName,
        department,
        date,
        slot: slotTime,
        status: 'Đã xác nhận',
        reason,
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 16),
      };

      setAppointments((prev) => [newApt, ...prev]);

      // Thêm sự kiện vào timeline bệnh nhân
      if (patient) {
        const timelineItem = {
          id: `tl-${Date.now()}`,
          date: `${date} ${slotTime.split(' - ')[0]}`,
          type: 'appointment' as const,
          title: `Đặt lịch khám: ${department}`,
          description: `Bác sĩ phụ trách: ${doctorName}. Lý do: ${reason}`,
          doctor: doctorName,
          badgeColor: 'info',
        };
        updatePatient(patient.id, {
          timeline: [timelineItem, ...patient.timeline],
        });
      }

      addLog('ĐẶT LỊCH KHÁM', newApt.id, 'Lịch khám', `Đặt lịch khám cho ${newApt.patient_name} tại ${department} lúc ${date} ${slotTime}`);

      return { success: true, appointment: newApt };
    },
    [appointments, patients, timeSlots, updatePatient, addLog, isOracleConnected, doctors, refreshDashboard, refreshAuditLogs]
  );

  const updateAppointmentStatus = useCallback(
    async (id: string, status: Appointment['status']) => {
      if (isOracleConnected) {
        if (!/^\d+$/.test(id)) {
          throw new Error('Lịch khám này chưa có mã Oracle nên không thể cập nhật trạng thái.');
        }
        await apiRequest(`/appointments/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
      }
      setAppointments((prev) =>
        prev.map((a) => {
          if (a.id === id) {
            return { ...a, status };
          }
          return a;
        })
      );
      addLog('ĐẶT LỊCH KHÁM', id, 'Lịch khám', `Đổi trạng thái lịch hẹn sang: ${status}`);
    },
    [addLog, isOracleConnected]
  );

  const cancelAppointment = useCallback(
    (id: string) => updateAppointmentStatus(id, 'Đã hủy'),
    [updateAppointmentStatus]
  );

  const toggleSlotConflictSimulation = useCallback((slotTime: string) => {
    setTimeSlots((prev) =>
      prev.map((s) => {
        if (s.time === slotTime) {
          const nextState = !s.isLockedByOther;
          return {
            ...s,
            isLockedByOther: nextState,
            isAvailable: !nextState,
            lockedBy: nextState
              ? 'Quầy Tiếp Đón 02 (Yêu cầu đặt lịch #REQ-9821)'
              : null,
            lockedByInfo: nextState
              ? 'Đang bị giữ bởi Quầy Tiếp Đón 02 (Yêu cầu đặt lịch #REQ-9821)'
              : null,
          };
        }
        return s;
      })
    );
  }, []);

  // Medical Record Actions
  const addRecord = useCallback(
    async (recordData: Omit<MedicalRecord, 'id' | 'record_code'>): Promise<MedicalRecord> => {
      const recordCode = `HSBA-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      let recordId = `rec-${Date.now()}`;

      if (isOracleConnected) {
        const patientId = toOracleId(recordData.patient_id);
        const doctor = doctors.find((item) => item.name === recordData.doctor_name) || doctors[0];
        if (patientId === null || !doctor) {
          throw new Error('Bệnh nhân hoặc bác sĩ chưa có mã Oracle hợp lệ. Không thể lưu bệnh án.');
        }

        const created = await apiRequest<{ success: boolean; record_id: number | string }>('/records', {
          method: 'POST',
          body: JSON.stringify({
            patient_id: patientId,
            appointment_id: null,
            doctor_id: doctor.id,
            diagnosis_summary: `${recordData.diagnosis_icd10.code} - ${recordData.diagnosis_icd10.description}`,
            record_json: {
              record_code: recordCode,
              patient_name: recordData.patient_name,
              patient_code: recordData.patient_code,
              vitals: recordData.vitals,
              symptoms: recordData.symptoms,
              clinical_course: recordData.clinical_course,
              diagnosis_icd10: recordData.diagnosis_icd10,
              lab_results: recordData.lab_results,
              prescriptions: recordData.prescriptions,
              doctor_advice: recordData.doctor_advice,
            },
          }),
        });
        if (!created.success || !created.record_id) {
          throw new Error('API không xác nhận bệnh án đã được lưu.');
        }
        recordId = String(created.record_id);
      }

      const newRecord: MedicalRecord = { ...recordData, id: recordId, record_code: recordCode };
      setRecords((prev) => [newRecord, ...prev.filter((item) => item.id !== recordId)]);

      // Thêm sự kiện vào timeline bệnh nhân
      const patient = patients.find((p) => p.id === recordData.patient_id);
      if (patient) {
        const timelineItem = {
          id: `tl-${Date.now()}`,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          type: 'record' as const,
          title: `Ghi bệnh án: ${recordData.diagnosis_icd10.code} - ${recordData.diagnosis_icd10.description}`,
          description: `Bác sĩ ${recordData.doctor_name}. HA: ${recordData.vitals.blood_pressure_systolic}/${recordData.vitals.blood_pressure_diastolic} mmHg.`,
          doctor: recordData.doctor_name,
          badgeColor: 'blue' as const,
        };
        updatePatient(patient.id, {
          timeline: [timelineItem, ...patient.timeline],
        });
      }

      addLog('TẠO BỆNH ÁN', recordCode, 'Hồ sơ bệnh án', `Tạo bệnh án ${recordCode} cho BN ${recordData.patient_name}`);
      if (isOracleConnected) await refreshAuditLogs();
      return newRecord;
    },
    [patients, doctors, isOracleConnected, updatePatient, addLog, refreshAuditLogs]
  );

  const updateRecord = useCallback(
    async (id: string, updates: Partial<MedicalRecord>) => {
      const currentRecord = records.find((r) => r.id === id);
      if (!currentRecord) throw new Error('Không tìm thấy bệnh án cần cập nhật.');
      const merged = { ...currentRecord, ...updates };

      if (isOracleConnected) {
        if (!/^\d+$/.test(id)) {
          throw new Error('Bệnh án này chưa có mã Oracle nên không thể cập nhật.');
        }
        await apiRequest(`/records/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
          diagnosis_summary: merged.diagnosis_icd10
            ? `${merged.diagnosis_icd10.code} - ${merged.diagnosis_icd10.description}`
            : 'Cập nhật diễn biến lâm sàng',
          record_json: {
            record_code: merged.record_code,
            patient_name: merged.patient_name,
            patient_code: merged.patient_code,
            vitals: merged.vitals,
            symptoms: merged.symptoms,
            clinical_course: merged.clinical_course,
            diagnosis_icd10: merged.diagnosis_icd10,
            lab_results: merged.lab_results,
            prescriptions: merged.prescriptions,
            doctor_advice: merged.doctor_advice,
            updated_at: new Date().toISOString(),
          },
          }),
        });
      }

      setRecords((prev) => prev.map((record) => (record.id === id ? merged : record)));
      addLog('SỬA BỆNH ÁN', id, 'Hồ sơ bệnh án', `Chỉnh sửa cập nhật dữ liệu bệnh án ${id}`);
      if (isOracleConnected) await refreshAuditLogs();
    },
    [records, isOracleConnected, addLog, refreshAuditLogs]
  );

  const getRecordByPatientId = useCallback(
    (patientId: string) => records.find((r) => r.patient_id === patientId),
    [records]
  );

  // Referral Actions
  const addReferral = useCallback(
    async (referralData: Omit<Referral, 'id' | 'referral_code'>): Promise<Referral> => {
      let newId = `ref-${Date.now()}`;
      let referralCode = `CT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      let persistedData = referralData;

      if (isOracleConnected) {
        const patientId = toOracleId(referralData.patient_id);
        const fromHospital = hospitals.find((hospital) => hospital.name === referralData.from_facility);
        const toHospital = hospitals.find((hospital) => hospital.name === referralData.to_facility);
        if (patientId === null || !fromHospital || !toHospital) {
          throw new Error('Bệnh nhân hoặc cơ sở chuyển tuyến không tồn tại trong Oracle.');
        }

        const created = await apiRequest<{ success: boolean; referral_id: number | string; error?: string }>('/referrals', {
          method: 'POST',
          body: JSON.stringify({
            patient_id: patientId,
            from_hospital_id: fromHospital.id,
            to_hospital_id: toHospital.id,
            urgency: referralData.priority,
            reason: referralData.reason,
          }),
        });
        if (!created.success || !created.referral_id) {
          throw new Error(created.error || 'API không xác nhận đã tạo phiếu chuyển tuyến.');
        }

        newId = String(created.referral_id);
        referralCode = `CT-${new Date().getFullYear()}-${newId}`;
        persistedData = {
          ...referralData,
          from_tier: fromHospital.level || 'Chưa phân loại',
          to_tier: toHospital.level || 'Chưa phân loại',
          initial_diagnosis: undefined,
          doctor_approval: undefined,
          transport_type: 'Chưa cập nhật',
        };
      }

      const newRef: Referral = {
        ...persistedData,
        id: newId,
        referral_code: referralCode,
      };

      setReferrals((prev) => [newRef, ...prev]);

      // Cập nhật timeline bệnh nhân
      const patient = patients.find((p) => p.id === referralData.patient_id);
      if (patient) {
        const timelineItem = {
          id: `tl-${Date.now()}`,
          date: referralData.transfer_date,
          type: 'referral' as const,
          title: `Chuyển tuyến: ${referralData.from_facility} -> ${referralData.to_facility}`,
          description: `Mức độ: ${referralData.priority}. Lý do: ${referralData.reason}`,
          facility: referralData.to_facility,
          badgeColor: referralData.priority === 'Cấp cứu' ? 'destructive' : 'warning',
        };
        updatePatient(patient.id, {
          timeline: [timelineItem, ...patient.timeline],
        });
      }

      addLog('DUYỆT CHUYỂN TUYẾN', referralCode, 'Chuyển tuyến', `Tạo phiếu chuyển viện ${referralCode} (${referralData.from_facility} -> ${referralData.to_facility})`);
      if (isOracleConnected) await refreshReferrals();
      return newRef;
    },
    [patients, updatePatient, addLog, isOracleConnected, hospitals, doctors, refreshReferrals]
  );

  const updateReferralStatus = useCallback(
    async (id: string, status: Referral['status']) => {
      if (isOracleConnected) {
        if (!/^\d+$/.test(id)) {
          throw new Error('Phiếu chuyển tuyến này chưa có mã Oracle nên không thể cập nhật.');
        }
        await apiRequest(`/referrals/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
      }
      setReferrals((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
      addLog('DUYỆT CHUYỂN TUYẾN', id, 'Chuyển tuyến', `Cập nhật trạng thái chuyển tuyến sang: ${status}`);
    },
    [addLog, isOracleConnected]
  );

  // Bed Actions & Admissions via Oracle 23ai PKG_HOSPITAL_OPS.ADMIT_PATIENT
  const toggleBedStatus = useCallback(
    (bedId: string) => {
      setBeds((prev) =>
        prev.map((b) => {
          if (b.id === bedId) {
            const nextStatus = !b.is_occupied;
            return {
              ...b,
              is_occupied: nextStatus,
              patient_name: nextStatus ? 'Bệnh nhân tiếp nhận mới' : undefined,
              patient_code: nextStatus ? 'BN-2024-MỚI' : undefined,
              admitted_date: nextStatus
                ? new Date().toISOString().substring(0, 10)
                : undefined,
            };
          }
          return b;
        })
      );
      addLog('ĐIỀU PHỐI GIƯỜNG', bedId, 'Giường bệnh', `Thay đổi trạng thái sử dụng giường ${bedId}`);
    },
    [addLog]
  );

  const admitPatient = useCallback(
    async (patientId: string, departmentId: number) => {
      try {
        const oracleId = toOracleId(patientId);
        if (oracleId === null) {
          return {
            success: false,
            error: 'Hồ sơ này được tạo khi chưa kết nối Oracle 23ai nên chưa có trong CSDL, chưa thể phân giường.',
          };
        }
        const targetPatient = patients.find((p) => p.id === patientId);

        if (targetPatient && targetPatient.status === 'Nội trú') {
          return {
            success: false,
            error: 'Bệnh nhân này hiện đang điều trị nội trú và đã có giường bệnh. Cần làm thủ tục xuất viện trước khi tiếp nhận lượt mới!',
          };
        }

        const data = await apiRequest<{ success: boolean; admission_id: number; error?: string }>('/admissions', {
          method: 'POST',
          body: JSON.stringify({ patient_id: oracleId, department_id: departmentId }),
        });

        if (!data.success) {
          return {
            success: false,
            error: data.error || 'Không thể phân giường (giường có thể vừa bị người khác chiếm). Vui lòng thử lại.',
          };
        }

        addLog('ĐIỀU PHỐI GIƯỜNG', `ADM-${data.admission_id}`, 'Giường bệnh', `Phân giường nội trú an toàn cho BN (Mã nhập viện #${data.admission_id})`);

        // Trạng thái bệnh nhân, giường, số liệu Dashboard đều do Oracle quyết định -> tải lại, không tự sửa state
        await Promise.all([refreshPatients(), refreshBeds(), refreshAuditLogs(), refreshDashboard(), refreshDepartments()]);

        return { success: true, admission_id: data.admission_id };
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'Lỗi kết nối khi phân giường qua Oracle 23ai',
        };
      }
    },
    [patients, addLog, refreshPatients, refreshBeds, refreshAuditLogs, refreshDashboard, refreshDepartments]
  );

  const dischargePatient = useCallback(
    async (patientId: string) => {
      try {
        const oracleId = toOracleId(patientId);
        if (oracleId === null) {
          return { success: false, error: 'Hồ sơ này chưa có trong Oracle 23ai nên không có lượt nội trú để xuất viện.' };
        }
        const data = await apiRequest<{ success: boolean; admission_id: number; error?: string }>('/admissions/discharge', {
          method: 'POST',
          body: JSON.stringify({ patient_id: oracleId }),
        });

        if (!data.success) {
          return {
            success: false,
            error: data.error || 'Không thể xuất viện hoặc bệnh nhân không có hồ sơ nội trú đang hoạt động.',
          };
        }

        addLog('ĐIỀU PHỐI GIƯỜNG', `DIS-${data.admission_id}`, 'Giường bệnh', `Bệnh nhân xuất viện và trả giường bệnh (Mã nhập viện #${data.admission_id})`);

        await Promise.all([refreshPatients(), refreshBeds(), refreshAuditLogs(), refreshDashboard(), refreshDepartments()]);

        return { success: true, admission_id: data.admission_id };
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'Lỗi kết nối khi làm thủ tục xuất viện qua Oracle 23ai',
        };
      }
    },
    [addLog, refreshPatients, refreshBeds, refreshAuditLogs, refreshDashboard, refreshDepartments]
  );

  // Số liệu Dashboard: ưu tiên số liệu thật từ Oracle; nếu chưa kết nối thì tính từ dữ liệu cục bộ
  const localDashboard = useMemo<DashboardData>(() => {
    const today = localDateStr();
    const liveApts = appointments.filter((a) => a.status !== 'Đã hủy');
    const todayApts = liveApts.filter((a) => a.date === today).sort((a, b) => a.slot.localeCompare(b.slot));

    const deptNames = Array.from(new Set(beds.map((b) => b.department)));
    const deptRows = deptNames.map((name, idx) => {
      const own = beds.filter((b) => b.department === name);
      const occupied = own.filter((b) => b.is_occupied).length;
      return {
        department_id: idx + 1,
        name,
        total_beds: own.length,
        occupied_beds: occupied,
        available_beds: own.length - occupied,
        today_appointments: todayApts.filter((a) => a.department === name).length,
      };
    });

    const rank = { 'Cấp cứu': 0, 'Khẩn cấp': 1, 'Thông thường': 2 } as const;
    const pending = referrals
      .filter((r) => r.status === 'Chờ duyệt')
      .sort((a, b) => rank[a.priority] - rank[b.priority]);

    return {
      source: 'local',
      today_appointments: todayApts.length,
      upcoming_appointments: liveApts.filter(
        (a) => a.date > today && (a.status === 'Đã xác nhận' || a.status === 'Đang chờ')
      ).length,
      available_beds: beds.filter((b) => !b.is_occupied).length,
      total_beds: beds.length,
      occupied_beds: beds.filter((b) => b.is_occupied).length,
      pending_referrals: pending.length,
      urgent_pending_referrals: pending.filter((r) => r.priority !== 'Thông thường').length,
      inpatients: patients.filter((p) => p.status === 'Nội trú').length,
      departments: deptRows,
      today_list: todayApts.slice(0, 8).map((a) => ({
        id: a.id,
        patient_id: a.patient_id,
        patient_code: a.patient_code,
        patient_name: a.patient_name,
        time_label: a.slot,
        department: a.department,
        doctor_name: a.doctor_name,
        status: a.status,
      })),
      pending_referral_list: pending.slice(0, 5).map((r) => ({
        id: r.id,
        patient_name: r.patient_name,
        patient_code: r.patient_code,
        from_facility: r.from_facility,
        to_facility: r.to_facility,
        priority: r.priority,
        reason: r.reason,
      })),
    };
  }, [appointments, beds, referrals, patients]);

  const dashboard: DashboardData = useMemo(
    () => (isOracleConnected && oracleSummary ? { ...oracleSummary, source: 'oracle' } : localDashboard),
    [isOracleConnected, oracleSummary, localDashboard]
  );

  // Header & Sidebar cũng dùng `stats`, nên sửa ở đây là sửa luôn cho các badge trên thanh điều hướng
  const stats = {
    todayAppointments: dashboard.today_appointments,
    availableBeds: dashboard.available_beds,
    totalBeds: dashboard.total_beds,
    pendingReferrals: dashboard.pending_referrals,
    totalInpatients: dashboard.inpatients,
  };

  return (
    <MedicalStoreContext.Provider
      value={{
        patients,
        addPatient,
        refreshPatients,
        fetchPatientTimeline,
        quickSearch,
        updatePatient,
        getPatientById,
        getPatientByCode,
        appointments,
        refreshAppointments,
        timeSlots,
        addAppointment,
        cancelAppointment,
        updateAppointmentStatus,
        toggleSlotConflictSimulation,
        records,
        addRecord,
        updateRecord,
        getRecordByPatientId,
        referrals,
        refreshReferrals,
        addReferral,
        updateReferralStatus,
        beds,
        toggleBedStatus,
        admitPatient,
        dischargePatient,
        logs,
        refreshAuditLogs,
        addLog,
        dashboard,
        refreshDashboard,
        departments,
        refreshDepartments,
        doctors,
        refreshDoctors,
        hospitals,
        refreshHospitals,
        stats,
        isOracleConnected,
      }}
    >
      {children}
    </MedicalStoreContext.Provider>
  );
};

export const useMedicalStore = () => {
  const context = useContext(MedicalStoreContext);
  if (!context) {
    throw new Error('useMedicalStore must be used within a MedicalStoreProvider');
  }
  return context;
};
