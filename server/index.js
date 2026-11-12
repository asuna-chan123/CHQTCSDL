import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDbPool, executeQuery, oracledb } from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. Health check & Oracle version info
app.get('/api/health', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT BANNER_FULL FROM V$VERSION WHERE ROWNUM = 1
    `);
    const timeRes = await executeQuery(`SELECT SYSTIMESTAMP AS SERVER_TIME FROM DUAL`);
    res.json({
      status: 'healthy',
      database: 'Oracle Database 23ai',
      banner: result.rows[0]?.BANNER_FULL,
      serverTime: timeRes.rows[0]?.SERVER_TIME,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// 2. Hospitals
app.get('/api/hospitals', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT HOSPITAL_ID, CODE, NAME, LEVEL_NAME, PROVINCE, ADDRESS 
      FROM HOSPITALS 
      ORDER BY HOSPITAL_ID
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Departments
app.get('/api/departments', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT d.DEPARTMENT_ID, d.HOSPITAL_ID, d.CODE, d.NAME, d.SPECIALTY, h.NAME AS HOSPITAL_NAME
      FROM DEPARTMENTS d
      LEFT JOIN HOSPITALS h ON d.HOSPITAL_ID = h.HOSPITAL_ID
      ORDER BY d.DEPARTMENT_ID
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Doctors
app.get('/api/doctors', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT doc.DOCTOR_ID, doc.FULL_NAME, doc.LICENSE_NO, doc.PHONE,
             dept.NAME AS DEPARTMENT_NAME, hosp.NAME AS HOSPITAL_NAME
      FROM DOCTORS doc
      JOIN DEPARTMENTS dept ON doc.DEPARTMENT_ID = dept.DEPARTMENT_ID
      JOIN HOSPITALS hosp ON dept.HOSPITAL_ID = hosp.HOSPITAL_ID
      ORDER BY doc.DOCTOR_ID
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Patients
app.get('/api/patients', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT 
        PATIENT_ID AS "id",
        MEDICAL_CODE AS "medical_code",
        FULL_NAME AS "full_name",
        TO_CHAR(DOB, 'YYYY-MM-DD') AS "dob",
        CASE 
          WHEN GENDER = 'MALE' THEN 'Nam'
          WHEN GENDER = 'FEMALE' THEN 'Nữ'
          ELSE 'Khác'
        END AS "gender",
        PHONE AS "phone",
        ADDRESS AS "address",
        TO_CHAR(CREATED_AT, 'YYYY-MM-DD') AS "created_at"
      FROM PATIENTS
      ORDER BY PATIENT_ID DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/patients', async (req, res) => {
  const { medical_code, full_name, dob, gender, phone, address } = req.body;
  try {
    const genderDb = gender === 'Nam' ? 'MALE' : gender === 'Nữ' ? 'FEMALE' : 'OTHER';
    const sql = `
      INSERT INTO PATIENTS (MEDICAL_CODE, FULL_NAME, DOB, GENDER, PHONE, ADDRESS)
      VALUES (:medical_code, :full_name, TO_DATE(:dob, 'YYYY-MM-DD'), :genderDb, :phone, :address)
      RETURNING PATIENT_ID INTO :out_id
    `;
    const binds = {
      medical_code,
      full_name,
      dob,
      genderDb,
      phone,
      address,
      out_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
    };
    const result = await executeQuery(sql, binds);
    
    // Ghi audit log
    await executeQuery(`
      INSERT INTO AUDIT_LOGS (ENTITY_NAME, ACTION, ENTITY_ID, ACTOR_IDENTIFIER, NEW_DATA)
      VALUES ('PATIENTS', 'INSERT', :entity_id, 'HỆ THỐNG', :json_data)
    `, {
      entity_id: result.outBinds.out_id[0],
      json_data: JSON.stringify({ medical_code, full_name, phone })
    });

    res.status(201).json({
      success: true,
      patientId: result.outBinds.out_id[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Appointments
app.get('/api/appointments', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT 
        a.APPOINTMENT_ID AS "id",
        a.PATIENT_ID AS "patient_id",
        p.FULL_NAME AS "patient_name",
        p.MEDICAL_CODE AS "medical_code",
        doc.FULL_NAME AS "doctor_name",
        dept.NAME AS "department",
        TO_CHAR(a.SCHEDULED_AT, 'YYYY-MM-DD"T"HH24:MI:SS') AS "scheduled_at",
        a.STATUS AS "status",
        a.SYMPTOMS AS "symptoms"
      FROM APPOINTMENTS a
      JOIN PATIENTS p ON a.PATIENT_ID = p.PATIENT_ID
      LEFT JOIN DOCTORS doc ON a.DOCTOR_ID = doc.DOCTOR_ID
      JOIN DEPARTMENTS dept ON a.DEPARTMENT_ID = dept.DEPARTMENT_ID
      ORDER BY a.SCHEDULED_AT ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Đặt lịch thông qua PKG_HOSPITAL_OPS.BOOK_APPOINTMENT
app.post('/api/appointments', async (req, res) => {
  const { patient_id, doctor_id, department_id, scheduled_at, symptoms } = req.body;
  try {
    const formattedDate = scheduled_at ? scheduled_at.replace('T', ' ').substring(0, 19) : new Date().toISOString().replace('T', ' ').substring(0, 19);
    const sql = `
      BEGIN
        pkg_hospital_ops.book_appointment(
          p_patient_id     => :patient_id,
          p_doctor_id      => :doctor_id,
          p_department_id  => :department_id,
          p_scheduled_at   => TO_TIMESTAMP(:scheduled_at, 'YYYY-MM-DD HH24:MI:SS'),
          p_symptoms       => :symptoms,
          p_appointment_id => :out_id
        );
      END;
    `;
    const binds = {
      patient_id: Number(patient_id) || 1,
      doctor_id: Number(doctor_id) || 1,
      department_id: Number(department_id) || 1,
      scheduled_at: formattedDate,
      symptoms: symptoms || 'Khám tổng quát',
      out_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
    };
    const result = await executeQuery(sql, binds);
    res.status(201).json({
      success: true,
      appointment_id: result.outBinds.out_id
    });
  } catch (err) {
    if (err.message && (err.message.includes('ORA-20002') || err.message.includes('ORA-00001'))) {
      return res.status(409).json({
        success: false,
        error: 'SLOT_ALREADY_BOOKED: Bác sĩ đã có lịch hẹn tại thời điểm này (Phát hiện xung đột từ CSDL).'
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// Phân giường an toàn thông qua PKG_HOSPITAL_OPS.ADMIT_PATIENT (SKIP LOCKED)
app.post('/api/admissions', async (req, res) => {
  const { patient_id, department_id } = req.body;
  try {
    const sql = `
      BEGIN
        pkg_hospital_ops.admit_patient(
          p_patient_id    => :patient_id,
          p_department_id => :department_id,
          p_admission_id  => :out_id
        );
      END;
    `;
    const binds = {
      patient_id: Number(patient_id) || 1,
      department_id: Number(department_id) || 1,
      out_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
    };
    const result = await executeQuery(sql, binds);
    res.status(201).json({
      success: true,
      admission_id: result.outBinds.out_id
    });
  } catch (err) {
    if (err.message && err.message.includes('ORA-20003')) {
      return res.status(409).json({
        success: false,
        error: 'PATIENT_ALREADY_ADMITTED: Bệnh nhân hiện đang điều trị nội trú và đã có giường bệnh. Cần làm thủ tục xuất viện trước khi tiếp nhận lượt mới!'
      });
    }
    if (err.message && err.message.includes('ORA-20001')) {
      return res.status(409).json({
        success: false,
        error: 'NO_BED_AVAILABLE: Không còn giường trống tại khoa này (Toàn bộ giường đã kín hoặc đang bị khóa).'
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// Xuất viện và giải phóng giường thông qua PKG_HOSPITAL_OPS.DISCHARGE_PATIENT
app.post('/api/admissions/discharge', async (req, res) => {
  const { patient_id } = req.body;
  try {
    const sql = `
      BEGIN
        pkg_hospital_ops.discharge_patient(
          p_patient_id   => :patient_id,
          p_admission_id => :out_id
        );
      END;
    `;
    const binds = {
      patient_id: Number(patient_id) || 1,
      out_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
    };
    const result = await executeQuery(sql, binds);
    res.json({
      success: true,
      admission_id: result.outBinds.out_id,
      message: 'Đã hoàn tất xuất viện và giải phóng giường bệnh trở lại trạng thái AVAILABLE.'
    });
  } catch (err) {
    if (err.message && err.message.includes('ORA-20004')) {
      return res.status(404).json({
        success: false,
        error: 'NO_ACTIVE_ADMISSION: Bệnh nhân không có hồ sơ điều trị nội trú đang hoạt động.'
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6.2 Medical Records (Bệnh án JSON & Kích hoạt Triggers)
app.get('/api/records', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT 
        mr.RECORD_ID AS "id",
        mr.PATIENT_ID AS "patient_id",
        p.MEDICAL_CODE AS "patient_code",
        p.FULL_NAME AS "patient_name",
        mr.APPOINTMENT_ID AS "appointment_id",
        mr.DOCTOR_ID AS "doctor_id",
        doc.FULL_NAME AS "doctor_name",
        dept.NAME AS "department",
        mr.DIAGNOSIS_SUMMARY AS "diagnosis_summary",
        mr.RECORD_JSON AS "record_json",
        TO_CHAR(mr.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS') AS "created_at",
        TO_CHAR(mr.UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS') AS "updated_at"
      FROM MEDICAL_RECORDS mr
      JOIN PATIENTS p ON mr.PATIENT_ID = p.PATIENT_ID
      LEFT JOIN DOCTORS doc ON mr.DOCTOR_ID = doc.DOCTOR_ID
      LEFT JOIN DEPARTMENTS dept ON doc.DEPARTMENT_ID = dept.DEPARTMENT_ID
      ORDER BY mr.RECORD_ID DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tạo bệnh án JSON mới -> Kích hoạt Trigger trg_medical_records_audit (INSERT)
app.post('/api/records', async (req, res) => {
  const { patient_id, appointment_id, doctor_id, diagnosis_summary, record_json } = req.body;
  try {
    const jsonStr = typeof record_json === 'string' ? record_json : JSON.stringify(record_json || {});
    const sql = `
      INSERT INTO MEDICAL_RECORDS (PATIENT_ID, APPOINTMENT_ID, DOCTOR_ID, DIAGNOSIS_SUMMARY, RECORD_JSON)
      VALUES (:patient_id, :appointment_id, :doctor_id, :diagnosis_summary, :record_json)
      RETURNING RECORD_ID INTO :out_id
    `;
    const binds = {
      patient_id: Number(patient_id) || 1,
      appointment_id: appointment_id ? Number(appointment_id) : null,
      doctor_id: Number(doctor_id) || 1,
      diagnosis_summary: diagnosis_summary || 'Chẩn đoán lâm sàng',
      record_json: jsonStr,
      out_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
    };
    const result = await executeQuery(sql, binds);
    res.status(201).json({
      success: true,
      record_id: result.outBinds.out_id[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sửa bệnh án JSON -> Kích hoạt Trigger trg_medical_records_bu và trg_medical_records_audit (UPDATE)
app.put('/api/records/:id', async (req, res) => {
  const record_id = Number(req.params.id);
  const { diagnosis_summary, record_json } = req.body;
  try {
    const jsonStr = typeof record_json === 'string' ? record_json : JSON.stringify(record_json || {});
    const sql = `
      UPDATE MEDICAL_RECORDS
      SET DIAGNOSIS_SUMMARY = :diagnosis_summary,
          RECORD_JSON = :record_json
      WHERE RECORD_ID = :record_id
    `;
    const binds = {
      record_id,
      diagnosis_summary: diagnosis_summary || 'Cập nhật diễn biến lâm sàng',
      record_json: jsonStr
    };
    await executeQuery(sql, binds);
    res.json({
      success: true,
      message: `Đã cập nhật bệnh án #${record_id} thành công vào Oracle 23ai. Trigger đã tự động ghi nhật ký kiểm toán.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/beds', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT 
        b.BED_ID AS "id",
        b.BED_CODE AS "code",
        b.STATUS AS "status",
        b.DEPARTMENT_ID AS "department_id",
        r.ROOM_NUMBER AS "room_number",
        r.ROOM_TYPE AS "room_type",
        r.FLOOR_NO AS "floor_no",
        d.NAME AS "department_name",
        p.FULL_NAME AS "patient_name",
        p.MEDICAL_CODE AS "patient_code",
        TO_CHAR(adm.ADMITTED_AT, 'YYYY-MM-DD') AS "admitted_date"
      FROM BEDS b
      JOIN ROOMS r ON b.ROOM_ID = r.ROOM_ID
      JOIN DEPARTMENTS d ON b.DEPARTMENT_ID = d.DEPARTMENT_ID
      LEFT JOIN ADMISSIONS adm ON b.BED_ID = adm.BED_ID AND adm.STATUS = 'ACTIVE'
      LEFT JOIN PATIENTS p ON adm.PATIENT_ID = p.PATIENT_ID
      ORDER BY b.BED_ID
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Referrals
app.get('/api/referrals', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT 
        r.REFERRAL_ID AS "id",
        p.FULL_NAME AS "patient_name",
        p.MEDICAL_CODE AS "medical_code",
        hFrom.NAME AS "from_hospital",
        hTo.NAME AS "to_hospital",
        doc.FULL_NAME AS "doctor_name",
        r.REASON AS "reason",
        r.DIAGNOSIS_SUMMARY AS "diagnosis_summary",
        r.URGENCY AS "urgency",
        r.STATUS AS "status",
        TO_CHAR(r.REFERRAL_TIME, 'YYYY-MM-DD HH24:MI') AS "referral_time"
      FROM REFERRALS r
      JOIN PATIENTS p ON r.PATIENT_ID = p.PATIENT_ID
      JOIN HOSPITALS hFrom ON r.FROM_HOSPITAL_ID = hFrom.HOSPITAL_ID
      JOIN HOSPITALS hTo ON r.TO_HOSPITAL_ID = hTo.HOSPITAL_ID
      LEFT JOIN DOCTORS doc ON r.REFERRED_BY_DOCTOR_ID = doc.DOCTOR_ID
      ORDER BY r.REFERRAL_TIME DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Audit Logs
app.get('/api/audit-logs', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT 
        LOG_ID AS "id",
        ENTITY_NAME AS "entity_name",
        ACTION AS "action",
        ENTITY_ID AS "entity_id",
        ACTOR_IDENTIFIER AS "actor_name",
        OLD_DATA AS "old_data",
        NEW_DATA AS "new_data",
        TO_CHAR(CREATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS "timestamp"
      FROM AUDIT_LOGS
      ORDER BY CREATED_AT DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;

initDbPool().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Medicore Oracle 23ai API Server đang chạy tại http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Không thể khởi động server:', err);
});

