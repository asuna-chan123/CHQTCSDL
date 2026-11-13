$ErrorActionPreference = 'Stop'
$src = "c:\CHQTCSDL\Bao_cao_De_tai_25_He_thong_quan_ly_benh_vien_thong_minh.docx"

Get-Process WINWORD -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

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

function Replace-ParagraphStartingWith([string]$startSnippet, [string]$newParagraphText) {
  $rng = $doc.Content
  $findObj = $rng.Find
  $null = $findObj.ClearFormatting()
  $found = $findObj.Execute($startSnippet, $false, $false, $false, $false, $false, $true, 1, $false)
  if (-not $found) { return $false }
  $para = $rng.Paragraphs.Item(1).Range
  $para.SetRange($para.Start, $para.End - 1)
  $para.Text = $newParagraphText
  return $true
}

$cleanCode = @'
app.post("/api/admissions", async (req, res) => {
  const { patient_id, department_id } = req.body;
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.execute(
      `BEGIN pkg_hospital_ops.admit_patient(:p_patient_id, :p_department_id, :p_admission_id); END;`,
      {
        p_patient_id: patient_id,
        p_department_id: department_id,
        p_admission_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );
    await conn.commit();
    res.status(201).json({ admission_id: result.outBinds.p_admission_id });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(409).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});
'@

$ok1 = Replace-ParagraphStartingWith 'app.post' $cleanCode
Write-Host "code para: $ok1"

$pairs = @(
  @('Endpoint không tự tìm giường bằng SELECT rồi UPDATE ở Python', 'Endpoint không tự tìm giường bằng SELECT rồi UPDATE ở Node.js'),
  @('6. Bước 6: dựng React UI tối thiểu nhưng hoàn chỉnh cho luồng demo.', '6. Bước 6: hoàn thiện UI React (Referral Network nối GRAPH_TABLE); chỉ gọi API, không bypass business rule.'),
  @('node-oracledb Project', 'Oracle node-oracledb'),
  @('“Connecting to Oracle Database – Connection Pooling.”', '“Connection Pooling.”'),
  @('[9] Transformers.js / Xenova MiniLM,', '[9] Hugging Face / Xenova,')
)

foreach ($p in $pairs) {
  $ok = Replace-All $p[0] $p[1]
  Write-Host ("{0}: {1}" -f ($(if($ok){'OK'}else{'MISS'}), $p[0].Substring(0,[Math]::Min(80,$p[0].Length))))
}

$doc.Save()
$doc.Close($true)
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
[GC]::Collect(); [GC]::WaitForPendingFinalizers()
Write-Host DONE
