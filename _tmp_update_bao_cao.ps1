$ErrorActionPreference = 'Stop'

$src = "c:\CHQTCSDL\Bao_cao_De_tai_25_He_thong_quan_ly_benh_vien_thong_minh.docx"
$backups = Get-ChildItem "c:\CHQTCSDL\Bao_cao_De_tai_25_He_thong_quan_ly_benh_vien_thong_minh.BACKUP_*.docx" | Sort-Object LastWriteTime -Descending
if ($backups.Count -eq 0) { throw "No backup found" }
# Restore from newest backup to start clean
Copy-Item $backups[0].FullName $src -Force
Write-Host "Restored from $($backups[0].Name)"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $word.Documents.Open($src)

function Replace-All([string]$find, [string]$replace) {
  if ([string]::IsNullOrWhiteSpace($find)) { return $false }
  if ($find.Length -gt 255) { throw "Find too long ($($find.Length)): $($find.Substring(0,40))..." }
  $rng = $doc.Content
  $findObj = $rng.Find
  $null = $findObj.ClearFormatting()
  $null = $findObj.Replacement.ClearFormatting()
  return [bool]$findObj.Execute($find, $false, $false, $false, $false, $false, $true, 1, $false, $replace, 2)
}

function Replace-ParagraphStartingWith([string]$startSnippet, [string]$newParagraphText) {
  if ($startSnippet.Length -gt 255) { throw "snippet too long" }
  $rng = $doc.Content
  $findObj = $rng.Find
  $null = $findObj.ClearFormatting()
  $found = $findObj.Execute($startSnippet, $false, $false, $false, $false, $false, $true, 1, $false)
  if (-not $found) { return $false }
  # Expand to whole paragraph
  $para = $rng.Paragraphs.Item(1).Range
  # Keep paragraph mark
  $end = $para.End - 1
  if ($end -lt $para.Start) { return $false }
  $para.SetRange($para.Start, $end)
  $para.Text = $newParagraphText
  return $true
}

$report = New-Object System.Collections.Generic.List[string]
function Apply-Rep([string]$find, [string]$replace) {
  $ok = Replace-All $find $replace
  $preview = $find.Substring(0, [Math]::Min(72, $find.Length))
  if ($ok) { $report.Add("OK: $preview") } else { $report.Add("MISS: $preview") }
}
function Apply-Para([string]$start, [string]$newText) {
  $ok = Replace-ParagraphStartingWith $start $newText
  $preview = $start.Substring(0, [Math]::Min(72, $start.Length))
  if ($ok) { $report.Add("OKPARA: $preview") } else { $report.Add("MISSPARA: $preview") }
}

# --- Short find/replace ---
Apply-Rep "React UI – FastAPI – Oracle Database 23ai" "React UI – Express.js (Node.js) – Oracle Database 23ai"
Apply-Rep "React → FastAPI → Oracle 23ai" "React → Express.js (Node.js) → Oracle 23ai"
Apply-Rep "FastAPI + Python" "Express.js + Node.js"
Apply-Rep "Python 3.12 + FastAPI" "Node.js + Express.js"
Apply-Rep "python-oracledb" "node-oracledb"
Apply-Rep "REST API; Pydantic validate input." "REST API; validate input tại Express middleware."
Apply-Rep "Thin mode ban đầu; connection pool." "Thin Mode; connection pool."
Apply-Rep "schema HOSPITAL_APP." "schema hospital_admin."
Apply-Rep "dựng FastAPI + connection pool" "dựng Express.js + connection pool (node-oracledb)"
Apply-Rep "FastAPI validate dữ liệu cơ bản và gọi" "Express.js validate dữ liệu cơ bản và gọi"
Apply-Rep "Mã 3.14. FastAPI gọi PL/SQL và quản lý commit/rollback" "Mã 3.14. Express.js gọi PL/SQL và quản lý commit/rollback"
Apply-Rep "Bản cơ sở tạo tại FastAPI bằng mô hình đa ngôn ngữ 384 chiều" "Bản cơ sở tạo tại Express.js bằng mô hình đa ngôn ngữ 384 chiều (Transformers.js)"

# Architecture sentence (may be long - use shorter unique start via Do if under 255)
Apply-Rep "FastAPI thực hiện xác thực dữ liệu đầu vào, quản lý endpoint, sinh embedding và gọi procedure/query trong Oracle." "Express.js thực hiện xác thực dữ liệu đầu vào, quản lý endpoint, sinh embedding cục bộ và gọi procedure/query trong Oracle."

