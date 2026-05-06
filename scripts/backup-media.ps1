param(
  [string]$OutputDir = ".\\backups\\media"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".env")) {
  throw ".env not found"
}

Get-Content ".env" | ForEach-Object {
  if ($_ -and -not $_.StartsWith("#")) {
    $parts = $_ -split "=", 2
    if ($parts.Length -eq 2) {
      [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim().Trim('"'))
    }
  }
}

$provider = if ($env:STORAGE_PROVIDER) { $env:STORAGE_PROVIDER.ToLowerInvariant() } else { "local" }
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if ($provider -eq "local") {
  $uploadsDir = if ($env:LOCAL_UPLOADS_DIR) { $env:LOCAL_UPLOADS_DIR } else { "uploads" }
  $targetDir = Join-Path $OutputDir $timestamp
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
  Copy-Item -Recurse -Force $uploadsDir $targetDir
  Write-Host "Local media backup completed: $targetDir"
  exit 0
}

$targetDir = Join-Path $OutputDir $timestamp

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
node .\scripts\backup-media.mjs $targetDir

if ($LASTEXITCODE -ne 0) {
  throw "S3 media backup failed"
}
