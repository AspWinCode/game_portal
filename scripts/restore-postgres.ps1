param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".env")) {
  throw ".env not found"
}

if (-not (Test-Path $BackupFile)) {
  throw "Backup file not found: $BackupFile"
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

Write-Host "Restoring PostgreSQL backup from $BackupFile"
& pg_restore --clean --if-exists --no-owner --dbname=$databaseUrl $BackupFile

if ($LASTEXITCODE -ne 0) {
  throw "pg_restore failed"
}

Write-Host "Restore completed"
