@echo off
title LaporTrack Web Server
cd /D "%~dp0"

echo ==========================================================
echo          LAPORTRACK - SERVER PENGEMBANGAN LOKAL
echo ==========================================================
echo.

set PHP_BIN=""
if exist "C:\xamppNew\php\php.exe" (
    set PHP_BIN="C:\xamppNew\php\php.exe"
) else if exist "C:\xampp\php\php.exe" (
    set PHP_BIN="C:\xampp\php\php.exe"
) else (
    where php >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        set PHP_BIN=php
    )
)

if %PHP_BIN%=="" (
    echo [ERROR] PHP tidak ditemukan di C:\xamppNew\php atau system PATH.
    echo Pastikan XAMPP terinstal di komputer Anda.
    pause
    exit /b 1
)

echo [OK] PHP ditemukan: %PHP_BIN%
echo [INFO] Menjalankan server di http://localhost:8000 ...
echo [INFO] Tekan CTRL+C untuk menghentikan server.
echo.
echo Pastikan MySQL di XAMPP Control Panel sudah dalam status START.
echo.

start "" http://localhost:8000

%PHP_BIN% -S localhost:8000
pause

