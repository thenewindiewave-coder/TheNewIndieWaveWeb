@echo off
title The New Indie Wave - Curador de Threads
cd /d "%~dp0"
echo ========================================================
echo   INICIANDO CURADOR AUTOMATICO DE THREADS Y SPOTIFY
echo ========================================================
node scripts\threads-curador.js
pause