# Status 5.1
Apply-Rep "Đã thiết kế; cần chạy và chụp minh chứng." "Đã triển khai record_json qua API; cần minh chứng JSON_VALUE/JSON_TABLE/JSON_TRANSFORM + ảnh."
Apply-Rep "Đã thiết kế; cần seed dữ liệu graph." "Đã có REFERRALS + UI; đang hoàn thiện CREATE PROPERTY GRAPH, GRAPH_TABLE và nối UI Oracle."
Apply-Rep "Đã thiết kế; cần sinh embedding." "Đã triển khai VECTOR(384) + embedding cục bộ + VECTOR_DISTANCE (COSINE) Top-K trên UI."
Apply-Rep "Đã thiết kế; cần dữ liệu documents." "Đã triển khai MEDICAL_DOCUMENTS + semantic search; cần vector index Q2 + ảnh minh chứng."
Apply-Rep "Đã thiết kế blueprint." "Đã triển khai PKG_HOSPITAL_OPS + >=2 trigger + script kiểm thử concurrency."
Apply-Rep "Đã thiết kế test và phép đo." "Đã có SKIP LOCKED, unique constraint, script Q1 plan; cần Q2 vector index + ảnh plan."
Apply-Rep "Chưa code; là bước tiếp theo bắt buộc." "Đã có React + Express.js + Oracle 23ai; còn hoàn thiện Graph Oracle và minh chứng ảnh/plan."

# API paths
Apply-Rep "/api/patients/{id}/records" "/api/records"
Apply-Rep "/api/search/symptoms" "/api/ai-search (type=symptoms)"
Apply-Rep "/api/search/documents" "/api/ai-search (type=docs)"

# Checklist script chain
Apply-Rep "05_graph.sql → 06_indexes.sql → 07_tests.sql." "05_tests_concurrency.sql → 06_optimize_q1_execution_plan.sql (+ script graph khi hoàn thiện)."
Apply-Rep "01_schema.sql → 02_seed.sql → 03_package.sql → 04_triggers.sql →" "01_schema.sql → 07_vector_search_metadata.sql → 02_seed.sql → 03_package.sql → 04_triggers.sql →"

# Tech
Apply-Rep "Sentence Transformers" "Transformers.js / Xenova MiniLM"
Apply-Rep "Sinh embedding đa ngôn ngữ 384 chiều cho văn bản tiếng Việt; vector được lưu và tìm kiếm trong Oracle." "Sinh embedding 384 chiều (MiniLM) tại backend Node; vector lưu và tìm trong Oracle."

# Plan steps
Apply-Rep "chạy schema.sql; xác minh JSON/VECTOR/PROPERTY GRAPH syntax trên đúng release." "chạy sql/run_all.sql; xác minh JSON/VECTOR/PROPERTY GRAPH trên đúng release."
Apply-Rep "sinh embedding cho symptom/document và hoàn thiện hai endpoint vector search." "đã có embedding + POST /api/ai-search; bổ sung vector index Q2 khi dữ liệu đủ lớn."
Apply-Rep "hoàn thiện UI React theo luồng demo; chỉ gọi API, không bypass business rule." "hoàn thiện UI React (Referral Network nối GRAPH_TABLE); chỉ gọi API, không bypass rule."

# Refs
Apply-Rep "python-oracledb Project" "Oracle node-oracledb documentation"
Apply-Rep "https://python-oracledb.readthedocs.io/en/latest/user_guide/connection_handling.html" "https://node-oracledb.readthedocs.io/en/latest/user_guide/connection_handling.html"

# Graph limitation short replace
Apply-Rep "Graph demo tập trung pattern matching trong SQL Property Graph, chưa triển khai đầy đủ thuật toán graph lớn trên Graph Server." "SQL Property Graph (CREATE PROPERTY GRAPH + GRAPH_TABLE) đang hoàn thiện trong source; chưa dùng Graph Server/PGX."

# Performance limitation
Apply-Rep "Các số liệu hiệu năng chưa thể kết luận trước khi code và sinh đủ dữ liệu; bản cuối phải thay thế toàn bộ TODO bằng kết quả thực nghiệm." "Q1 đã có script đo plan; Q2 vector index và ảnh demo graph/JSON còn cần bổ sung bằng kết quả thực nghiệm."

# Chapter 4 short lead-in
Apply-Rep "Do báo cáo được viết trước source code, cột" "Với source đã có, cột"

