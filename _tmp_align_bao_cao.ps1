$ErrorActionPreference = 'Stop'

$src = "c:\CHQTCSDL\Bao_cao_De_tai_25_He_thong_quan_ly_benh_vien_thong_minh.docx"
$backup = "c:\CHQTCSDL\Bao_cao_De_tai_25_He_thong_quan_ly_benh_vien_thong_minh.BACKUP_align_{0}.docx" -f (Get-Date -Format 'yyyyMMdd_HHmmss')
Copy-Item $src $backup -Force
Write-Host "Backup: $backup"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $word.Documents.Open($src)

function Replace-All([string]$find, [string]$replace) {
  if ([string]::IsNullOrWhiteSpace($find)) { return $false }
  if ($find.Length -gt 255) { throw "Find too long ($($find.Length))" }
  $rng = $doc.Content
  $findObj = $rng.Find
  $null = $findObj.ClearFormatting()
  $null = $findObj.Replacement.ClearFormatting()
  return [bool]$findObj.Execute($find, $false, $false, $false, $false, $false, $true, 1, $false, $replace, 2)
}

function Replace-ParagraphStartingWith([string]$startSnippet, [string]$newParagraphText) {
  $rng = $doc.Content
  $findObj = $rng.Find
  $null = $findObj.ClearFormatting()
  $found = $findObj.Execute($startSnippet, $false, $false, $false, $false, $false, $true, 1, $false)
  if (-not $found) { return $false }
  $para = $rng.Paragraphs.Item(1).Range
  $end = $para.End - 1
  if ($end -lt $para.Start) { return $false }
  $para.SetRange($para.Start, $end)
  $para.Text = $newParagraphText
  return $true
}

$report = New-Object System.Collections.Generic.List[string]
function Apply-Rep([string]$find, [string]$replace) {
  $ok = Replace-All $find $replace
  $preview = $find.Substring(0, [Math]::Min(80, $find.Length))
  if ($ok) { $report.Add("OK: $preview") } else { $report.Add("MISS: $preview") }
}
function Apply-Para([string]$start, [string]$newText) {
  $ok = Replace-ParagraphStartingWith $start $newText
  $preview = $start.Substring(0, [Math]::Min(80, $start.Length))
  if ($ok) { $report.Add("OKPARA: $preview") } else { $report.Add("MISSPARA: $preview") }
}

# --- Trạng thái Bảng 5.1 ---
Apply-Rep "Đã có REFERRALS + UI; đang hoàn thiện CREATE PROPERTY GRAPH, GRAPH_TABLE và nối UI Oracle." "Đã triển khai sql/10_property_graph.sql (CREATE PROPERTY GRAPH + GRAPH_TABLE) và API/UI Referral Network."
Apply-Rep "Đã triển khai MEDICAL_DOCUMENTS + semantic search; cần vector index Q2 + ảnh minh chứng." "Đã triển khai semantic search + sql/08_optimize_q2_vector_index.sql (exact/IVF); còn chèn ảnh plan."
Apply-Rep "Đã có SKIP LOCKED, unique constraint, script Q1 plan; cần Q2 vector index + ảnh plan." "Đã có SKIP LOCKED, Q1 B-tree, Q2 IVF vector index; còn chèn ảnh/plan đo thật vào báo cáo."
Apply-Rep "Đã có React + Express.js + Oracle 23ai; còn hoàn thiện Graph Oracle và minh chứng ảnh/plan." "Đã khớp React + Express.js + Oracle 23ai (JSON/Graph/Vector/Package); còn chèn ảnh minh chứng."
Apply-Rep "Đã triển khai record_json qua API; cần minh chứng JSON_VALUE/JSON_TABLE/JSON_TRANSFORM + ảnh." "Đã có API/UI JSON_VALUE/JSON_TABLE/JSON_TRANSFORM (sql/11_test_sql_json.sql); còn chèn ảnh."

# --- API paths ---
Apply-Rep "GET`r`n/api/graph/referrals" "GET`r`n/api/graph/routes"
Apply-Rep "/api/graph/referrals" "/api/graph/routes"
Apply-Rep "GET`r`n/api/reports/overview" "GET`r`n/api/health (+ Dashboard UI)"
Apply-Rep "PATCH`r`n/api/records/{id}" "PUT/PATCH`r`n/api/records/:id"
Apply-Rep "POST`r`n/api/patients/{id}/records" "POST`r`n/api/records"
Apply-Rep "GET`r`n/api/patients/{id}/records" "GET`r`n/api/records"

# --- Graph label khớp code ---
Apply-Rep "LABEL referral PROPERTIES" "LABEL referred_to PROPERTIES"
Apply-Rep "-[r IS referral]->" "-[r IS referred_to]->"
Apply-Rep "-[r1 IS referral]->" "-[r1 IS referred_to]->"
Apply-Rep "-[r2 IS referral]->" "-[r2 IS referred_to]->"

# --- Checklist / pipeline ---
Apply-Rep "01_schema.sql → 07_vector_search_metadata.sql → 02_seed.sql → 03_package.sql → 04_triggers.sql → 05_tests_concurrency.sql → 06_optimize_q1_execution_plan.sql (+ script graph khi hoàn thiện)." "01_schema.sql → 07_vector_search_metadata.sql → 02_seed.sql → 03_package.sql → 04_triggers.sql → 05_tests_concurrency.sql → 06_optimize_q1 → 08_optimize_q2_vector → 09_optimize_q3 → 10_property_graph → 11_test_sql_json (xem sql/run_all.sql)."
Apply-Rep "Docker Compose và README chạy từ máy mới; không phụ thuộc cấu hình riêng trong DBeaver." "Đã có docker-compose.yml + README.md + server/.env.example; chạy lại từ máy mới theo README."
Apply-Rep "Backend có .env.example, không commit mật khẩu." "Đã có server/.env.example và .env.example; không commit file .env thật."

