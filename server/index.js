import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDbPool, executeQuery, oracledb } from './db.js';
import { searchMedicalVectors } from './vector-search.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/ai-search', async (req, res) => {
  const { query, type } = req.body ?? {};
  if (typeof query !== 'string' || query.trim().length < 2 || query.length > 500) {
    return res.status(400).json({ error: 'Nhập nội dung tìm kiếm từ 2 đến 500 ký tự.' });
  }
  if (type !== 'symptoms' && type !== 'docs') {
    return res.status(400).json({ error: 'Loại tìm kiếm không hợp lệ.' });
  }

  try {
    const results = await searchMedicalVectors(query.trim(), type);
    res.json({ results, model: 'local-multilingual-384', topK: 5 });
  } catch (err) {
    console.error('Lỗi tìm kiếm vector y khoa:', err);
    res.status(503).json({
      error: 'Không thể tìm kiếm ngữ nghĩa. Hãy kiểm tra Oracle, migration 07 và mô hình embedding cục bộ.',
    });
  }
});

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

// 6.3 Oracle 23ai JSON_TRANSFORM: Cập nhật chỉ số sinh tồn cục bộ không thay toàn bộ document
app.patch('/api/records/:id/vitals', async (req, res) => {
  const record_id = Number(req.params.id);
  const { temperature, spo2, heart_rate, blood_pressure } = req.body;

  try {
    const tempNum = Number(temperature) || 37.0;
    const spo2Num = Number(spo2) || 98;
    const hrNum = Number(heart_rate) || 80;
    const bpStr = blood_pressure || '120/80';

    const sql = `
      UPDATE MEDICAL_RECORDS
      SET RECORD_JSON = JSON_TRANSFORM(
        RECORD_JSON,
        SET '$.vitals.temperature' = :temperature,
        SET '$.vitals.spo2' = :spo2,
        SET '$.vitals.heart_rate' = :heart_rate,
        SET '$.vitals.blood_pressure' = :blood_pressure
      )
      WHERE RECORD_ID = :record_id
    `;

    const binds = {
      temperature: tempNum,
      spo2: spo2Num,
      heart_rate: hrNum,
      blood_pressure: bpStr,
      record_id
    };

    const result = await executeQuery(sql, binds);
    res.json({
      success: true,
      rowsAffected: result.rowsAffected,
      message: `Đã cập nhật chỉ số sinh tồn của bệnh án #${record_id} bằng Oracle 23ai JSON_TRANSFORM thành công!`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6.4 Oracle 23ai JSON_TABLE & JSON_VALUE: Bung mảng triệu chứng thành dòng và trích xuất chỉ số
app.get('/api/records/analytics/symptoms-table', async (req, res) => {
  try {
    const sql = `
      SELECT 
        mr.RECORD_ID AS "record_id",
        mr.PATIENT_ID AS "patient_id",
        p.FULL_NAME AS "patient_name",
        p.MEDICAL_CODE AS "patient_code",
        JSON_VALUE(mr.RECORD_JSON, '$.vitals.temperature' RETURNING NUMBER) AS "temperature",
        JSON_VALUE(mr.RECORD_JSON, '$.vitals.spo2' RETURNING NUMBER) AS "spo2",
        JSON_VALUE(mr.RECORD_JSON, '$.vitals.heart_rate' RETURNING NUMBER) AS "heart_rate",
        JSON_VALUE(mr.RECORD_JSON, '$.vitals.blood_pressure') AS "blood_pressure",
        jt.symptom_name AS "symptom_name",
        jt.severity AS "severity",
        jt.duration AS "duration"
      FROM MEDICAL_RECORDS mr
      JOIN PATIENTS p ON mr.PATIENT_ID = p.PATIENT_ID,
      JSON_TABLE(mr.RECORD_JSON, '$.symptoms[*]'
        COLUMNS (
          symptom_name VARCHAR2(200) PATH '$.name',
          severity     NUMBER        PATH '$.severity',
          duration     VARCHAR2(100) PATH '$.duration'
        )
      ) jt
      ORDER BY mr.RECORD_ID DESC, jt.severity DESC
    `;
    const result = await executeQuery(sql);
    res.json(result.rows);
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

// 8. Referrals (Quản lý chuyển tuyến liên viện - Kết nối PKG_HOSPITAL_OPS.CREATE_REFERRAL)
app.get('/api/referrals', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT 
        r.REFERRAL_ID AS "id",
        'CT-2024-' || LPAD(r.REFERRAL_ID, 4, '0') AS "referral_code",
        r.PATIENT_ID AS "patient_id",
        p.FULL_NAME AS "patient_name",
        p.MEDICAL_CODE AS "patient_code",
        r.FROM_HOSPITAL_ID AS "from_hospital_id",
        hFrom.NAME AS "from_facility",
        NVL(hFrom.LEVEL_NAME, 'Tuyến Tỉnh') AS "from_tier",
        r.TO_HOSPITAL_ID AS "to_hospital_id",
        hTo.NAME AS "to_facility",
        NVL(hTo.LEVEL_NAME, 'Tuyến Trung Ương') AS "to_tier",
        NVL(doc.FULL_NAME, 'BS. CKII Lê Văn Thành') AS "doctor_approval",
        TO_CHAR(r.REASON) AS "reason",
        TO_CHAR(r.REASON) AS "initial_diagnosis",
        CASE 
          WHEN r.URGENCY = 'EMERGENCY' THEN 'Cấp cứu'
          WHEN r.URGENCY = 'URGENT' THEN 'Khẩn cấp'
          ELSE 'Thông thường'
        END AS "priority",
        CASE 
          WHEN r.STATUS = 'PENDING' THEN 'Chờ duyệt'
          WHEN r.STATUS = 'ACCEPTED' THEN 'Đã tiếp nhận'
          WHEN r.STATUS = 'REJECTED' THEN 'Từ chối'
          WHEN r.STATUS = 'COMPLETED' THEN 'Hoàn tất'
          ELSE 'Đang chuyển bệnh'
        END AS "status",
        'Xe cứu thương chuyên dụng' AS "transport_type",
        TO_CHAR(r.REFERRAL_TIME, 'YYYY-MM-DD HH24:MI') AS "transfer_date"
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

// Tạo phiếu chuyển tuyến bằng PKG_HOSPITAL_OPS.CREATE_REFERRAL
app.post('/api/referrals', async (req, res) => {
  const {
    patient_id,
    from_hospital_id,
    to_hospital_id,
    from_facility,
    to_facility,
    reason,
    initial_diagnosis,
    priority,
    doctor_approval
  } = req.body;

  try {
    let fromId = Number(from_hospital_id);
    let toId = Number(to_hospital_id);

    if (!fromId && from_facility) {
      try {
        const hRes = await executeQuery(`SELECT HOSPITAL_ID FROM HOSPITALS WHERE NAME LIKE :n AND ROWNUM = 1`, { n: `%${from_facility}%` });
        if (hRes.rows && hRes.rows[0]) fromId = hRes.rows[0].HOSPITAL_ID;
      } catch (e) { }
    }

    if (!toId && to_facility) {
      try {
        const hRes = await executeQuery(`SELECT HOSPITAL_ID FROM HOSPITALS WHERE NAME LIKE :n AND ROWNUM = 1`, { n: `%${to_facility}%` });
        if (hRes.rows && hRes.rows[0]) toId = hRes.rows[0].HOSPITAL_ID;
      } catch (e) { }
    }

    if (!fromId) fromId = 101;
    if (!toId) toId = 1;

    if (fromId === toId) {
      toId = fromId === 1 ? 103 : 1;
    }

    let urgencyDb = 'NORMAL';
    if (priority === 'Cấp cứu' || priority === 'EMERGENCY') urgencyDb = 'EMERGENCY';
    else if (priority === 'Khẩn cấp' || priority === 'URGENT') urgencyDb = 'URGENT';

    const fullReason = (initial_diagnosis ? `[Chẩn đoán: ${initial_diagnosis}] ` : '') + (reason || 'Chuyển tuyến điều trị chuyên khoa');

    const sql = `
      BEGIN
        pkg_hospital_ops.create_referral(
          p_patient_id    => :patient_id,
          p_from_hospital => :from_id,
          p_to_hospital   => :to_id,
          p_reason        => :reason,
          p_urgency       => :urgency,
          p_referral_id   => :out_id
        );
      END;
    `;

    const binds = {
      patient_id: Number(patient_id) || 1,
      from_id: fromId,
      to_id: toId,
      reason: fullReason,
      urgency: urgencyDb,
      out_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
    };

    const result = await executeQuery(sql, binds);
    const createdId = result.outBinds.out_id;
    const referralCode = `CT-2024-${String(createdId).padStart(4, '0')}`;

    // Ghi nhật ký kiểm toán AUDIT_LOGS
    await executeQuery(`
      INSERT INTO AUDIT_LOGS (ENTITY_NAME, ACTION, ENTITY_ID, ACTOR_IDENTIFIER, NEW_DATA)
      VALUES ('REFERRALS', 'INSERT', :entity_id, :actor, :json_data)
    `, {
      entity_id: createdId,
      actor: doctor_approval || 'BS. CKII Lê Văn Thành',
      json_data: JSON.stringify({
        referral_code: referralCode,
        patient_id: Number(patient_id) || 1,
        from_hospital_id: fromId,
        to_hospital_id: toId,
        urgency: urgencyDb,
        reason: fullReason
      })
    });

    res.status(201).json({
      success: true,
      referral_id: createdId,
      referral_code: referralCode,
      message: 'Đã tạo phiếu chuyển tuyến thành công bằng PKG_HOSPITAL_OPS.CREATE_REFERRAL'
    });
  } catch (err) {
    console.error('Lỗi tạo referral:', err);
    res.status(500).json({ error: err.message });
  }
});

// Cập nhật trạng thái phiếu chuyển tuyến
app.patch('/api/referrals/:id/status', async (req, res) => {
  const referral_id = Number(req.params.id);
  const { status, doctor } = req.body;

  try {
    let statusDb = 'PENDING';
    if (status === 'Đã tiếp nhận') statusDb = 'ACCEPTED';
    else if (status === 'Từ chối') statusDb = 'REJECTED';
    else if (status === 'Hoàn tất') statusDb = 'COMPLETED';
    else if (status === 'Đang chuyển bệnh') statusDb = 'ACCEPTED';
    else if (['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED'].includes(status)) {
      statusDb = status;
    }

    const sql = `
      UPDATE REFERRALS
      SET STATUS = :status,
          ACCEPTED_AT = CASE WHEN :status = 'ACCEPTED' AND ACCEPTED_AT IS NULL THEN SYSTIMESTAMP ELSE ACCEPTED_AT END,
          COMPLETED_AT = CASE WHEN :status = 'COMPLETED' AND COMPLETED_AT IS NULL THEN SYSTIMESTAMP ELSE COMPLETED_AT END
      WHERE REFERRAL_ID = :referral_id
    `;

    await executeQuery(sql, { status: statusDb, referral_id });

    // Ghi nhật ký kiểm toán AUDIT_LOGS
    await executeQuery(`
      INSERT INTO AUDIT_LOGS (ENTITY_NAME, ACTION, ENTITY_ID, ACTOR_IDENTIFIER, NEW_DATA)
      VALUES ('REFERRALS', 'UPDATE', :entity_id, :actor, :json_data)
    `, {
      entity_id: referral_id,
      actor: doctor || 'BS. Trực Cấp Cứu',
      json_data: JSON.stringify({ status: statusDb, vi_status: status })
    });

    res.json({
      success: true,
      message: `Đã cập nhật trạng thái phiếu chuyển tuyến #${referral_id} thành ${statusDb}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cập nhật trạng thái phiếu chuyển tuyến (alias cho route không có /status)
app.patch('/api/referrals/:id', async (req, res) => {
  const referral_id = Number(req.params.id);
  const { status, doctor } = req.body;

  try {
    let statusDb = 'PENDING';
    if (status === 'Đã tiếp nhận') statusDb = 'ACCEPTED';
    else if (status === 'Từ chối') statusDb = 'REJECTED';
    else if (status === 'Hoàn tất') statusDb = 'COMPLETED';
    else if (status === 'Đang chuyển bệnh') statusDb = 'ACCEPTED';
    else if (['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED'].includes(status)) {
      statusDb = status;
    }

    const sql = `
      UPDATE REFERRALS
      SET STATUS = :status,
          ACCEPTED_AT = CASE WHEN :status = 'ACCEPTED' AND ACCEPTED_AT IS NULL THEN SYSTIMESTAMP ELSE ACCEPTED_AT END,
          COMPLETED_AT = CASE WHEN :status = 'COMPLETED' AND COMPLETED_AT IS NULL THEN SYSTIMESTAMP ELSE COMPLETED_AT END
      WHERE REFERRAL_ID = :referral_id
    `;

    await executeQuery(sql, { status: statusDb, referral_id });

    // Ghi nhật ký kiểm toán AUDIT_LOGS
    await executeQuery(`
      INSERT INTO AUDIT_LOGS (ENTITY_NAME, ACTION, ENTITY_ID, ACTOR_IDENTIFIER, NEW_DATA)
      VALUES ('REFERRALS', 'UPDATE', :entity_id, :actor, :json_data)
    `, {
      entity_id: referral_id,
      actor: doctor || 'BS. Trực Cấp Cứu',
      json_data: JSON.stringify({ status: statusDb, vi_status: status })
    });

    res.json({
      success: true,
      message: `Đã cập nhật trạng thái phiếu chuyển tuyến #${referral_id} thành ${statusDb}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 8.1 ORACLE 23ai SQL PROPERTY GRAPH APIs (hospital_referral_graph & GRAPH_TABLE)
// ============================================================================

// A. Lấy cấu trúc toàn bộ đồ thị (Nodes & Edges) có tính toán Inflow / Outflow thật
app.get('/api/graph/overview', async (req, res) => {
  try {
    // 1. Lấy danh sách các đỉnh (Hospitals) kèm số ca chuyển đến/đi thực tế từ DB
    const nodesRes = await executeQuery(`
      SELECT 
        h.HOSPITAL_ID AS "id",
        h.CODE AS "code",
        h.NAME AS "name",
        NVL(h.LEVEL_NAME, 'Tuyến Cơ Sở') AS "tier",
        NVL(h.PROVINCE, 'Việt Nam') AS "city",
        h.ADDRESS AS "address",
        NVL(inf.cnt, 0) AS "inflow",
        NVL(outf.cnt, 0) AS "outflow",
        CASE 
          WHEN h.LEVEL_NAME LIKE '%Trung Ương%' OR h.LEVEL_NAME LIKE '%Đặc Biệt%' THEN 4
          WHEN h.LEVEL_NAME LIKE '%Tỉnh%' OR h.LEVEL_NAME LIKE '%Hạng I%' THEN 3
          WHEN h.LEVEL_NAME LIKE '%Huyện%' OR h.LEVEL_NAME LIKE '%Hạng II%' OR h.LEVEL_NAME LIKE '%Hạng III%' THEN 2
          ELSE 1
        END AS "level",
        CASE 
          WHEN h.LEVEL_NAME LIKE '%Trung Ương%' OR h.LEVEL_NAME LIKE '%Đặc Biệt%' THEN 2500
          WHEN h.LEVEL_NAME LIKE '%Tỉnh%' OR h.LEVEL_NAME LIKE '%Hạng I%' THEN 600
          WHEN h.LEVEL_NAME LIKE '%Huyện%' THEN 180
          ELSE 30
        END AS "capacityBeds",
        CASE 
          WHEN h.NAME LIKE '%Bạch Mai%' THEN 'Hồi sức cấp cứu, Tim mạch, Chống độc TW'
          WHEN h.NAME LIKE '%Việt Đức%' THEN 'Ngoại khoa, Phẫu thuật sọ não, Ghép tạng'
          WHEN h.NAME LIKE '%Chợ Rẫy%' THEN 'Đa khoa chuyên sâu, Can thiệp tim mạch phía Nam'
          WHEN h.NAME LIKE '%Hải Dương%' THEN 'Đa khoa chuyên sâu tuyến tỉnh, Cấp cứu 24/7'
          WHEN h.NAME LIKE '%Gia Lâm%' THEN 'Nội - Ngoại - Sản cơ bản, Tiếp nhận ban đầu'
          WHEN h.NAME LIKE '%Cầu Giấy%' THEN 'Khám chữa bệnh ngoại trú & Đa khoa khu vực'
          ELSE 'Sơ cứu ban đầu, Điều trị tổng quát'
        END AS "specialtyFocus"
      FROM HOSPITALS h
      LEFT JOIN (
        SELECT TO_HOSPITAL_ID, COUNT(*) AS cnt FROM REFERRALS WHERE STATUS IN ('ACCEPTED', 'COMPLETED', 'PENDING') GROUP BY TO_HOSPITAL_ID
      ) inf ON h.HOSPITAL_ID = inf.TO_HOSPITAL_ID
      LEFT JOIN (
        SELECT FROM_HOSPITAL_ID, COUNT(*) AS cnt FROM REFERRALS WHERE STATUS IN ('ACCEPTED', 'COMPLETED', 'PENDING') GROUP BY FROM_HOSPITAL_ID
      ) outf ON h.HOSPITAL_ID = outf.FROM_HOSPITAL_ID
      ORDER BY "level" ASC, h.HOSPITAL_ID ASC
    `);

    // 2. Lấy danh sách các cạnh (Edges) đang hoạt động trong mạng lưới
    const edgesRes = await executeQuery(`
      SELECT 
        r.REFERRAL_ID AS "id",
        r.FROM_HOSPITAL_ID AS "source",
        r.TO_HOSPITAL_ID AS "target",
        hFrom.NAME AS "from_hospital",
        hTo.NAME AS "to_hospital",
        r.URGENCY AS "urgency",
        r.STATUS AS "status",
        p.FULL_NAME AS "patient_name",
        TO_CHAR(r.REFERRAL_TIME, 'YYYY-MM-DD HH24:MI') AS "referral_time"
      FROM REFERRALS r
      JOIN HOSPITALS hFrom ON r.FROM_HOSPITAL_ID = hFrom.HOSPITAL_ID
      JOIN HOSPITALS hTo ON r.TO_HOSPITAL_ID = hTo.HOSPITAL_ID
      JOIN PATIENTS p ON r.PATIENT_ID = p.PATIENT_ID
      ORDER BY r.REFERRAL_TIME DESC
    `);

    res.json({
      nodes: nodesRes.rows,
      edges: edgesRes.rows,
      stats: {
        totalNodes: nodesRes.rows.length,
        totalEdges: edgesRes.rows.length,
        activeTransfers: edgesRes.rows.filter(e => e.status === 'ACCEPTED' || e.status === 'PENDING').length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// B. Truy vấn GRAPH_TABLE: Tìm các đường đi 1 chặng và 2 chặng trong đồ thị
app.get('/api/graph/routes', async (req, res) => {
  try {
    let directRoutes = [];
    try {
      const q1 = await executeQuery(`
        SELECT *
        FROM GRAPH_TABLE (
          hospital_referral_graph
          MATCH (src IS hospital) -[r IS referred_to]-> (dst IS hospital)
          WHERE r.status IN ('ACCEPTED', 'COMPLETED')
          COLUMNS (
            src.hospital_id   AS from_id,
            src.code          AS from_code,
            src.name          AS from_hospital,
            dst.hospital_id   AS to_id,
            dst.code          AS to_code,
            dst.name          AS to_hospital,
            r.referral_id     AS referral_id,
            r.urgency         AS urgency,
            r.status          AS status
          )
        )
        ORDER BY from_hospital, to_hospital
      `);
      directRoutes = q1.rows;
    } catch (e1) {
      console.warn('GRAPH_TABLE 1-hop warning, fallback to relational view:', e1.message);
    }

    let twoHopRoutes = [];
    try {
      const q2 = await executeQuery(`
        SELECT *
        FROM GRAPH_TABLE (
          hospital_referral_graph
          MATCH (a IS hospital) -[r1 IS referred_to]-> (b IS hospital)
                                -[r2 IS referred_to]-> (c IS hospital)
          WHERE r1.status IN ('ACCEPTED', 'COMPLETED')
            AND r2.status IN ('ACCEPTED', 'COMPLETED')
            AND a.hospital_id <> c.hospital_id
          COLUMNS (
            a.hospital_id     AS from_id,
            a.name            AS from_hospital,
            b.hospital_id     AS mid_id,
            b.name            AS mid_hospital,
            c.hospital_id     AS to_id,
            c.name            AS to_hospital,
            r1.referral_id    AS hop1_ref_id,
            r2.referral_id    AS hop2_ref_id,
            r1.urgency        AS hop1_urgency,
            r2.urgency        AS hop2_urgency
          )
        )
        ORDER BY from_hospital, to_hospital
      `);
      twoHopRoutes = q2.rows;
    } catch (e2) {
      console.warn('GRAPH_TABLE 2-hop warning:', e2.message);
    }

    res.json({
      graph_name: 'hospital_referral_graph',
      direct_routes: directRoutes,
      two_hop_routes: twoHopRoutes,
      executed_queries: [
        "GRAPH_TABLE (hospital_referral_graph MATCH (src IS hospital) -[r IS referred_to]-> (dst IS hospital) ...)",
        "GRAPH_TABLE (hospital_referral_graph MATCH (a) -[r1]-> (b) -[r2]-> (c) ...)"
      ]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// C. Truy vấn tìm đường đi cụ thể giữa 2 bệnh viện bằng GRAPH_TABLE MATCH {1,2}
app.post('/api/graph/path-finder', async (req, res) => {
  const fromHospitalId = Number(req.body?.from_id);
  const toHospitalId = Number(req.body?.to_id);

  if (!fromHospitalId || !toHospitalId) {
    return res.status(400).json({ error: 'Vui lòng chọn cơ sở xuất phát và cơ sở đích.' });
  }

  const sqlGraphQuery = `
    SELECT *
    FROM GRAPH_TABLE (
      hospital_referral_graph
      MATCH (src IS hospital)
            -[r IS referred_to WHERE r.status IN ('ACCEPTED', 'COMPLETED', 'PENDING')]->{1,2}
            (dst IS hospital)
      WHERE src.hospital_id = :from_id
        AND dst.hospital_id = :to_id
      COLUMNS (
        src.name                       AS from_hospital,
        dst.name                       AS to_hospital,
        COUNT(r.referral_id)           AS hops,
        LISTAGG(r.referral_id, ' -> ') AS path_referral_ids,
        LISTAGG(r.urgency, ' -> ')      AS urgency_path
      )
    )
    ORDER BY hops ASC
  `;

  try {
    const result = await executeQuery(sqlGraphQuery, {
      from_id: fromHospitalId,
      to_id: toHospitalId
    });

    res.json({
      success: true,
      from_id: fromHospitalId,
      to_id: toHospitalId,
      paths: result.rows,
      sql_used: sqlGraphQuery.trim()
    });
  } catch (err) {
    res.json({
      success: false,
      error: err.message,
      sql_used: sqlGraphQuery.trim()
    });
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

const PORT = Number(process.env.PORT) || 5003;

async function ensureReferralPropertyGraph() {
  try {
    await executeQuery(`
      CREATE PROPERTY GRAPH hospital_referral_graph
        VERTEX TABLES (
          HOSPITALS
            KEY (HOSPITAL_ID)
            LABEL hospital
            PROPERTIES (HOSPITAL_ID, CODE, NAME, LEVEL_NAME, PROVINCE)
        )
        EDGE TABLES (
          REFERRALS
            KEY (REFERRAL_ID)
            SOURCE KEY (FROM_HOSPITAL_ID) REFERENCES HOSPITALS (HOSPITAL_ID)
            DESTINATION KEY (TO_HOSPITAL_ID) REFERENCES HOSPITALS (HOSPITAL_ID)
            LABEL referred_to
            PROPERTIES (REFERRAL_ID, PATIENT_ID, URGENCY, STATUS, REFERRAL_TIME, REASON)
        )
    `);
    console.log('✅ Oracle 23ai Property Graph hospital_referral_graph đã sẵn sàng!');
  } catch (err) {
    if (err.message && (err.message.includes('ORA-00955') || err.message.includes('already exists'))) {
      console.log('ℹ️ Property Graph hospital_referral_graph đã tồn tại sẵn trong Oracle 23ai.');
    } else {
      console.warn('⚠️ Ghi chú Property Graph:', err.message);
    }
  }
}

initDbPool().then(async () => {
  await ensureReferralPropertyGraph();
  app.listen(PORT, () => {
    console.log(`🚀 Medicore Oracle 23ai API Server đang chạy tại http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Không thể khởi động server:', err);
});

