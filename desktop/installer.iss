; FlowPlan Inno Setup 스크립트 — FlowPlanSetup.exe 생성
; 빌드: build.ps1 (또는 ISCC.exe installer.iss)
#define MyAppName "Flow Plan"
#define MyAppVersion "0.2.0"
#define MyAppExeName "FlowPlan.exe"

[Setup]
AppId={{8F2C6A1E-4B3D-4A9F-8E6C-0D1B2A3C4D5E}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher="Flow Plan"
DefaultDirName={localappdata}\Programs\FlowPlan
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=dist
OutputBaseFilename=FlowPlanSetup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "바탕화면에 바로가기 만들기"; GroupDescription: "추가 옵션:"
Name: "autostart"; Description: "시스템 시작 시 자동 실행(트레이 상주)"; GroupDescription: "추가 옵션:"

[Files]
Source: "dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
; 자동 시작(트레이 상주) — 설치 옵션으로 등록
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; \
  ValueType: string; ValueName: "FlowPlan"; \
  ValueData: """{app}\{#MyAppExeName}"""; \
  Flags: uninsdeletevalue; Tasks: autostart

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; \
  Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{userappdata}\FlowPlan"