# --- Dữ liệu kiểm thử (mức thực tế đã triển khai) ---
Apply-Rep "5–8 bệnh viện, 15–25 khoa và 40–60 bác sĩ." "Seed demo: 4–7 bệnh viện, vài khoa/bác sĩ; mở rộng graph trong sql/10_property_graph.sql."
Apply-Rep "1.000 bệnh nhân giả lập, 10.000–30.000 lịch khám để execution plan có ý nghĩa." "Seed nghiệp vụ nhỏ + bulk ~10.000 lịch khám trong sql/06_optimize_q1_execution_plan.sql để đo Q1."
Apply-Rep "200–500 giường và 2.000 admission để test phân giường." "Seed vài giường AVAILABLE; concurrency C1–C3 trong sql/05_tests_concurrency.sql."
Apply-Rep "2.000–5.000 referral để graph có đủ quan hệ hai chặng và thống kê hub." "Seed referral + chuỗi 2 chặng trong sql/10_property_graph.sql (đủ demo GRAPH_TABLE)."
Apply-Rep "100–300 mục symptom knowledge và 5.000–20.000 document chunks có embedding để so sánh exact/vector index." "Corpus UI: medical-search-data.json; benchmark ≥2000 VECTOR docs trong sql/08_optimize_q2_vector_index.sql cho IVF/Q2."

# --- Bảng 4.3 ---
Apply-Rep "Chưa đo" "Có script đo trong sql/; chèn ảnh plan khi nộp"
# only first two occurrences ideally - Word replaces all which may affect Q3 "Tùy chọn" row - OK if Q3 also says script exists

# --- Hạn chế / kế hoạch ---
Apply-Rep "SQL Property Graph (CREATE PROPERTY GRAPH + GRAPH_TABLE) đang hoàn thiện trong source; chưa dùng Graph Server/PGX." "Đã có CREATE PROPERTY GRAPH + GRAPH_TABLE trong sql/10 và API/UI; chưa dùng Graph Server/PGX."
Apply-Rep "Q1 đã có script đo plan; Q2 vector index và ảnh demo graph/JSON còn cần bổ sung bằng kết quả thực nghiệm." "Q1/Q2/Q3 đã có script trong sql/; cần chèn ảnh plan và ảnh UI/graph/JSON vào bản nộp cuối."
Apply-Rep "đã có embedding + POST /api/ai-search; bổ sung vector index Q2 khi dữ liệu đủ lớn." "đã có embedding + POST /api/ai-search + sql/08_optimize_q2_vector_index.sql (IVF)."
Apply-Rep "hoàn thiện UI React (Referral Network nối GRAPH_TABLE); chỉ gọi API, không bypass business rule." "UI React đã nối GRAPH_TABLE/vector/JSON; chỉ gọi API, không bypass business rule."

# --- Đoạn mở đầu / chương 3 ---
Apply-Para "Báo cáo được cập nhật theo source hiện tại của đề tài 25." @"
Báo cáo được cập nhật khớp source hiện tại của đề tài 25. Kiến trúc React – Express.js – Oracle 23ai, schema/package/trigger, JSON/Graph/Vector, Q1 B-tree và Q2 IVF đã có trong repository (sql/run_all.sql, server/, src/). Các ô nền vàng còn lại chủ yếu dành cho ảnh chụp UI, execution plan chạy thật và kết quả test khi nộp bài.
"@.Trim()

Apply-Para "Chương này trình bày phương án cài đặt đã bám theo source hiện tại" @"
Chương này trình bày phương án cài đặt khớp source hiện tại (sql/, server/ Express.js, frontend React). DDL Property Graph nằm ở sql/10_property_graph.sql; Q2 vector index nằm ở sql/08_optimize_q2_vector_index.sql; Q3 index hồ sơ bệnh án là hạng mục tùy chọn ở sql/09_optimize_q3_medical_records_index.sql. Các ghi chú nền vàng còn lại cần thay bằng ảnh chụp minh chứng chạy thật trước khi nộp.
"@.Trim()

Apply-Para "Source code lõi (schema, package/trigger, API, UI, vector search) đã triển khai." @"
Source code lõi (schema, package/trigger, API, UI, vector search, property graph, Q1/Q2) đã triển khai và được đồng bộ với báo cáo này. Việc còn lại chủ yếu là chèn minh chứng ảnh/plan vào Chương 4 và luyện demo vấn đáp.
"@.Trim()

$doc.Save()
$doc.Close($true)
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
[GC]::Collect(); [GC]::WaitForPendingFinalizers()

$reportPath = "c:\CHQTCSDL\_tmp_align_report.txt"
$report | Out-File $reportPath -Encoding UTF8
Write-Host "==== ALIGN REPORT ===="
Get-Content $reportPath
$ok = ($report | Where-Object { $_ -like 'OK*' }).Count
$miss = ($report | Where-Object { $_ -like 'MISS*' }).Count
Write-Host "Summary OK=$ok MISS=$miss"
Write-Host "DONE"
