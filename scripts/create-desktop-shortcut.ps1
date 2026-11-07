# Creates "%USERPROFILE%\Desktop\CoTrace Demo.lnk" pointing at the in-repo launcher.
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$target = Join-Path $PSScriptRoot 'start-cotrace-desktop.cmd'
$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'CoTrace Demo.lnk'

if (-not (Test-Path -LiteralPath $target)) {
  throw "Launcher not found: $target"
}

$shell = New-Object -ComObject WScript.Shell
$sc = $shell.CreateShortcut($lnkPath)
$sc.TargetPath = $target
$sc.WorkingDirectory = $repoRoot
$sc.WindowStyle = 1
$sc.Description = 'Start CoTrace Vite (if needed) then open the Electron desktop demo'
$sc.Save()

Write-Output "Created=$lnkPath"
Write-Output "Target=$($sc.TargetPath)"
Write-Output "WorkingDirectory=$($sc.WorkingDirectory)"
Write-Output "Exists=$(Test-Path -LiteralPath $lnkPath)"
