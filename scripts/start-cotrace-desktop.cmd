@echo off
setlocal EnableExtensions
title CoTrace Demo

rem One-click launcher for Desktop shortcut / double-click.
rem Working directory is forced to the repo root (parent of scripts\).

cd /d "%~dp0.."
if errorlevel 1 (
  echo [cotrace-launcher] Failed to cd to repo root: "%~dp0.."
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo [cotrace-launcher] Node.js was not found on PATH.
  echo Install Node.js LTS from https://nodejs.org/ and reopen this shortcut.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo.
  echo [cotrace-launcher] npm was not found on PATH.
  echo Reinstall Node.js ^(includes npm^) and try again.
  echo.
  pause
  exit /b 1
)

echo [cotrace-launcher] Starting CoTrace Desktop from:
echo   %CD%
echo.

node "%~dp0start-cotrace-desktop.mjs"
set "EXITCODE=%ERRORLEVEL%"

if not "%EXITCODE%"=="0" (
  echo.
  echo [cotrace-launcher] Exited with code %EXITCODE%.
  pause
)

exit /b %EXITCODE%
