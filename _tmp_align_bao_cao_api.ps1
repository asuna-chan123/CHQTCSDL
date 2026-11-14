$ErrorActionPreference = 'Stop'
$src = "c:\CHQTCSDL\Bao_cao_De_tai_25_He_thong_quan_ly_benh_vien_thong_minh.docx"
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $word.Documents.Open($src)

function Replace-All([string]$find, [string]$replace) {
  $rng = $doc.Content
  $findObj = $rng.Find
  $null = $findObj.ClearFormatting()
  $null = $findObj.Replacement.ClearFormatting()
  return [bool]$findObj.Execute($find, $false, $false, $false, $false, $false, $true, 1, $false, $replace, 2)
}

$pairs = @(
  @('/api/reports/overview', '/api/health (+ Dashboard UI)'),
  @('/api/records/{id}', '/api/records/:id'),
  @('Cập nhật một phần hồ sơ', 'PUT cập nhật hồ sơ / PATCH vitals (JSON_TRANSFORM)'),
  @('Truy vấn graph cho UI', 'GRAPH_TABLE 1–2 chặng + overview/path-finder'),
  @('Dashboard tổng hợp', 'Health check Oracle + Dashboard React'),
  @('Q3 – Hồ sơ theo bệnh nhân', 'Q3 – Hồ sơ theo bệnh nhân (sql/09_optimize_q3)'),
  @('idx_records_patient_created', 'idx_medical_records_pt_date'),
  @('Tùy chọn', 'Có script; tùy chọn minh họa')
)

foreach ($p in $pairs) {
  $ok = Replace-All $p[0] $p[1]
  Write-Host ("{0}: {1}" -f ($(if ($ok) {'OK'} else {'MISS'}), $p[0].Substring(0, [Math]::Min(60, $p[0].Length))))
}

$doc.Save()
$doc.Close($true)
$word.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($doc) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
[GC]::Collect(); [GC]::WaitForPendingFinalizers()
Write-Host 'DONE'
