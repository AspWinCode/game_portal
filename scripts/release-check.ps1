param(
  [switch]$SkipSmoke
)

$ErrorActionPreference = "Stop"

Write-Host "Release check: api lint"
cmd /c npm --workspace @game-game/api run lint
if ($LASTEXITCODE -ne 0) { throw "API lint failed" }

Write-Host "Release check: web lint"
cmd.exe /d /s /c "cd /d %CD%\apps\web && npm run lint"
if ($LASTEXITCODE -ne 0) { throw "Web lint failed" }

Write-Host "Release check: api build"
cmd /c npm --workspace @game-game/api run build
if ($LASTEXITCODE -ne 0) { throw "API build failed" }

Write-Host "Release check: web build"
cmd.exe /d /s /c "cd /d %CD%\apps\web && npm run build"
$buildExit = $LASTEXITCODE
if ($buildExit -ne 0) { throw "Web build failed" }

if (-not $SkipSmoke) {
  Write-Host "Release check: smoke"
  cmd /c npm run smoke:mvp
  if ($LASTEXITCODE -ne 0) { throw "Smoke failed" }
}

Write-Host "Release check passed"
