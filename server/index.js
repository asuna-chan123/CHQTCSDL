import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDbPool, executeQuery, oracledb } from './db.js';
import {
  buildPatientList,
  buildTimeline,
  buildDashboardSummary,
  rankPatients,
  scoreSymptoms,
  mapVectorSymptoms,
} from './mappers.js';

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
      SELECT HOSPITAL_ID AS "id", CODE AS "code", NAME AS "name",
             LEVEL_NAME AS "level", PROVINCE AS "province", ADDRESS AS "address"
      FROM HOSPITALS 
      ORDER BY HOSPITAL_ID
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Departments (kèm số giường trống / tổng giường để UI chọn khoa tiếp nhận)
app.get('/api/departments', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT d.DEPARTMENT_ID AS "id", d.HOSPITAL_ID AS "hospital_id", d.CODE AS "code",
             d.NAME AS "name", d.SPECIALTY AS "specialty", h.NAME AS "hospital_name",
             (SELECT COUNT(*) FROM BEDS b
               WHERE b.DEPARTMENT_ID = d.DEPARTMENT_ID AND b.STATUS = 'AVAILABLE') AS "available_beds",
             (SELECT COUNT(*) FROM BEDS b
               WHERE b.DEPARTMENT_ID = d.DEPARTMENT_ID AND b.STATUS <> 'INACTIVE') AS "total_beds"
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
      SELECT doc.DOCTOR_ID AS "id", doc.FULL_NAME AS "name",
             doc.LICENSE_NO AS "license_no", doc.PHONE AS "phone",
             dept.DEPARTMENT_ID AS "department_id", dept.NAME AS "department",
             hosp.NAME AS "hospital"
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
// "Hôm nay" luôn tính theo múi giờ của phiên Oracle (CURRENT_DATE), không dùng SYSDATE
// (SYSDATE là giờ của máy chủ DB, có thể lệch 7 tiếng so với giờ Việt Nam).
const TODAY_PREDICATE = 'TRUNC(CAST(a.SCHEDULED_AT AS DATE)) = TRUNC(CURRENT_DATE)';
const OPEN_APPOINTMENT_STATUSES = `('CREATED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')`;

app.get('/api/patients', async (req, res) => {
  try {
    const [patients, activeAdmissions, waitingToday, recentDischarges, latestAppointments] =
      await Promise.all([
        executeQuery(`
          SELECT
            PATIENT_ID AS "id",
            MEDICAL_CODE AS "medical_code",
            FULL_NAME AS "full_name",
            TO_CHAR(DOB, 'YYYY-MM-DD') AS "dob",
            CASE
              WHEN GENDER IN ('MALE', 'Nam') THEN 'Nam'
              WHEN GENDER IN ('FEMALE', 'Nữ') THEN 'Nữ'
              ELSE 'Khác'
            END AS "gender",
            PHONE AS "phone",
            ADDRESS AS "address",
            TO_CHAR(CREATED_AT, 'YYYY-MM-DD') AS "created_at"
          FROM PATIENTS
          ORDER BY PATIENT_ID DESC
        `),
        executeQuery(`
          SELECT ad.PATIENT_ID AS "patient_id", d.NAME AS "department"
          FROM ADMISSIONS ad
          JOIN BEDS b ON ad.BED_ID = b.BED_ID
          JOIN DEPARTMENTS d ON b.DEPARTMENT_ID = d.DEPARTMENT_ID
          WHERE ad.STATUS = 'ACTIVE'
        `),
        executeQuery(`
          SELECT DISTINCT a.PATIENT_ID AS "patient_id"
          FROM APPOINTMENTS a
          WHERE a.STATUS IN ${OPEN_APPOINTMENT_STATUSES} AND ${TODAY_PREDICATE}
        `),
        executeQuery(`
          SELECT DISTINCT PATIENT_ID AS "patient_id"
          FROM ADMISSIONS
          WHERE STATUS = 'DISCHARGED' AND DISCHARGED_AT >= SYSTIMESTAMP - INTERVAL '30' DAY
        `),
        executeQuery(`
          SELECT PATIENT_ID AS "patient_id", DEPARTMENT_NAME AS "department"
          FROM (
            SELECT ap.PATIENT_ID, d.NAME AS DEPARTMENT_NAME,
                   ROW_NUMBER() OVER (PARTITION BY ap.PATIENT_ID ORDER BY ap.SCHEDULED_AT DESC) AS RN
            FROM APPOINTMENTS ap
            JOIN DEPARTMENTS d ON ap.DEPARTMENT_ID = d.DEPARTMENT_ID
          )
          WHERE RN = 1
        `),
      ]);

    res.json(
      buildPatientList({
        patients: patients.rows,
        activeAdmissions: activeAdmissions.rows,
        waitingToday: waitingToday.rows,
        recentDischarges: recentDischarges.rows,
        latestAppointments: latestAppointments.rows,
      })
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sinh mã hồ sơ dạng BN-<năm>-<số thứ tự 3 chữ số>, số thứ tự = lớn nhất hiện có + 1.
async function nextMedicalCode() {
  const prefix = `BN-${new Date().getFullYear()}-`;
  const result = await executeQuery(
    `SELECT NVL(MAX(TO_NUMBER(SUBSTR(MEDICAL_CODE, ${prefix.length + 1}) DEFAULT NULL ON CONVERSION ERROR)), 0) + 1 AS "next_seq"
       FROM PATIENTS
      WHERE MEDICAL_CODE LIKE :pattern`,
    { pattern: `${prefix}%` }
  );
  return `${prefix}${String(result.rows[0].next_seq).padStart(3, '0')}`;
}

app.post('/api/patients', async (req, res) => {
  const { full_name, dob, gender, phone, address } = req.body || {};
  const requestedCode = (req.body?.medical_code || '').trim();

  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ success: false, error: 'Họ tên bệnh nhân là bắt buộc.' });
  }
  if (dob && (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || new Date(dob) > new Date())) {
    return res.status(400).json({ success: false, error: 'Ngày sinh không hợp lệ (định dạng YYYY-MM-DD, không ở tương lai).' });
  }

  const genderDb = gender === 'Nam' ? 'MALE' : gender === 'Nữ' ? 'FEMALE' : 'OTHER';
  const sql = `
    INSERT INTO PATIENTS (MEDICAL_CODE, FULL_NAME, DOB, GENDER, PHONE, ADDRESS)
    VALUES (:medical_code, :full_name, CASE WHEN :dob IS NULL THEN NULL ELSE TO_DATE(:dob, 'YYYY-MM-DD') END, :genderDb, :phone, :address)
    RETURNING PATIENT_ID, MEDICAL_CODE INTO :out_id, :out_code
  `;

  // Mã do client gửi lên (nếu có) được tôn trọng; nếu không, server tự cấp.
  // Hai người đăng ký cùng lúc có thể sinh trùng mã -> thử lại tối đa 3 lần khi vi phạm UNIQUE.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const medical_code = requestedCode || (await nextMedicalCode());
    try {
      const result = await executeQuery(sql, {
        medical_code,
        full_name: full_name.trim(),
        dob: dob || null,
        genderDb,
        phone: phone || null,
        address: address || null,
        out_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
        out_code: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: 30 },
      });
      const patientId = result.outBinds.out_id[0];
      const savedCode = result.outBinds.out_code[0];

      // Ghi audit log; nếu ghi log lỗi thì không làm hỏng việc đăng ký bệnh nhân
      try {
        await executeQuery(
          `INSERT INTO AUDIT_LOGS (ENTITY_NAME, ACTION, ENTITY_ID, ACTOR_IDENTIFIER, NEW_DATA)
           VALUES ('PATIENTS', 'INSERT', :entity_id, 'HỆ THỐNG', :json_data)`,
          {
            entity_id: patientId,
            json_data: JSON.stringify({ medical_code: savedCode, full_name: full_name.trim(), phone }),
          }
        );
      } catch (auditErr) {
        console.warn('Không ghi được audit log cho bệnh nhân mới:', auditErr.message);
      }

      return res.status(201).json({ success: true, patientId, medical_code: savedCode });
    } catch (err) {
      const isDuplicate = err.message && err.message.includes('ORA-00001');
      if (isDuplicate && requestedCode) {
        return res.status(409).json({ success: false, error: `Mã hồ sơ ${requestedCode} đã tồn tại.` });
      }
      if (isDuplicate && attempt < 3) continue; // mã tự sinh bị trùng do đăng ký đồng thời -> sinh lại
      return res.status(500).json({ success: false, error: err.message });
    }
  }
});

