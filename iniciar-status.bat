@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node.js e tente novamente.
  pause
  exit /b 1
)
start "Status de Entregas - Servidor" /D "%~dp0" cmd /k node dev-server.js
timeout /t 2 /nobreak >nul
start "" "http://localhost:8080/status.html"
