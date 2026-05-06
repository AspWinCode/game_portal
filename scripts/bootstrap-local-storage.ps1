param(
  [string]$Bucket = "game-game-media",
  [string]$Endpoint = "http://localhost:9000",
  [string]$AccessKey = "minioadmin",
  [string]$SecretKey = "minioadmin"
)

$ErrorActionPreference = "Stop"

Write-Host "Configuring local S3-compatible storage settings in .env..."

if (-not (Test-Path ".env")) {
  Copy-Item .env.example .env -Force
}

$envContent = Get-Content .env
$replacements = @{
  'STORAGE_PROVIDER=".*"' = 'STORAGE_PROVIDER="s3"'
  'S3_ENDPOINT=".*"' = "S3_ENDPOINT=""$Endpoint"""
  'S3_REGION=".*"' = 'S3_REGION="us-east-1"'
  'S3_BUCKET=".*"' = "S3_BUCKET=""$Bucket"""
  'S3_ACCESS_KEY_ID=".*"' = "S3_ACCESS_KEY_ID=""$AccessKey"""
  'S3_SECRET_ACCESS_KEY=".*"' = "S3_SECRET_ACCESS_KEY=""$SecretKey"""
  'S3_FORCE_PATH_STYLE=".*"' = 'S3_FORCE_PATH_STYLE="true"'
  'S3_PUBLIC_BASE_URL=".*"' = "S3_PUBLIC_BASE_URL=""$Endpoint/$Bucket"""
  'S3_CREATE_BUCKET_IF_MISSING=".*"' = 'S3_CREATE_BUCKET_IF_MISSING="true"'
}

foreach ($pattern in $replacements.Keys) {
  $replacement = $replacements[$pattern]
  if ($envContent -match $pattern) {
    $envContent = $envContent -replace $pattern, $replacement
  } else {
    $envContent += $replacement
  }
}

Set-Content .env $envContent

Write-Host "Done. STORAGE_PROVIDER is now set to s3 in .env."
Write-Host "Next:"
Write-Host "1. docker compose up -d minio minio-init"
Write-Host "2. restart npm run dev:api"
Write-Host "3. run npm run smoke:mvp"
