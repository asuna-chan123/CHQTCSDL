import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Patient,
  Appointment,
  MedicalRecord,
  Referral,
  HospitalBed,
  AuditLog,
  TimeSlot,
  AISearchResult,
} from '@/types';

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
    date: '2026-09-22',
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
    date: '2026-09-22',
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
    date: '2026-09-22',
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
  addPatient: (patient: Omit<Patient, 'id' | 'created_at' | 'timeline'>) => Patient;
  updatePatient: (id: string, updates: Partial<Patient>) => void;
  getPatientById: (id: string) => Patient | undefined;
  getPatientByCode: (code: string) => Patient | undefined;
  
  // Appointments
  appointments: Appointment[];
  timeSlots: TimeSlot[];
  addAppointment: (
    patientId: string,
    doctorName: string,
    department: string,
    date: string,
    slot: string,
    reason: string
  ) => { success: boolean; error?: string; appointment?: Appointment };
  cancelAppointment: (id: string) => void;
  toggleSlotConflictSimulation: (slotTime: string) => void;

  // Medical Records
  records: MedicalRecord[];
  addRecord: (record: Omit<MedicalRecord, 'id' | 'record_code'>) => MedicalRecord;
  updateRecord: (id: string, updates: Partial<MedicalRecord>) => void;
  getRecordByPatientId: (patientId: string) => MedicalRecord | undefined;

  // Referrals
  referrals: Referral[];
  addReferral: (referral: Omit<Referral, 'id' | 'referral_code'>) => Referral;
  updateReferralStatus: (id: string, status: Referral['status']) => void;

  // Hospital Beds
  beds: HospitalBed[];
  toggleBedStatus: (bedId: string) => void;

  // Audit Logs
  logs: AuditLog[];
  addLog: (action: AuditLog['action'], targetId: string, targetType: AuditLog['target_type'], details: string) => void;

  // Quick stats
  stats: {
    todayAppointments: number;
    availableBeds: number;
    totalBeds: number;
    pendingReferrals: number;
    totalInpatients: number;
  };
}

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
  const addPatient = useCallback(
    (patientData: Omit<Patient, 'id' | 'created_at' | 'timeline'>): Patient => {
      const newId = `pat-${Date.now()}`;
      const newPatient: Patient = {
        ...patientData,
        id: newId,
        created_at: new Date().toISOString().substring(0, 10),
        timeline: [
          {
            id: `tl-${Date.now()}`,
            date: new Date().toISOString().replace('T', ' ').substring(0, 16),
            type: 'admission',
            title: 'Tiếp đón và tạo hồ sơ bệnh nhân',
            description: `Khởi tạo hồ sơ ban đầu tại ${patientData.department}.`,
            badgeColor: 'blue',
          },
        ],
      };
      setPatients((prev) => [newPatient, ...prev]);
      addLog('TẠO BỆNH ÁN', patientData.medical_code, 'Hồ sơ bệnh án', `Đăng ký hồ sơ bệnh nhân mới: ${patientData.full_name}`);
      return newPatient;
    },
    [addLog]
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
    (
      patientId: string,
      doctorName: string,
      department: string,
      date: string,
      slotTime: string,
      reason: string
    ) => {
      // 1. Kiểm tra mô phỏng xung đột đồng thời (Concurrency check)
      const targetSlot = timeSlots.find((s) => s.time === slotTime);
      if (targetSlot?.isLockedByOther) {
        return {
          success: false,
          error: `[409 CONFLICT - NGOẠI LỆ ĐỒNG THỜI]: Khung giờ ${slotTime} hiện đang bị khóa/giữ bởi một phiên tiếp đón bệnh nhân khác tại Quầy 02. Vui lòng chọn khung giờ kế tiếp hoặc làm mới danh sách slot!`,
        };
      }

      // 2. Kiểm tra slot đã được đặt chưa
      const existing = appointments.find(
        (a) => a.date === date && a.slot === slotTime && a.status !== 'Đã hủy'
      );
      if (existing) {
        return {
          success: false,
          error: `Khung giờ ${slotTime} vào ngày ${date} đã có bệnh nhân ${existing.patient_name} đặt khám.`,
        };
      }

      const patient = patients.find((p) => p.id === patientId);
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

      // Cập nhật trạng thái slot thành không khả dụng
      setTimeSlots((prev) =>
        prev.map((s) => (s.time === slotTime ? { ...s, isAvailable: false } : s))
      );

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
    [appointments, patients, timeSlots, updatePatient, addLog]
  );

  const cancelAppointment = useCallback(
    (id: string) => {
      setAppointments((prev) =>
        prev.map((a) => {
          if (a.id === id) {
            // Trả lại slot khả dụng
            setTimeSlots((slots) =>
              slots.map((s) => (s.time === a.slot ? { ...s, isAvailable: true } : s))
            );
            return { ...a, status: 'Đã hủy' as const };
          }
          return a;
        })
      );
      addLog('HỦY LỊCH', id, 'Lịch khám', `Hủy lịch hẹn mã ${id}`);
    },
    [addLog]
  );

  const toggleSlotConflictSimulation = useCallback((slotTime: string) => {
    setTimeSlots((prev) =>
      prev.map((s) => {
        if (s.time === slotTime) {
          const nextState = !s.isLockedByOther;
          return {
            ...s,
            isLockedByOther: nextState,
            lockedByInfo: nextState
              ? 'Đang bị giữ bởi Quầy Tiếp Đón 02 (Yêu cầu đặt lịch #REQ-9821)'
              : undefined,
          };
        }
        return s;
      })
    );
  }, []);

  // Medical Record Actions
  const addRecord = useCallback(
    (recordData: Omit<MedicalRecord, 'id' | 'record_code'>): MedicalRecord => {
      const newId = `rec-${Date.now()}`;
      const recordCode = `HSBA-2024-${String(records.length + 1).padStart(3, '0')}`;
      const newRecord: MedicalRecord = {
        ...recordData,
        id: newId,
        record_code: recordCode,
      };

      setRecords((prev) => [newRecord, ...prev]);

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
          badgeColor: 'blue',
        };
        updatePatient(patient.id, {
          timeline: [timelineItem, ...patient.timeline],
        });
      }

      addLog('TẠO BỆNH ÁN', recordCode, 'Hồ sơ bệnh án', `Tạo bệnh án ${recordCode} cho BN ${recordData.patient_name}`);
      return newRecord;
    },
    [records.length, patients, updatePatient, addLog]
  );

  const updateRecord = useCallback(
    (id: string, updates: Partial<MedicalRecord>) => {
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
      );
      addLog('SỬA BỆNH ÁN', id, 'Hồ sơ bệnh án', `Chỉnh sửa cập nhật dữ liệu bệnh án ${id}`);
    },
    [addLog]
  );

  const getRecordByPatientId = useCallback(
    (patientId: string) => records.find((r) => r.patient_id === patientId),
    [records]
  );

  // Referral Actions
  const addReferral = useCallback(
    (referralData: Omit<Referral, 'id' | 'referral_code'>): Referral => {
      const newId = `ref-${Date.now()}`;
      const referralCode = `CT-2024-${Math.floor(100 + Math.random() * 900)}`;
      const newRef: Referral = {
        ...referralData,
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
      return newRef;
    },
    [patients, updatePatient, addLog]
  );

  const updateReferralStatus = useCallback(
    (id: string, status: Referral['status']) => {
      setReferrals((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
      addLog('DUYỆT CHUYỂN TUYẾN', id, 'Chuyển tuyến', `Cập nhật trạng thái chuyển tuyến sang: ${status}`);
    },
    [addLog]
  );

  // Bed Actions
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

  // Quick statistics
  const stats = {
    todayAppointments: appointments.filter((a) => a.date === '2026-09-22').length,
    availableBeds: beds.filter((b) => !b.is_occupied).length,
    totalBeds: beds.length,
    pendingReferrals: referrals.filter((r) => r.status === 'Chờ duyệt' || r.status === 'Đang chuyển bệnh').length,
    totalInpatients: patients.filter((p) => p.status === 'Nội trú').length,
  };

  return (
    <MedicalStoreContext.Provider
      value={{
        patients,
        addPatient,
        updatePatient,
        getPatientById,
        getPatientByCode,
        appointments,
        timeSlots,
        addAppointment,
        cancelAppointment,
        toggleSlotConflictSimulation,
        records,
        addRecord,
        updateRecord,
        getRecordByPatientId,
        referrals,
        addReferral,
        updateReferralStatus,
        beds,
        toggleBedStatus,
        logs,
        addLog,
        stats,
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
