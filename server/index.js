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

// 7. Beds
app.get('/api/beds', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT 
        b.BED_ID AS "id",
        b.CODE AS "code",
        b.STATUS AS "status",
        r.ROOM_NUMBER AS "room_number",
        r.ROOM_TYPE AS "room_type",
        r.FLOOR_NO AS "floor_no",
        d.NAME AS "department_name"
      FROM BEDS b
      JOIN ROOMS r ON b.ROOM_ID = r.ROOM_ID
      JOIN DEPARTMENTS d ON r.DEPARTMENT_ID = d.DEPARTMENT_ID
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