# Code sample pieces
Apply-Rep '@router.post("/admissions")' 'app.post("/api/admissions", async (req, res) => {'
Apply-Rep 'def admit_patient(payload: AdmissionCreate):' '  const { patient_id, department_id } = req.body;'
Apply-Rep 'with pool.acquire() as conn:' '  let conn = await pool.getConnection();'
Apply-Rep 'with conn.cursor() as cur:' '  try {'
Apply-Rep 'out_id = cur.var(oracledb.NUMBER)' 'const binds = { p_patient_id: patient_id, p_department_id: department_id, p_admission_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } };'
Apply-Rep 'cur.callproc(' 'await conn.execute('
Apply-Rep '"PKG_HOSPITAL_OPS.ADMIT_PATIENT",' '`BEGIN pkg_hospital_ops.admit_patient(:p_patient_id, :p_department_id, :p_admission_id); END;`,'
Apply-Rep '[payload.patient_id, payload.department_id, out_id],' 'binds'
Apply-Rep 'conn.commit()' 'await conn.commit()'
Apply-Rep 'return {"admission_id": int(out_id.getvalue())}' 'res.status(201).json({ admission_id: binds.p_admission_id })'
Apply-Rep 'except oracledb.DatabaseError as exc:' '} catch (err) {'
Apply-Rep 'conn.rollback()' 'await conn.rollback()'
Apply-Rep 'raise map_database_error(exc)' 'res.status(409).json({ error: err.message })'

# --- Long paragraphs via paragraph replace ---
Apply-Para "Báo cáo này được xây dựng trước khi viết mã nguồn theo yêu cầu của sinh viên." @"
Báo cáo được cập nhật theo source hiện tại của đề tài 25. Các phần phân tích/thiết kế vẫn giữ làm khung giải thích; mã SQL/PL/SQL, API Express.js và UI React đã có trong repository và được đối chiếu với yêu cầu đề tài. Source code lõi (schema, package/trigger, API, UI, vector search) đã triển khai. Các vị trí còn nền vàng chủ yếu dành cho ảnh chụp UI, execution plan Q2/vector index và minh chứng SQL Property Graph sau khi hoàn thiện phần graph trên Oracle.
"@.Trim()

Apply-Para "Chương này trình bày blueprint cài đặt được dùng trực tiếp khi bắt đầu viết code." @"
Chương này trình bày phương án cài đặt đã bám theo source hiện tại (thư mục sql/, server/ Express.js, frontend React). Một số đoạn lệnh minh họa vẫn giữ dạng trích dẫn tiêu biểu; phần SQL Property Graph và vector index Q2 đang được hoàn thiện trong code. Các ghi chú nền vàng còn lại cần thay bằng ảnh chụp/minh chứng chạy thật trước khi nộp.
"@.Trim()

Apply-Para "Yêu cầu môn học đòi hỏi ít nhất năm kịch bản kiểm thử" @"
Yêu cầu môn học đòi hỏi ít nhất năm kịch bản kiểm thử cho phần lõi và tối thiểu hai truy vấn được phân tích execution plan trước/sau tối ưu [1]. Đề tài này chuẩn bị nhiều hơn mức tối thiểu để mỗi công nghệ trọng tâm đều có minh chứng riêng. Kiểm thử được chia thành bốn lớp: kiểm thử dữ liệu/ràng buộc, kiểm thử PL/SQL và API, kiểm thử công nghệ JSON/Graph/Vector, và kiểm thử transaction/hiệu năng.
"@.Trim()

# Also update the following paragraph about TODO if present
Apply-Para "Do báo cáo được viết trước source code" @"
Với source đã có, cột Kết quả thực tế vẫn cần chèn ảnh/plan chạy thật cho các ô TODO nền vàng. Phần lớn kịch bản lõi (đặt lịch, phân giường, bệnh án JSON, vector search, concurrency C1–C3, Q1) đã có script/API tương ứng. Không sử dụng số liệu giả vì phần vấn đáp có thể yêu cầu chạy lại ngay tại chỗ.
"@.Trim()

# If previous Do already changed "Do báo cáo..." to "Với source...", try that start
Apply-Para "Với source đã có, cột" @"
Với source đã có, cột Kết quả thực tế vẫn cần chèn ảnh/plan chạy thật cho các ô TODO nền vàng. Phần lớn kịch bản lõi (đặt lịch, phân giường, bệnh án JSON, vector search, concurrency C1–C3, Q1) đã có script/API tương ứng. Không sử dụng số liệu giả vì phần vấn đáp có thể yêu cầu chạy lại ngay tại chỗ.
"@.Trim()

$doc.Save()
$doc.Close($true)
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
[GC]::Collect(); [GC]::WaitForPendingFinalizers()

$reportPath = "c:\CHQTCSDL\_tmp_word_replace_report.txt"
$report | Out-File $reportPath -Encoding UTF8
Write-Host "==== REPORT ===="
Get-Content $reportPath
$ok = ($report | Where-Object { $_ -like 'OK*' }).Count
$miss = ($report | Where-Object { $_ -like 'MISS*' }).Count
Write-Host "Summary OK=$ok MISS=$miss"
Write-Host "DONE"

