<#
.SYNOPSIS
  Batch optimizes video files for web streaming in Dooky Detective.
  
.DESCRIPTION
  Scans the videos directory (either local or via UNC network share),
  checks for unoptimized MP4/MOV files (missing faststart moov atom header)
  OR oversized files (>700KB, which stall during simultaneous streaming through
  Cloudflare tunnel), re-encodes them with H.264, web-scale resolution, no audio,
  a hard 700kbps bitrate cap, and faststart, then safely replaces the original.
#>

param(
  [string]$VideosDir = "\\JEFFERSHIZZLE-D\Dotcoms E\images\dookydetective\videos",
  [string]$PostersDir = "\\JEFFERSHIZZLE-D\Dotcoms E\images\dookydetective\posters",
  [long]$MaxSizeBytes = 700KB   # files over this are re-encoded even if already faststart
)

# If running directly on the home server, adapt paths to local E:\ drive
if (!(Test-Path $VideosDir) -and (Test-Path "E:\images\dookydetective\videos")) {
  $VideosDir = "E:\images\dookydetective\videos"
  $PostersDir = "E:\images\dookydetective\posters"
}

Write-Host "=== Dooky Detective Video Web Optimizer ===" -ForegroundColor Cyan
Write-Host "Scanning: $VideosDir`n"

# Locate FFmpeg binary
$ffmpegBin = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source

if (!$ffmpegBin -and $env:LOCALAPPDATA) {
  $localWinget = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
  if (Test-Path $localWinget) {
    $found = Get-ChildItem $localWinget -Recurse -Filter "ffmpeg.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
    if ($found -and (Test-Path $found)) { $ffmpegBin = $found }
  }
}

if (!$ffmpegBin) {
  $userDirs = Get-ChildItem "C:\Users" -Directory -ErrorAction SilentlyContinue
  foreach ($u in $userDirs) {
    $wingetPath = Join-Path $u.FullName "AppData\Local\Microsoft\WinGet\Packages"
    if (Test-Path $wingetPath) {
      $found = Get-ChildItem $wingetPath -Recurse -Filter "ffmpeg.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
      if ($found -and (Test-Path $found)) { $ffmpegBin = $found; break }
    }
  }
}

if (!$ffmpegBin) {
  foreach ($p in @("C:\ffmpeg\bin\ffmpeg.exe", "C:\Program Files\ffmpeg\bin\ffmpeg.exe", "C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe")) {
    if (Test-Path $p) { $ffmpegBin = $p; break }
  }
}

if (!$ffmpegBin) {
  Write-Error "Could not locate ffmpeg.exe. Please ensure FFmpeg is installed."
  exit 1
}

Write-Host "Using FFmpeg: $ffmpegBin`n" -ForegroundColor Gray

# Locate ffprobe binary for checking
$ffprobeBin = Join-Path (Split-Path $ffmpegBin) "ffprobe.exe"

$files = Get-ChildItem $VideosDir -File | Where-Object { $_.Extension -match "^\.(mp4|mov|webm)$" -and $_.Name -notmatch "\.tmp\." }

if ($files.Count -eq 0) {
  Write-Host "No video files found in $VideosDir." -ForegroundColor Yellow
  exit 0
}

$processed = 0
$skipped = 0

foreach ($file in $files) {
  $filePath = $file.FullName
  $tempOut = Join-Path $file.DirectoryName ($file.BaseName + ".tmp.mp4")
  
  # Check if moov is already at the beginning
  $hasFaststart = $false
  if ($ffprobeBin -and (Test-Path $ffprobeBin)) {
    $trace = & $ffprobeBin -v trace $filePath 2>&1 | Select-String "type:'moov'|type:'mdat'" | Select-Object -First 1
    if ($trace -and $trace -match "type:'moov'") {
      $hasFaststart = $true
    }
  }

  $isOversized = $file.Length -gt $MaxSizeBytes

  if ($hasFaststart -and !$isOversized) {
    Write-Host "[SKIP] $($file.Name) — faststart OK, $([math]::Round($file.Length / 1KB, 0)) KB (within limit)" -ForegroundColor DarkGray
    $skipped++
    continue
  }

  $reason = if (!$hasFaststart) { "no faststart" } else { "$([math]::Round($file.Length / 1MB, 2)) MB — over ${MaxSizeBytes}B limit" }
  Write-Host "[OPTIMIZING] $($file.Name) ($reason)..." -ForegroundColor Yellow -NoNewline

  # ffmpeg settings:
  # -crf 28         : quality-based target (good balance for mosaic tiles)
  # -maxrate 700k   : hard bitrate cap so file never exceeds ~875 KB for 10s clip
  # -bufsize 1400k  : VBV buffer (2x maxrate)
  # -vf scale       : max 854px wide (480p), maintaining aspect ratio
  # -an             : strip audio (tiles are muted)
  # +faststart      : move moov atom to byte 0 for instant streaming
  $proc = Start-Process -FilePath $ffmpegBin -ArgumentList @(
    "-y",
    "-i", "`"$filePath`"",
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "28",
    "-maxrate", "700k",
    "-bufsize", "1400k",
    "-an",
    "-vf", "scale='min(854,iw)':-2",
    "-g", "60",
    "-keyint_min", "60",
    "-movflags", "+faststart",
    "`"$tempOut`""
  ) -NoNewWindow -PassThru -Wait

  if ($proc.ExitCode -eq 0 -and (Test-Path $tempOut)) {
    $newSize = (Get-Item $tempOut).Length
    $saving = [math]::Round((1 - ($newSize / $file.Length)) * 100, 1)
    
    # Replace original file with optimized version
    Remove-Item $filePath -Force
    Move-Item $tempOut $filePath -Force
    
    Write-Host " DONE! New size: $([math]::Round($newSize / 1KB, 0)) KB ($saving% smaller)" -ForegroundColor Green
    $processed++
  } else {
    Write-Host " FAILED" -ForegroundColor Red
    if (Test-Path $tempOut) { Remove-Item $tempOut -Force }
  }
}

Write-Host "`nOptimization complete! Processed: $processed | Already optimized (within limits): $skipped" -ForegroundColor Cyan

# Optionally clear poster cache if videos were modified so fresh stills generate
if ($processed -gt 0 -and (Test-Path $PostersDir)) {
  Write-Host "Clearing cached poster stills in $PostersDir so fresh thumbnails are generated..." -ForegroundColor Gray
  Remove-Item (Join-Path $PostersDir "*") -Force -Recurse -ErrorAction SilentlyContinue
}
