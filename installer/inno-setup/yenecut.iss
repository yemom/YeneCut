; Inno Setup Script for YeneCut AI
#define MyAppName "YeneCut AI"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "YeneCut AI Team"
#define MyAppURL "https://github.com/yenecut/yenecut-ai"

[Setup]
AppId={{5D04FA32-8D92-494E-8F86-8809AA13FE90}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\YeneCutAI
DisableProgramGroupPage=yes
OutputBaseFilename=YeneCut-AI-Setup-v{#MyAppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Plugin Distribution
Source: "..\..\apps\premiere-plugin\dist\*"; DestDir: "{userappdata}\Adobe\UXP\Plugins\External\com.yenecut.ai"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\apps\premiere-plugin\dist\*"; DestDir: "{userappdata}\Adobe\UXP\Extensions\com.yenecut.ai"; Flags: ignoreversion recursesubdirs createallsubdirs

; CCX Package
Source: "..\..\YeneCut-AI.ccx"; DestDir: "{app}"; Flags: ignoreversion

; Scripts & Engine
Source: "..\..\scripts\*"; DestDir: "{app}\scripts"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\apps\ai-engine\*"; DestDir: "{app}\apps\ai-engine"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.pyc,__pycache__,.venv"
Source: "..\..\installer\*"; DestDir: "{app}\installer"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\Setup-YeneCut.bat"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}\Start AI Engine"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NoExit -File ""{app}\scripts\windows\start-ai-engine.ps1"""
Name: "{autoprograms}\{#MyAppName}\YeneCut Setup & Diagnostics"; Filename: "{app}\Setup-YeneCut.bat"
Name: "{autodesktop}\Start YeneCut AI Engine"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NoExit -File ""{app}\scripts\windows\start-ai-engine.ps1"""; Tasks: desktopicon
Name: "{autodesktop}\YeneCut AI Setup & Diagnostics"; Filename: "{app}\Setup-YeneCut.bat"; Tasks: desktopicon

[Run]
Filename: "{app}\Setup-YeneCut.bat"; Description: "Launch YeneCut AI Setup & Diagnostics"; Flags: nowait postinstall skipifsilent
