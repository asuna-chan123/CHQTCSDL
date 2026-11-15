# Medicore Web Health – Đề tài 25

Hệ thống quản lý bệnh viện thông minh trên **Oracle Database 23ai**: quan hệ + JSON bệnh án + SQL Property Graph chuyển tuyến + AI Vector Search + PL/SQL Package/Trigger + kiểm soát giao dịch.

## Kiến trúc

`React (Vite + TypeScript)` → `Express.js (node-oracledb)` → `Oracle Database 23ai (FREEPDB1 / DB_USER)`

## Yêu cầu

- Docker Desktop (Oracle 23ai Free)
- Node.js 20+
- sqlplus trong container (đã có sẵn image Oracle)

## 1. Khởi động Oracle 23ai

```bash
docker compose up -d
```

Tạo file `.env` ở thư mục gốc với `ORACLE_PWD` đặt thành mật khẩu mạnh riêng của bạn trước khi khởi động. Đợi healthcheck sẵn sàng, tạo user schema (một lần):

```bash
docker exec -it oracle23ai bash -c 'export NLS_LANG=AMERICAN_AMERICA.AL32UTF8; sqlplus -s "system/$ORACLE_PWD@FREEPDB1" <<SQL
ALTER SESSION SET CONTAINER = FREEPDB1;
CREATE USER hospital_admin IDENTIFIED BY "$ORACLE_PWD" QUOTA UNLIMITED ON USERS;
GRANT CONNECT, RESOURCE, CREATE VIEW, CREATE PROCEDURE, CREATE TRIGGER TO hospital_admin;
GRANT CREATE PROPERTY GRAPH TO hospital_admin;
EXIT;
SQL'
```

## 2. Chạy toàn bộ script SQL

```bash
docker exec -w /tmp/sql oracle23ai bash -c 'export NLS_LANG=AMERICAN_AMERICA.AL32UTF8; sqlplus -s "hospital_admin/$ORACLE_PWD@FREEPDB1" @run_all.sql'
```

Thứ tự trong `sql/run_all.sql`:

1. `01_schema.sql`
2. `07_vector_search_metadata.sql`
3. `02_seed.sql`
4. `03_package.sql`
5. `04_triggers.sql`
6. `05_tests_concurrency.sql`
7. `06_optimize_q1_execution_plan.sql` — Q1 B-tree
8. `08_optimize_q2_vector_index.sql` — Q2 IVF vector index
9. `09_optimize_q3_medical_records_index.sql` — Q3 tùy chọn
10. `10_property_graph.sql` — `hospital_referral_graph` + `GRAPH_TABLE`
11. `11_test_sql_json.sql` — `JSON_VALUE` / `JSON_TABLE` / `JSON_TRANSFORM`

## 3. Backend API

```bash
cd server
cp .env.example .env
npm install
npm start
```

API mặc định: `http://localhost:5000`

Endpoint nghiệp vụ chính:

| Method | Endpoint | Mục đích |
|--------|----------|----------|
| GET | `/api/health` | Version Oracle |
| GET/POST | `/api/patients` | Bệnh nhân |
| GET/POST | `/api/appointments` | Đặt lịch qua package |
| POST | `/api/admissions` | Phân giường `FOR UPDATE SKIP LOCKED` |
| GET/POST/PUT | `/api/records` | Hồ sơ JSON |
| PATCH | `/api/records/:id/vitals` | `JSON_TRANSFORM` |
| GET | `/api/records/analytics/symptoms-table` | `JSON_TABLE` + `JSON_VALUE` |
| GET/POST | `/api/referrals` | Chuyển tuyến |
| GET | `/api/graph/overview` | Tổng quan graph |
| GET | `/api/graph/routes` | `GRAPH_TABLE` 1–2 chặng |
| POST | `/api/graph/path-finder` | Tìm đường chuyển tuyến |
| POST | `/api/ai-search` | Vector search (`type=symptoms\|docs`) |
| GET | `/api/audit-logs` | Audit trigger |

## 4. Frontend

```bash
npm install
npm run dev
```

Mở UI Vite (thường `http://localhost:5173`). Proxy `/api` xem `vite.config.ts`.

## 5. Demo nhanh theo đề tài

1. Đặt lịch / cố tình trùng slot → HTTP 409 từ package  
2. Cập nhật bệnh án JSON → xem audit + `JSON_TABLE`  
3. Tạo referral + màn Referral Network (`GRAPH_TABLE`)  
4. AI Search tiếng Việt (embedding 384 chiều cục bộ)  
5. Phân giường đồng thời (`sql/05_tests_concurrency.sql`)  
6. Execution plan Q1 (B-tree) và Q2 (IVF vector)

## Ghi chú dữ liệu

- Seed nghiệp vụ: `sql/02_seed.sql` (bệnh viện, bác sĩ, bệnh nhân, bệnh án JSON, 1 referral).  
- Seed graph 2 chặng: `sql/10_property_graph.sql`.  
- Seed ~10.000 lịch khám: trong `06_optimize_q1_execution_plan.sql`.  
- Seed ≥2000 document vector benchmark: trong `08_optimize_q2_vector_index.sql`.  
- Corpus semantic UI: `server/medical-search-data.json` (upsert khi gọi `/api/ai-search`).
