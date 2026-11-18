' YeneCut AI - Silent AI Engine Launcher
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectRoot = fso.GetParentFolderName(currentDir)
scriptPath = projectRoot & "\scripts\windows\start-ai-engine.ps1"

command = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & scriptPath & """"
WshShell.Run command, 0, False
