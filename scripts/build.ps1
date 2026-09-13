# PowerShell build script for MacDrop on Windows
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "       MacDrop Windows Builder          " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Set-Location $PSScriptRoot\..

Write-Host "`n[1/3] Generating icons..." -ForegroundColor Yellow
python scripts\generate_icons.py

Write-Host "`n[2/3] Compiling TypeScript & UI assets..." -ForegroundColor Yellow
npx vite build

Write-Host "`n[3/3] Packaging Windows executable (.exe)..." -ForegroundColor Yellow
npx electron-builder --win

Write-Host "`n[SUCCESS] Build complete! Executables located in release/ folder." -ForegroundColor Green
Get-ChildItem release\*.exe | Select-Object Name, Length, LastWriteTime
