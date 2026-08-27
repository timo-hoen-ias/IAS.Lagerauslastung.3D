@echo off
cd /d "%~dp0"

where bun >nul 2>nul
if errorlevel 1 (
    echo Bun ist nicht installiert. Bitte https://bun.sh installieren.
    pause
    exit /b 1
)

if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo .env aus .env.example erstellt - ggf. Zugangsdaten pruefen.
    )
)

if not exist "node_modules" (
    echo Installiere Abhaengigkeiten...
    call bun install
    if errorlevel 1 (
        echo bun install fehlgeschlagen.
        pause
        exit /b 1
    )
)

echo Starte Server (:3001) und Frontend (:5173)...
echo Oeffne danach http://localhost:5173
call bun run dev
pause