// Timeline của MỘT bệnh nhân: lịch khám + bệnh án + chuyển tuyến + nhập/xuất viện
app.get('/api/patients/:id/timeline', async (req, res) => {
  const patientId = Number(req.params.id);
  if (!Number.isInteger(patientId)) {
    return res.status(400).json({ error: 'Mã bệnh nhân không hợp lệ.' });
  }
  const ts = `'YYYY-MM-DD HH24:MI:SS'`;
  try {
    const [appointments, records, referrals, admissions] = await Promise.all([
      executeQuery(
        `SELECT a.APPOINTMENT_ID AS "id",
                TO_CHAR(a.SCHEDULED_AT, ${ts}) AS "event_time",
                a.STATUS AS "status",
                a.SYMPTOMS AS "symptoms",
                doc.FULL_NAME AS "doctor",
                d.NAME AS "department",
                h.NAME AS "facility"
           FROM APPOINTMENTS a
           JOIN DEPARTMENTS d ON a.DEPARTMENT_ID = d.DEPARTMENT_ID
           JOIN HOSPITALS h ON d.HOSPITAL_ID = h.HOSPITAL_ID
           LEFT JOIN DOCTORS doc ON a.DOCTOR_ID = doc.DOCTOR_ID
          WHERE a.PATIENT_ID = :pid`,
        { pid: patientId }
      ),
      executeQuery(
        `SELECT mr.RECORD_ID AS "id",
                TO_CHAR(mr.CREATED_AT, ${ts}) AS "event_time",
                mr.DIAGNOSIS_SUMMARY AS "diagnosis",
                doc.FULL_NAME AS "doctor",
                d.NAME AS "department",
                h.NAME AS "facility"
           FROM MEDICAL_RECORDS mr
           LEFT JOIN DOCTORS doc ON mr.DOCTOR_ID = doc.DOCTOR_ID
           LEFT JOIN DEPARTMENTS d ON doc.DEPARTMENT_ID = d.DEPARTMENT_ID
           LEFT JOIN HOSPITALS h ON d.HOSPITAL_ID = h.HOSPITAL_ID
          WHERE mr.PATIENT_ID = :pid`,
        { pid: patientId }
      ),
      executeQuery(
        `SELECT r.REFERRAL_ID AS "id",
                TO_CHAR(r.REFERRAL_TIME, ${ts}) AS "event_time",
                r.STATUS AS "status",
                r.URGENCY AS "urgency",
                r.REASON AS "reason",
                hf.NAME AS "from_hospital",
                ht.NAME AS "to_hospital",
                doc.FULL_NAME AS "doctor"
           FROM REFERRALS r
           JOIN HOSPITALS hf ON r.FROM_HOSPITAL_ID = hf.HOSPITAL_ID
           JOIN HOSPITALS ht ON r.TO_HOSPITAL_ID = ht.HOSPITAL_ID
           LEFT JOIN DOCTORS doc ON r.REFERRED_BY_DOCTOR_ID = doc.DOCTOR_ID
          WHERE r.PATIENT_ID = :pid`,
        { pid: patientId }
      ),
      executeQuery(
        `SELECT ad.ADMISSION_ID AS "id",
                TO_CHAR(ad.ADMITTED_AT, ${ts}) AS "admitted_at",
                TO_CHAR(ad.DISCHARGED_AT, ${ts}) AS "discharged_at",
                ad.STATUS AS "status",
                b.BED_CODE AS "bed_code",
                d.NAME AS "department",
                h.NAME AS "facility"
           FROM ADMISSIONS ad
           LEFT JOIN BEDS b ON ad.BED_ID = b.BED_ID
           LEFT JOIN DEPARTMENTS d ON b.DEPARTMENT_ID = d.DEPARTMENT_ID
           LEFT JOIN HOSPITALS h ON d.HOSPITAL_ID = h.HOSPITAL_ID
          WHERE ad.PATIENT_ID = :pid`,
        { pid: patientId }
      ),
    ]);

    res.json(
      buildTimeline({
        appointments: appointments.rows,
        records: records.rows,
        referrals: referrals.rows,
        admissions: admissions.rows,
      })
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5.1 Dashboard: số liệu tổng quan lấy trực tiếp từ Oracle
app.get('/api/dashboard/summary', async (req, res) => {
  const todayFilter = `${TODAY_PREDICATE} AND a.STATUS <> 'CANCELLED'`;
  try {
    const [departments, todayByDept, todayList, upcoming, pendingCount, urgentCount, pendingList, inpatients] =
      await Promise.all([
        executeQuery(`
          SELECT d.DEPARTMENT_ID AS "department_id",
                 d.NAME AS "name",
                 h.NAME AS "hospital",
                 COUNT(b.BED_ID) AS "total_beds",
                 NVL(SUM(CASE WHEN b.STATUS = 'OCCUPIED' THEN 1 ELSE 0 END), 0) AS "occupied_beds",
                 NVL(SUM(CASE WHEN b.STATUS = 'AVAILABLE' THEN 1 ELSE 0 END), 0) AS "available_beds"
            FROM DEPARTMENTS d
            LEFT JOIN HOSPITALS h ON d.HOSPITAL_ID = h.HOSPITAL_ID
            LEFT JOIN BEDS b ON b.DEPARTMENT_ID = d.DEPARTMENT_ID AND b.STATUS <> 'INACTIVE'
           GROUP BY d.DEPARTMENT_ID, d.NAME, h.NAME
           ORDER BY d.DEPARTMENT_ID
        `),
        executeQuery(`
          SELECT a.DEPARTMENT_ID AS "department_id", COUNT(*) AS "cnt"
            FROM APPOINTMENTS a
           WHERE ${todayFilter}
           GROUP BY a.DEPARTMENT_ID
        `),
        executeQuery(`
          SELECT a.APPOINTMENT_ID AS "id",
                 a.PATIENT_ID AS "patient_id",
                 p.MEDICAL_CODE AS "patient_code",
                 p.FULL_NAME AS "patient_name",
                 TO_CHAR(a.SCHEDULED_AT, 'HH24:MI') AS "time_label",
                 d.NAME AS "department",
                 doc.FULL_NAME AS "doctor_name",
                 a.STATUS AS "status"
            FROM APPOINTMENTS a
            JOIN PATIENTS p ON a.PATIENT_ID = p.PATIENT_ID
            JOIN DEPARTMENTS d ON a.DEPARTMENT_ID = d.DEPARTMENT_ID
            LEFT JOIN DOCTORS doc ON a.DOCTOR_ID = doc.DOCTOR_ID
           WHERE ${todayFilter}
           ORDER BY a.SCHEDULED_AT
           FETCH FIRST 8 ROWS ONLY
        `),
        executeQuery(`
          SELECT COUNT(*) AS "cnt"
            FROM APPOINTMENTS a
           WHERE TRUNC(CAST(a.SCHEDULED_AT AS DATE)) > TRUNC(CURRENT_DATE)
             AND a.STATUS IN ${OPEN_APPOINTMENT_STATUSES}
        `),
        executeQuery(`SELECT COUNT(*) AS "cnt" FROM REFERRALS WHERE STATUS = 'PENDING'`),
        executeQuery(`SELECT COUNT(*) AS "cnt" FROM REFERRALS WHERE STATUS = 'PENDING' AND URGENCY <> 'NORMAL'`),
        executeQuery(`
          SELECT r.REFERRAL_ID AS "id",
                 p.FULL_NAME AS "patient_name",
                 p.MEDICAL_CODE AS "patient_code",
                 hf.NAME AS "from_hospital",
                 ht.NAME AS "to_hospital",
                 r.URGENCY AS "urgency",
                 r.REASON AS "reason"
            FROM REFERRALS r
            JOIN PATIENTS p ON r.PATIENT_ID = p.PATIENT_ID
            JOIN HOSPITALS hf ON r.FROM_HOSPITAL_ID = hf.HOSPITAL_ID
            JOIN HOSPITALS ht ON r.TO_HOSPITAL_ID = ht.HOSPITAL_ID
           WHERE r.STATUS = 'PENDING'
           ORDER BY CASE r.URGENCY WHEN 'EMERGENCY' THEN 1 WHEN 'URGENT' THEN 2 ELSE 3 END,
                    r.REFERRAL_TIME DESC
           FETCH FIRST 5 ROWS ONLY
        `),
        executeQuery(`SELECT COUNT(*) AS "cnt" FROM ADMISSIONS WHERE STATUS = 'ACTIVE'`),
      ]);

    res.json(
      buildDashboardSummary({
        departments: departments.rows,
        todayByDept: todayByDept.rows,
        todayList: todayList.rows,
        upcomingCount: upcoming.rows[0].cnt,
        pendingReferralCount: pendingCount.rows[0].cnt,
        urgentPendingCount: urgentCount.rows[0].cnt,
        pendingReferrals: pendingList.rows,
        inpatientCount: inpatients.rows[0].cnt,
      })
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5.2 Tìm kiếm nhanh cho Dashboard: bệnh nhân (mã / tên / SĐT, không phân biệt dấu) + gợi ý triệu chứng.
// Triệu chứng dùng Oracle 23ai AI Vector Search (VECTOR_DISTANCE) khi đã nạp model ONNX và đặt
// VECTOR_MODEL_NAME trong server/.env; nếu chưa có thì tự động rơi về tìm theo từ khóa trong bảng SYMPTOM_KNOWLEDGE.
app.get('/api/search/quick', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 200);
  if (q.length < 2) return res.json({ query: q, mode: 'none', patients: [], symptoms: [] });

  try {
    const patientRows = await executeQuery(
      `SELECT PATIENT_ID AS "id", MEDICAL_CODE AS "medical_code", FULL_NAME AS "full_name", PHONE AS "phone" FROM PATIENTS`
    );
    const patients = rankPatients(patientRows.rows, q);

    let symptoms = [];
    let mode = 'keyword';
    let warning;

    // Tên model được nối vào câu SQL (Oracle không cho bind tên model) nên bắt buộc kiểm tra định dạng
    const model = process.env.VECTOR_MODEL_NAME;
    if (model && /^[A-Za-z][A-Za-z0-9_$]{0,29}$/.test(model)) {
      try {
        const v = await executeQuery(
          `SELECT SYMPTOM_ID AS "id", NAME AS "name", DESCRIPTION AS "description",
                  VECTOR_DISTANCE(EMBEDDING, VECTOR_EMBEDDING(${model} USING :q AS data), COSINE) AS "distance"
             FROM SYMPTOM_KNOWLEDGE
            WHERE EMBEDDING IS NOT NULL
            ORDER BY "distance"
            FETCH FIRST 3 ROWS ONLY`,
          { q }
        );
        if (v.rows.length > 0) {
          symptoms = mapVectorSymptoms(v.rows);
          mode = 'vector';
        }
      } catch (vecErr) {
        warning = `Vector search chưa dùng được (${vecErr.message.split('\n')[0]}), đang dùng tìm theo từ khóa.`;
        console.warn(warning);
      }
    }

    if (mode !== 'vector') {
      const kb = await executeQuery(
        `SELECT SYMPTOM_ID AS "id", NAME AS "name", DESCRIPTION AS "description" FROM SYMPTOM_KNOWLEDGE`
      );
      symptoms = scoreSymptoms(kb.rows, q);
    }

    res.json({ query: q, mode, patients, symptoms, ...(warning ? { warning } : {}) });
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

app.patch('/api/appointments/:id', async (req, res) => {
  const appointmentId = Number(req.params.id);
  const statusByLabel = {
    'Đang chờ': 'CHECKED_IN',
    'Đã xác nhận': 'CONFIRMED',
    'Đang khám': 'IN_PROGRESS',
    'Đã khám': 'COMPLETED',
    'Đã hủy': 'CANCELLED',
    'Vắng mặt': 'NO_SHOW',
  };
  const status = statusByLabel[req.body?.status];

  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return res.status(400).json({ error: 'Mã lịch khám không hợp lệ.' });
  }
  if (!status) {
    return res.status(400).json({ error: 'Trạng thái lịch khám không hợp lệ.' });
  }

  try {
    const result = await executeQuery(
      `UPDATE APPOINTMENTS SET STATUS = :status WHERE APPOINTMENT_ID = :appointment_id`,
      { status, appointment_id: appointmentId }
    );
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Không tìm thấy lịch khám.' });
    }
    res.json({ success: true, appointment_id: appointmentId, status });
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

// 8. Referrals (Quản lý chuyển tuyến liên viện)
app.get('/api/referrals', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT r.REFERRAL_ID AS "id",
             'CT-2024-' || LPAD(r.REFERRAL_ID, 4, '0') AS "referral_code",
             r.PATIENT_ID AS "patient_id",
             p.FULL_NAME AS "patient_name",
             p.MEDICAL_CODE AS "medical_code",
             r.FROM_HOSPITAL_ID AS "from_hospital_id",
             hFrom.NAME AS "from_hospital",
             NVL(hFrom.LEVEL_NAME, 'Tuyến Tỉnh') AS "from_level",
             r.TO_HOSPITAL_ID AS "to_hospital_id",
             hTo.NAME AS "to_hospital",
             NVL(hTo.LEVEL_NAME, 'Tuyến Trung Ương') AS "to_level",
             NVL(doc.FULL_NAME, 'BS. CKII Lê Văn Thành') AS "doctor_name",
             TO_CHAR(r.REASON) AS "reason",
             CASE 
               WHEN r.URGENCY = 'EMERGENCY' THEN 'Cấp cứu'
               WHEN r.URGENCY = 'URGENT' THEN 'Khẩn cấp'
               ELSE 'Thông thường'
             END AS "urgency",
             CASE 
               WHEN r.STATUS = 'PENDING' THEN 'Chờ duyệt'
               WHEN r.STATUS = 'ACCEPTED' THEN 'Đã tiếp nhận'
               WHEN r.STATUS = 'REJECTED' THEN 'Từ chối'
               WHEN r.STATUS = 'COMPLETED' THEN 'Hoàn tất'
               ELSE 'Đang chuyển bệnh'
             END AS "status",
             'Xe cứu thương chuyên dụng' AS "transport_type",
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

// Tạo phiếu chuyển tuyến mới vào CSDL Oracle 23ai
app.post('/api/referrals', async (req, res) => {
  let patientId = Number(req.body?.patient_id);
  let fromHospitalId = Number(req.body?.from_hospital_id);
  let toHospitalId = Number(req.body?.to_hospital_id);
  const doctorId = req.body?.doctor_id ? Number(req.body.doctor_id) : null;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : 'Chuyển tuyến điều trị chuyên khoa';
  const urgencyByLabel = { 'Cấp cứu': 'EMERGENCY', 'Khẩn cấp': 'URGENT', 'Thông thường': 'NORMAL' };
  let urgency = urgencyByLabel[req.body?.priority] || urgencyByLabel[req.body?.urgency] || req.body?.urgency || 'NORMAL';

  // Hỗ trợ tự động phân giải ID bệnh viện nếu client gửi tên
  try {
    if (!Number.isInteger(fromHospitalId) || fromHospitalId <= 0) {
      const fromName = req.body?.from_facility || '';
      const hospRes = await executeQuery('SELECT HOSPITAL_ID, NAME FROM HOSPITALS');
      const matched = hospRes.rows.find(h => fromName.includes(h.NAME) || h.NAME.includes(fromName));
      fromHospitalId = matched ? matched.HOSPITAL_ID : 101;
    }

    if (!Number.isInteger(toHospitalId) || toHospitalId <= 0) {
      const toName = req.body?.to_facility || '';
      const hospRes = await executeQuery('SELECT HOSPITAL_ID, NAME FROM HOSPITALS');
      const matched = hospRes.rows.find(h => toName.includes(h.NAME) || h.NAME.includes(toName));
      toHospitalId = matched ? matched.HOSPITAL_ID : 1;
    }

    if (!Number.isInteger(patientId) || patientId <= 0) {
      const rawPid = String(req.body?.patient_id || '');
      const numOnly = Number(rawPid.replace(/\D/g, ''));
      patientId = numOnly > 0 ? numOnly : 1;
    }

    if (fromHospitalId === toHospitalId) {
      toHospitalId = fromHospitalId === 1 ? 4 : 1;
    }

    // Thử gọi qua PKG_HOSPITAL_OPS.CREATE_REFERRAL, fallback nếu cần
    let createdId;
    try {
      const pkgResult = await executeQuery(
        `BEGIN
           pkg_hospital_ops.create_referral(
             p_patient_id    => :patient_id,
             p_from_hospital => :from_id,
             p_to_hospital   => :to_id,
             p_reason        => :reason,
             p_urgency       => :urgency,
             p_referral_id   => :out_id
           );
         END;`,
        {
          patient_id: patientId,
          from_id: fromHospitalId,
          to_id: toHospitalId,
          reason,
          urgency,
          out_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        }
      );
      createdId = pkgResult.outBinds.out_id;
    } catch {
      // Fallback chèn trực tiếp vào REFERRALS
      const directResult = await executeQuery(
        `INSERT INTO REFERRALS
           (PATIENT_ID, FROM_HOSPITAL_ID, TO_HOSPITAL_ID, REFERRED_BY_DOCTOR_ID, REASON, URGENCY, STATUS, REFERRAL_TIME)
         VALUES (:patient_id, :from_hospital_id, :to_hospital_id, :doctor_id, :reason, :urgency, 'PENDING', SYSTIMESTAMP)
         RETURNING REFERRAL_ID INTO :out_id`,
        {
          patient_id: patientId,
          from_hospital_id: fromHospitalId,
          to_hospital_id: toHospitalId,
          doctor_id: doctorId,
          reason,
          urgency,
          out_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
        }
      );
      createdId = directResult.outBinds.out_id[0];
    }

    const referralCode = `CT-2024-${String(createdId).padStart(4, '0')}`;

    // Ghi nhật ký kiểm toán AUDIT_LOGS
    await executeQuery(`
      INSERT INTO AUDIT_LOGS (ENTITY_NAME, ACTION, ENTITY_ID, ACTOR_IDENTIFIER, NEW_DATA)
      VALUES ('REFERRALS', 'INSERT', :entity_id, 'BS. TRỰC CHUYỂN TUYẾN', :json_data)
    `, {
      entity_id: createdId,
      json_data: JSON.stringify({
        referral_code: referralCode,
        patient_id: patientId,
        from_hospital_id: fromHospitalId,
        to_hospital_id: toHospitalId,
        urgency,
        reason
      })
    });

    res.status(201).json({
      success: true,
      referral_id: createdId,
      referral_code: referralCode,
      message: 'Đã lưu phiếu chuyển tuyến vào Oracle Database 23ai thành công!'
    });
  } catch (err) {
    console.error('Lỗi tạo referral:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/referrals/:id', async (req, res) => {
  const referralId = Number(req.params.id);
  const statusByLabel = {
    'Chờ duyệt': 'PENDING',
    'Đã tiếp nhận': 'ACCEPTED',
    'Đang chuyển bệnh': 'ACCEPTED',
    'Từ chối': 'REJECTED',
    'Hoàn tất': 'COMPLETED',
    'Đã hủy': 'CANCELLED',
  };
  const status = statusByLabel[req.body?.status] || req.body?.status;
  if (!Number.isInteger(referralId) || referralId <= 0 || !status) {
    return res.status(400).json({ error: 'Mã hoặc trạng thái chuyển tuyến không hợp lệ.' });
  }

  try {
    const result = await executeQuery(
      `UPDATE REFERRALS
          SET STATUS = :status,
              ACCEPTED_AT = CASE WHEN :status = 'ACCEPTED' THEN NVL(ACCEPTED_AT, SYSTIMESTAMP) ELSE ACCEPTED_AT END,
              COMPLETED_AT = CASE WHEN :status = 'COMPLETED' THEN NVL(COMPLETED_AT, SYSTIMESTAMP) ELSE COMPLETED_AT END
        WHERE REFERRAL_ID = :referral_id`,
      { status, referral_id: referralId }
    );
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Không tìm thấy phiếu chuyển tuyến.' });
    }

    // Ghi nhật ký AUDIT_LOGS
    await executeQuery(`
      INSERT INTO AUDIT_LOGS (ENTITY_NAME, ACTION, ENTITY_ID, ACTOR_IDENTIFIER, NEW_DATA)
      VALUES ('REFERRALS', 'UPDATE', :entity_id, 'BS. TRỰC ĐIỀU PHỐI', :json_data)
    `, {
      entity_id: referralId,
      json_data: JSON.stringify({ status })
    });

    res.json({ success: true, referral_id: referralId, status });
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
    // 1. Chuyển tuyến trực tiếp (1 chặng) qua GRAPH_TABLE
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

    // 2. Chuyển tuyến qua trạm trung gian (2 chặng: A -> B -> C) qua GRAPH_TABLE
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
    // Fallback nếu đồ thị đang cập nhật
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

initDbPool().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Medicore Oracle 23ai API Server đang chạy tại http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Không thể khởi động server:', err);
});

