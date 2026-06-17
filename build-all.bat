@echo off
setlocal

cd /d "%~dp0"

echo.
echo Strudel Studio desktop build
echo Output folder: build
echo.

if exist build (
  echo Cleaning old build output...
  rmdir /s /q build
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Install Node.js LTS first: https://nodejs.org/
  exit /b 1
)

call npm install
if errorlevel 1 exit /b 1

call npm run build:app
if errorlevel 1 exit /b 1

echo.
echo Building Windows installer and portable app...
call npx electron-builder --win --x64
if errorlevel 1 exit /b 1
call npm run collect:artifacts
if errorlevel 1 exit /b 1

echo.
echo Trying Linux packages from Windows...
call npx electron-builder --linux --x64
if errorlevel 1 (
  echo.
  echo Linux packaging did not complete on this Windows machine.
  echo Build Linux on Linux, or use Docker/electron-builder CI later.
  echo Skipping Linux artifact collection.
) else (
  call npm run collect:artifacts
  if errorlevel 1 exit /b 1
)

echo.
echo macOS DMG/ZIP packages must be built on macOS because Apple signing and packaging tools are macOS-only.
echo Run ./build-all.sh on a Mac to create macOS packages.
echo.
echo Distributable packages are in build\bin. Intermediate builder output remains in build.
