@echo off
setlocal

set "SKIP_SMOKE=0"
if /I "%~1"=="--skip-smoke" set "SKIP_SMOKE=1"

echo Release check: api lint
pushd "%~dp0..\apps\api"
call npm run lint
if errorlevel 1 goto :fail
popd

echo Release check: web lint
pushd "%~dp0..\apps\web"
call npm run lint
if errorlevel 1 goto :fail
popd

echo Release check: api build
pushd "%~dp0..\apps\api"
call npm run build
if errorlevel 1 goto :fail
popd

echo Release check: web build
pushd "%~dp0..\apps\web"
call npm run build
if errorlevel 1 goto :fail
popd

if "%SKIP_SMOKE%"=="1" goto :success

echo Release check: smoke
pushd "%~dp0.."
call npm run smoke:mvp
if errorlevel 1 goto :fail
popd

:success
echo Release check passed
exit /b 0

:fail
set "ERR=%ERRORLEVEL%"
popd >nul 2>nul
exit /b %ERR%
