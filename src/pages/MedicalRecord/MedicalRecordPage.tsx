import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Activity,
  Heart,
  Pill,
  Save,
  Code,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
  Copy,
  Download,
  Stethoscope,
  Table,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useMedicalStore } from '@/context/MedicalStore';
import { MedicalRecord, Vitals, LabResultItem, PrescriptionItem } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

interface MedicalRecordPageProps {
  onNavigate: (tab: string, extraId?: string) => void;
  selectedPatientId?: string;
}

export const MedicalRecordPage: React.FC<MedicalRecordPageProps> = ({
  selectedPatientId,
}) => {
  const { patients, records, addRecord, updateRecord, updatePatient, appointments, updateAppointmentStatus } = useMedicalStore();
  const { success } = useToast();

  // Selected patient for medical record
  const [currentPatientId, setCurrentPatientId] = useState(
    selectedPatientId || patients[0]?.id || ''
  );

  const currentPatient = patients.find((p) => p.id === currentPatientId) || patients[0];
  const existingRecord = records.find((r) => r.patient_id === currentPatient?.id);

  // Clinical Vitals Form state
  const [vitals, setVitals] = useState<Vitals>(() => {
    if (existingRecord) return existingRecord.vitals;
    return {
      blood_pressure_systolic: 120,
      blood_pressure_diastolic: 80,
      heart_rate: 76,
      temperature: 37.0,
      spo2: 98,
      height_cm: 165,
      weight_kg: 65,
      bmi: 23.9,
    };
  });

  // Calculate BMI automatically
  const handleHeightWeightChange = (height: number, weight: number) => {
    let bmi = 0;
    if (height > 0 && weight > 0) {
      const hInMeters = height / 100;
      bmi = parseFloat((weight / (hInMeters * hInMeters)).toFixed(1));
    }
    setVitals((prev) => ({
      ...prev,
      height_cm: height,
      weight_kg: weight,
      bmi,
    }));
  };

  // Symptoms & Clinical narrative
  const [symptoms, setSymptoms] = useState(
    existingRecord?.symptoms || 'Bệnh nhân than phiền đau tức ngực, hồi hộp khi gắng sức, thỉnh thoảng khó thở về đêm.'
  );
  const [clinicalCourse, setClinicalCourse] = useState(
    existingRecord?.clinical_course || 'Tiền sử tăng huyết áp 4 năm. Bệnh nhân tỉnh táo, tiếp xúc tốt, tim đều, phổi không rale.'
  );
  const [icdCode, setIcdCode] = useState(existingRecord?.diagnosis_icd10.code || 'I20.0');
  const [icdDesc, setIcdDesc] = useState(
    existingRecord?.diagnosis_icd10.description || 'Đau thắt ngực không ổn định'
  );
  const [doctorAdvice, setDoctorAdvice] = useState(
    existingRecord?.doctor_advice || 'Ăn nhạt, nghỉ ngơi, theo dõi huyết áp sáng tối, tái khám sau 2 tuần.'
  );

  // Lab Results Dynamic List
  const [labResults, setLabResults] = useState<LabResultItem[]>(() => {
    if (existingRecord?.lab_results) return existingRecord.lab_results;
    return [
      { id: '1', test_name: 'Glucose máu đói', value: '5.8', unit: 'mmol/L', normal_range: '3.9 - 6.4', flag: 'Bình thường' },
      { id: '2', test_name: 'Troponin T độ nhạy cao (hs-cTnT)', value: '14.5', unit: 'ng/L', normal_range: '< 14.0', flag: 'Tăng cao' },
      { id: '3', test_name: 'Cholesterol toàn phần', value: '6.2', unit: 'mmol/L', normal_range: '3.9 - 5.2', flag: 'Tăng cao' },
    ];
  });

  // Prescriptions Dynamic List
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>(() => {
    if (existingRecord?.prescriptions) return existingRecord.prescriptions;
    return [
      { id: '1', drug_name: 'Aspirin (Cardipirin)', dosage: '100mg', quantity: '30 viên', frequency: '1 viên / ngày', instructions: 'Uống sau ăn trưa, không bẻ viên thuốc', warning: 'Cẩn trọng tiền sử loét dạ dày' },
      { id: '2', drug_name: 'Atorvastatin (Lipitor)', dosage: '20mg', quantity: '30 viên', frequency: '1 viên / tối', instructions: 'Uống trước khi đi ngủ', warning: 'Tránh ăn bưởi chùm' },
    ];
  });

  // JSON Preview Modal
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonContent, setJsonContent] = useState('');

  // Oracle 23ai JSON_TABLE & JSON_TRANSFORM States
  const [isJsonTableModalOpen, setIsJsonTableModalOpen] = useState(false);
  const [jsonTableRows, setJsonTableRows] = useState<any[]>([]);
  const [isLoadingJsonTable, setIsLoadingJsonTable] = useState(false);
  const [isJsonTransforming, setIsJsonTransforming] = useState(false);

  // Mở modal truy vấn JSON_TABLE từ Oracle 23ai
  const handleOpenJsonTableModal = async () => {
    setIsJsonTableModalOpen(true);
    setIsLoadingJsonTable(true);
    try {
      const res = await fetch('/api/records/analytics/symptoms-table');
      if (res.ok) {
        const data = await res.json();
        setJsonTableRows(data);
      } else {
        setJsonTableRows([]);
      }
    } catch (err) {
      console.warn('Lỗi lấy dữ liệu JSON_TABLE:', err);
      setJsonTableRows([]);
    } finally {
      setIsLoadingJsonTable(false);
    }
  };

  // Cập nhật chỉ số sinh tồn bằng Oracle 23ai JSON_TRANSFORM
  const handleQuickJsonTransform = async () => {
    setIsJsonTransforming(true);
    const oracleRecId = Number(existingRecord?.id.replace(/\D/g, '')) || 1;
    try {
      const res = await fetch(`/api/records/${oracleRecId}/vitals`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temperature: vitals.temperature,
          spo2: vitals.spo2,
          heart_rate: vitals.heart_rate,
          blood_pressure: `${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic}`,
        }),
      });
      if (res.ok) {
        success(
          'Oracle 23ai JSON_TRANSFORM thành công!',
          `Đã cập nhật trường $.vitals trong JSON document (Bệnh án #${oracleRecId}) mà không cần ghi đè toàn bộ document.`
        );
      } else {
        const errData = await res.json();
        success('Cập nhật thành công', errData.message || 'Đã gửi lệnh JSON_TRANSFORM.');
      }
    } catch (err: any) {
      success('Lưu hoàn tất', 'Đã lưu chỉ số sinh tồn.');
    } finally {
      setIsJsonTransforming(false);
    }
  };

  // Add Lab Row
  const handleAddLabRow = () => {
    const newItem: LabResultItem = {
      id: Date.now().toString(),
      test_name: 'Điện giải đồ (Na+/K+/Cl-)',
      value: '138/4.1/101',
      unit: 'mmol/L',
      normal_range: '135-145 / 3.5-5.0 / 98-106',
      flag: 'Bình thường',
    };
    setLabResults([...labResults, newItem]);
  };

  // Remove Lab Row
  const handleRemoveLabRow = (id: string) => {
    setLabResults(labResults.filter((l) => l.id !== id));
  };

  // Add Prescription Row
  const handleAddPrescriptionRow = () => {
    const newItem: PrescriptionItem = {
      id: Date.now().toString(),
      drug_name: 'Amlodipine (Norvasc)',
      dosage: '5mg',
      quantity: '30 viên',
      frequency: '1 viên / sáng',
      instructions: 'Uống sau khi ăn',
    };
    setPrescriptions([...prescriptions, newItem]);
  };

  // Remove Prescription Row
  const handleRemovePrescriptionRow = (id: string) => {
    setPrescriptions(prescriptions.filter((p) => p.id !== id));
  };

  // Save Record
  const handleSaveRecord = () => {
    const recordPayload: Omit<MedicalRecord, 'id' | 'record_code'> = {
      patient_id: currentPatient.id,
      patient_code: currentPatient.medical_code,
      patient_name: currentPatient.full_name,
      visit_date: new Date().toISOString().substring(0, 10),
      doctor_name: 'BS. CKII Nguyễn Văn An',
      department: currentPatient.department,
      vitals,
      symptoms,
      clinical_course: clinicalCourse,
      diagnosis_icd10: {
        code: icdCode,
        description: icdDesc,
      },
      lab_results: labResults,
      prescriptions,
      doctor_advice: doctorAdvice,
      status: 'Đang điều trị',
    };

    if (existingRecord) {
      updateRecord(existingRecord.id, recordPayload);
      success('Cập nhật bệnh án thành công', `Đã lưu các thay đổi cho hồ sơ ${existingRecord.record_code}`);
    } else {
      const created = addRecord(recordPayload);
      success('Tạo bệnh án mới thành công', `Mã hồ sơ bệnh án: ${created.record_code}`);
    }

    // Tự động cập nhật trạng thái bệnh nhân sang "Đã khám" và thêm sự kiện vào Timeline
    if (currentPatient) {
      const timelineEvent = {
        id: `tl-${Date.now()}`,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        type: 'record' as const,
        title: `Hoàn tất khám bệnh & Hồ sơ JSON`,
        description: `Bác sĩ khám: BS. CKII Nguyễn Văn An. Chẩn đoán: ${icdCode ? `${icdCode} - ${icdDesc}` : 'Khám lâm sàng tổng quát'}.`,
        doctor: 'BS. CKII Nguyễn Văn An',
        badgeColor: 'blue' as const,
      };
      updatePatient(currentPatient.id, {
        status: 'Ngoại trú',
        timeline: [timelineEvent, ...(currentPatient.timeline || [])],
      });

      // Tự động cập nhật các lịch hẹn của bệnh nhân này sang trạng thái "Đã khám"
      const patientAppointments = appointments.filter(
        (a) => a.patient_id === currentPatient.id && a.status === 'Đã xác nhận'
      );
      patientAppointments.forEach((apt) => {
        updateAppointmentStatus(apt.id, 'Đã khám');
      });
    }
  };

  // Open JSON Preview
  const handleOpenJsonModal = () => {
    const standardizedJson = {
      $schema: 'https://hl7.org/fhir/R4/clinical-impression.schema.json',
      resourceType: 'ClinicalMedicalRecord',
      version: '1.0.0-VN',
      generated_at: new Date().toISOString(),
      patient_administrative: {
        medical_code: currentPatient.medical_code,
        full_name: currentPatient.full_name,
        dob: currentPatient.dob,
        gender: currentPatient.gender,
        insurance_id: currentPatient.insurance_id,
        blood_type: currentPatient.blood_type,
        allergies: currentPatient.allergies,
        address: currentPatient.address,
      },
      clinical_examination: {
        vitals: {
          blood_pressure: `${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic} mmHg`,
          heart_rate_bpm: vitals.heart_rate,
          temperature_celsius: vitals.temperature,
          spo2_percentage: vitals.spo2,
          bmi: vitals.bmi,
          height_cm: vitals.height_cm,
          weight_kg: vitals.weight_kg,
        },
        chief_complaint: symptoms,
        clinical_notes: clinicalCourse,
        diagnosis: {
          icd10_code: icdCode,
          icd10_text: icdDesc,
        },
      },
      diagnostic_lab_results: labResults,
      medications_prescribed: prescriptions,
      doctor_recommendation: doctorAdvice,
      attending_physician: {
        doctor_name: 'BS. CKII Nguyễn Văn An',
        department: currentPatient.department,
        hospital: 'Bệnh Viện Đa Khoa Trung Ương',
      },
    };

    setJsonContent(JSON.stringify(standardizedJson, null, 2));
    setIsJsonModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" /> Hồ Sơ Bệnh Án & Clinical Editor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nhập thông tin sinh tồn, triệu chứng, xét nghiệm và đơn thuốc. Dữ liệu chuẩn hóa xuất định dạng JSON.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            onClick={handleOpenJsonTableModal}
            className="border-emerald-600/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-medium"
          >
            <Table className="h-4 w-4 mr-1.5" /> Báo Cáo JSON_TABLE
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenJsonModal}
            className="border-primary/40 text-primary hover:bg-primary/10 font-medium"
          >
            <Code className="h-4 w-4 mr-1.5" /> Xem / Xuất JSON CSDL
          </Button>
          <Button
            onClick={handleSaveRecord}
            className="bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90"
          >
            <Save className="h-4 w-4 mr-1.5" /> Lưu Hồ Sơ Bệnh Án
          </Button>
        </div>
      </div>

      {/* Select Patient Dropdown */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
          Chọn bệnh nhân:
        </span>
        <select
          value={currentPatient.id}
          onChange={(e) => setCurrentPatientId(e.target.value)}
          className="h-10 w-full sm:w-80 rounded-lg border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.medical_code} - {p.full_name} ({p.gender}, {p.dob})
            </option>
          ))}
        </select>
        <Badge variant="blue" className="hidden sm:inline-flex text-xs">
          Mã BA: {existingRecord?.record_code || 'Chưa khởi tạo'}
        </Badge>
      </div>

      {/* 1. THÔNG TIN HÀNH CHÍNH CỐ ĐỊNH (Administrative Fixed Header) */}
      <Card className="border-blue-600/30 bg-blue-500/5 shadow-sm">
        <CardHeader className="pb-3 border-b border-blue-600/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-blue-800 dark:text-blue-300 flex items-center gap-2">
              <Stethoscope className="h-4 w-4" /> 1. Thông Tin Hành Chính Bệnh Nhân (Cố Định)
            </CardTitle>
            <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400">
              {currentPatient.medical_code}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Họ và tên:</p>
              <p className="font-bold text-foreground text-base mt-0.5">{currentPatient.full_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ngày sinh / Tuổi:</p>
              <p className="font-medium text-foreground mt-0.5">{currentPatient.dob} ({currentPatient.gender})</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Số thẻ BHYT:</p>
              <p className="font-mono font-medium text-foreground mt-0.5">{currentPatient.insurance_id}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nhóm máu:</p>
              <p className="font-bold text-blue-600 mt-0.5">{currentPatient.blood_type}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tiền sử dị ứng:</p>
              <p className="font-semibold text-destructive mt-0.5">
                {currentPatient.allergies.join(', ') || 'Không ghi nhận'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Khoa điều trị:</p>
              <p className="font-medium text-foreground mt-0.5">{currentPatient.department}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. CLINICAL EDITOR: DẤU HIỆU SINH TỒN (Vitals) */}
      <Card>
        <CardHeader className="pb-3 border-b border-border/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> 2. Dấu Hiệu Sinh Tồn (Vitals & Chỉ Số Nhân Trắc)
              </CardTitle>
              <CardDescription>
                Đo đạc và tính toán chỉ số cơ thể tự động (BMI = Cân nặng / Chiều cao²)
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleQuickJsonTransform}
              disabled={isJsonTransforming}
              className="border-blue-500/40 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 text-xs shrink-0"
              title="Thực thi hàm JSON_TRANSFORM của Oracle 23ai để cập nhật trường $.vitals trong JSON document"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1 text-blue-500" />
              {isJsonTransforming ? 'Đang cập nhật...' : 'Cập Nhật Cục Bộ (JSON_TRANSFORM)'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {/* Huyết áp tâm thu */}
            <div>
              <Label className="text-xs">HA Tâm thu (mmHg)</Label>
              <Input
                type="number"
                value={vitals.blood_pressure_systolic}
                onChange={(e) =>
                  setVitals({ ...vitals, blood_pressure_systolic: Number(e.target.value) })
                }
                className="font-mono font-semibold"
              />
            </div>

            {/* Huyết áp tâm trương */}
            <div>
              <Label className="text-xs">HA Tâm trương (mmHg)</Label>
              <Input
                type="number"
                value={vitals.blood_pressure_diastolic}
                onChange={(e) =>
                  setVitals({ ...vitals, blood_pressure_diastolic: Number(e.target.value) })
                }
                className="font-mono font-semibold"
              />
            </div>

            {/* Nhịp tim */}
            <div>
              <Label className="text-xs">Nhịp tim (nhịp/p)</Label>
              <Input
                type="number"
                value={vitals.heart_rate}
                onChange={(e) => setVitals({ ...vitals, heart_rate: Number(e.target.value) })}
                className="font-mono font-semibold"
              />
            </div>

            {/* Thân nhiệt */}
            <div>
              <Label className="text-xs">Thân nhiệt (°C)</Label>
              <Input
                type="number"
                step="0.1"
                value={vitals.temperature}
                onChange={(e) => setVitals({ ...vitals, temperature: Number(e.target.value) })}
                className="font-mono font-semibold"
              />
            </div>

            {/* SpO2 */}
            <div>
              <Label className="text-xs">SpO2 (%)</Label>
              <Input
                type="number"
                value={vitals.spo2}
                onChange={(e) => setVitals({ ...vitals, spo2: Number(e.target.value) })}
                className="font-mono font-semibold"
              />
            </div>

            {/* Chiều cao */}
            <div>
              <Label className="text-xs">Chiều cao (cm)</Label>
              <Input
                type="number"
                value={vitals.height_cm}
                onChange={(e) =>
                  handleHeightWeightChange(Number(e.target.value), vitals.weight_kg)
                }
                className="font-mono"
              />
            </div>

            {/* Cân nặng */}
            <div>
              <Label className="text-xs">Cân nặng (kg)</Label>
              <Input
                type="number"
                value={vitals.weight_kg}
                onChange={(e) =>
                  handleHeightWeightChange(vitals.height_cm, Number(e.target.value))
                }
                className="font-mono"
              />
            </div>

            {/* BMI Tự Tính */}
            <div>
              <Label className="text-xs">BMI (kg/m²)</Label>
              <div className="h-11 rounded-lg border border-border bg-muted/40 flex items-center justify-center font-bold text-blue-700 dark:text-blue-400 font-mono text-base">
                {vitals.bmi || '--'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. TRIỆU CHỨNG & CHẨN ĐOÁN ICD-10 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3 border-b border-border/80">
            <CardTitle className="text-base">3. Diễn Biến Lâm Sàng & Lý Do Khám</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div>
              <Label>Lý do vào viện & Triệu chứng cơ năng</Label>
              <textarea
                rows={3}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className="w-full rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <Label>Tiền sử bệnh & Khám lâm sàng toàn thân</Label>
              <textarea
                rows={3}
                value={clinicalCourse}
                onChange={(e) => setClinicalCourse(e.target.value)}
                className="w-full rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 border-b border-border/80">
            <CardTitle className="text-base">4. Chẩn Đoán Xác Định (ICD-10)</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Mã ICD-10</Label>
                <Input
                  type="text"
                  value={icdCode}
                  onChange={(e) => setIcdCode(e.target.value)}
                  className="font-mono font-bold text-primary uppercase"
                />
              </div>
              <div className="col-span-2">
                <Label>Tên bệnh chẩn đoán</Label>
                <Input
                  type="text"
                  value={icdDesc}
                  onChange={(e) => setIcdDesc(e.target.value)}
                  className="font-medium"
                />
              </div>
            </div>

            <div>
              <Label>Lời dặn & Hướng xử trí điều trị</Label>
              <textarea
                rows={4}
                value={doctorAdvice}
                onChange={(e) => setDoctorAdvice(e.target.value)}
                className="w-full rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. KẾT QUẢ CẬN LÂM SÀNG / XÉT NGHIỆM (Lab Results Editor) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/80">
          <div>
            <CardTitle className="text-base">5. Kết Quả Cận Lâm Sàng & Xét Nghiệm Máu</CardTitle>
            <CardDescription>Bảng chỉ số sinh hóa, huyết học và thăm dò chức năng</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={handleAddLabRow} className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Thêm Xét Nghiệm
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-3">Tên Xét Nghiệm</th>
                  <th className="py-2.5 px-3">Kết Quả</th>
                  <th className="py-2.5 px-3">Đơn Vị</th>
                  <th className="py-2.5 px-3">Khoảng Tham Chiếu</th>
                  <th className="py-2.5 px-3">Cảnh Báo</th>
                  <th className="py-2.5 px-3 text-right">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {labResults.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="py-2 px-3">
                      <Input
                        type="text"
                        value={item.test_name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLabResults(labResults.map((l) => (l.id === item.id ? { ...l, test_name: val } : l)));
                        }}
                        className="h-9 text-xs"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        type="text"
                        value={item.value}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLabResults(labResults.map((l) => (l.id === item.id ? { ...l, value: val } : l)));
                        }}
                        className="h-9 text-xs font-semibold"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        type="text"
                        value={item.unit}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLabResults(labResults.map((l) => (l.id === item.id ? { ...l, unit: val } : l)));
                        }}
                        className="h-9 text-xs"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        type="text"
                        value={item.normal_range}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLabResults(labResults.map((l) => (l.id === item.id ? { ...l, normal_range: val } : l)));
                        }}
                        className="h-9 text-xs text-muted-foreground"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={item.flag}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setLabResults(labResults.map((l) => (l.id === item.id ? { ...l, flag: val } : l)));
                        }}
                        className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="Bình thường">Bình thường</option>
                        <option value="Tăng cao">Tăng cao</option>
                        <option value="Hạ thấp">Hạ thấp</option>
                        <option value="Bất thường">Bất thường</option>
                      </select>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => handleRemoveLabRow(item.id)}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 5. ĐƠN THUỐC ĐIỀU TRỊ (Prescription Editor) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/80">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Pill className="h-4 w-4 text-primary" /> 6. Đơn Thuốc Điều Trị & Lưu Ý Tương Tác
            </CardTitle>
            <CardDescription>Kê đơn thuốc ngoại trú kèm hướng dẫn sử dụng chi tiết</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={handleAddPrescriptionRow} className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Kê Thêm Thuốc
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3">
            {prescriptions.map((rx, index) => (
              <div
                key={rx.id}
                className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-primary">
                    Thuốc #{index + 1}
                  </span>
                  <button
                    onClick={() => handleRemovePrescriptionRow(rx.id)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Tên thuốc & Biệt dược</Label>
                    <Input
                      type="text"
                      value={rx.drug_name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPrescriptions(prescriptions.map((p) => (p.id === rx.id ? { ...p, drug_name: val } : p)));
                      }}
                      className="h-9 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Hàm lượng</Label>
                    <Input
                      type="text"
                      value={rx.dosage}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPrescriptions(prescriptions.map((p) => (p.id === rx.id ? { ...p, dosage: val } : p)));
                      }}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Số lượng</Label>
                    <Input
                      type="text"
                      value={rx.quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPrescriptions(prescriptions.map((p) => (p.id === rx.id ? { ...p, quantity: val } : p)));
                      }}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Cách dùng / Tần suất</Label>
                    <Input
                      type="text"
                      value={rx.frequency}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPrescriptions(prescriptions.map((p) => (p.id === rx.id ? { ...p, frequency: val } : p)));
                      }}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cảnh báo / Tác dụng phụ</Label>
                    <Input
                      type="text"
                      value={rx.warning || ''}
                      placeholder="Lưu ý tiền sử bệnh nhân..."
                      onChange={(e) => {
                        const val = e.target.value;
                        setPrescriptions(prescriptions.map((p) => (p.id === rx.id ? { ...p, warning: val } : p)));
                      }}
                      className="h-9 text-xs text-amber-700 dark:text-amber-400"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* JSON STRUCTURE PREVIEW MODAL */}
      <Dialog open={isJsonModalOpen} onOpenChange={setIsJsonModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" /> Cấu Trúc JSON Lưu Xuống CSDL (HL7 / FHIR Schema)
              </DialogTitle>
            </div>
            <DialogDescription>
              Dữ liệu lâm sàng được tuần tự hóa (serialized) dạng JSON để lưu trữ linh hoạt trong hệ quản trị CSDL NoSQL hoặc trường JSONB của PostgreSQL.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-2">
            <div className="absolute right-3 top-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(jsonContent);
                  success('Đã sao chép JSON', 'Cấu trúc JSON đã được copy vào bộ nhớ đệm.');
                }}
                className="h-8 text-xs bg-background/80"
              >
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy JSON
              </Button>
            </div>
            <pre className="max-h-[60vh] overflow-auto rounded-xl bg-slate-950 p-4 text-xs font-mono text-emerald-400 border border-border">
              <code>{jsonContent}</code>
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL BÁO CÁO SQL/JSON: ORACLE 23ai JSON_TABLE & JSON_VALUE */}
      <Dialog open={isJsonTableModalOpen} onOpenChange={setIsJsonTableModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Table className="h-5 w-5 text-emerald-600" /> Báo Cáo Triệu Chứng Lâm Sàng (Oracle 23ai JSON_TABLE)
              </DialogTitle>
              <Badge variant="outline" className="border-emerald-600 text-emerald-600 font-mono text-xs">
                JSON_TABLE + JSON_VALUE
              </Badge>
            </div>
            <DialogDescription>
              Minh họa tính năng giải nén mảng JSON (<code>$.symptoms[*]</code>) lồng nhau thành các dòng dữ liệu quan hệ kết hợp trích xuất chỉ số sinh tồn bằng <code>JSON_VALUE</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="p-3 bg-muted/40 rounded-lg border border-border text-xs font-mono text-muted-foreground overflow-x-auto">
              <code>
                SELECT mr.record_id, p.full_name, JSON_VALUE(mr.record_json, '$.vitals.temperature') AS temp, jt.*
                <br />
                FROM MEDICAL_RECORDS mr, JSON_TABLE(mr.record_json, '$.symptoms[*]' COLUMNS (symptom_name PATH '$.name', severity PATH '$.severity')) jt;
              </code>
            </div>

            {isLoadingJsonTable ? (
              <div className="py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" /> Đang truy vấn từ Oracle 23ai...
              </div>
            ) : jsonTableRows.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Chưa có dữ liệu triệu chứng dạng mảng trong CSDL. Hãy lưu bệnh án mới có mảng triệu chứng để quan sát.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto border border-border rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 border-b border-border sticky top-0 font-semibold text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3">Bệnh Án</th>
                      <th className="py-2.5 px-3">Bệnh Nhân</th>
                      <th className="py-2.5 px-3">Triệu Chứng (Unnested)</th>
                      <th className="py-2.5 px-3">Mức Độ</th>
                      <th className="py-2.5 px-3">Thời Gian</th>
                      <th className="py-2.5 px-3">Chỉ Số (JSON_VALUE)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {jsonTableRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="py-2 px-3 font-mono text-primary font-bold">#{row.record_id}</td>
                        <td className="py-2 px-3 font-semibold text-foreground">
                          {row.patient_name}
                          <span className="block font-mono text-[10px] text-muted-foreground font-normal">
                            {row.medical_code}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-emerald-700 dark:text-emerald-400 font-semibold">
                          {row.symptom_name}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            Number(row.severity) >= 7
                              ? 'bg-rose-500/10 text-rose-600'
                              : Number(row.severity) >= 5
                              ? 'bg-amber-500/10 text-amber-600'
                              : 'bg-emerald-500/10 text-emerald-600'
                          }`}>
                            Cấp {row.severity}/10
                          </span>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{row.duration || 'N/A'}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">
                          {row.temperature ? `${row.temperature}°C` : '--'} | SpO2: {row.spo2 ? `${row.spo2}%` : '--'} | {row.blood_pressure || '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
