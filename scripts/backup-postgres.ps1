param(
  [string]$OutputDir = ".\\backups\\postgres"
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

if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL is not configured"
}

$databaseUrl = $env:DATABASE_URL -replace "\?.*$", ""

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $OutputDir "game_game-$timestamp.dump"

Write-Host "Creating PostgreSQL backup at $backupPath"
& pg_dump $databaseUrl -Fc -f $backupPath

if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed"
}

Write-Host "Backup completed: $backupPath"
