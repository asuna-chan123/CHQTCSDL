$ErrorActionPreference = 'Stop'
$src = "c:\CHQTCSDL\Bao_cao_De_tai_25_He_thong_quan_ly_benh_vien_thong_minh.docx"
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $word.Documents.Open($src)
$rng = $doc.Content
$f = $rng.Find
$null = $f.ClearFormatting()
$null = $f.Replacement.ClearFormatting()
$ok = $f.Execute(
  'hạng mục Có script; tùy chọn minh họa ở sql/09_optimize_q3_medical_records_index.sql',
  $false, $false, $false, $false, $false, $true, 1, $false,
  'hạng mục tùy chọn ở sql/09_optimize_q3_medical_records_index.sql',
  2
)
Write-Host "fix=$ok"
$doc.Save()
$doc.Close($true)
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
Write-Host 'DONE'
