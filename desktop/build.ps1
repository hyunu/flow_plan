# Flow Plan Windows 데스크톱 빌드 스크립트 (PowerShell)
# 1) 프론트 빌드 → 2) PyInstaller(exe) → 3) Inno Setup(설치파일)
# 요구사항: Windows + Python 3.11+, Node.js, (선택) Inno Setup 6
param(
    [switch]$SkipFrontend,
    [switch]$SkipInstaller
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== 1/3 프론트 빌드 ===" -ForegroundColor Cyan
if (-not $SkipFrontend) {
    Push-Location ..\frontend
    npm install
    npm run build
    Pop-Location
} else {
    Write-Host "frontend/dist 를 재사용합니다."
}

Write-Host "=== 2/3 데스크톱 의존성 + 백엔드 설치 ===" -ForegroundColor Cyan
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install -e ..\backend

Write-Host "=== 3/3 PyInstaller 빌드 (FlowPlan.exe) ===" -ForegroundColor Cyan
pyinstaller --noconfirm flowplan.spec
Write-Host "생성: dist\FlowPlan.exe"

if (-not $SkipInstaller) {
    $inno = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
    if (Test-Path $inno) {
        Write-Host "=== 4/3 Inno Setup 설치파일 생성 ===" -ForegroundColor Cyan
        & $inno installer.iss
        Write-Host "생성: dist\FlowPlanSetup.exe"
    } else {
        Write-Warning "Inno Setup 6 을 찾을 수 없습니다. 설치파일 생성을 건너뜁니다."
    }
}

Write-Host "완료."