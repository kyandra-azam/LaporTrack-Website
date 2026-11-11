@echo off
title Salin LaporTrack ke XAMPP htdocs
cd /D "%~dp0"

echo ==========================================================
echo        SALIN PROYEK LAPORTRACK KE XAMPP HTDOCS
echo ==========================================================
echo.

set TARGET_DIR="C:\xamppNew\htdocs\Lapor_Track"
if not exist "C:\xamppNew\htdocs" (
    if exist "C:\xampp\htdocs" (
        set TARGET_DIR="C:\xampp\htdocs\Lapor_Track"
    )
)

echo Menyalin seluruh berkas ke %TARGET_DIR% ...
xcopy /E /I /Y "%~dp0*" %TARGET_DIR%

echo.
echo ==========================================================
echo Selesai! Anda sekarang dapat mengakses proyek ini melalui:
echo http://localhost/Lapor_Track/
echo ==========================================================
pause

