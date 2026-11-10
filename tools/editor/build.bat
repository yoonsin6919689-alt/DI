@echo off
set ROOT=%~dp0..\..
if not exist "%ROOT%\public\downloads" mkdir "%ROOT%\public\downloads"
"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" -nologo -codepage:65001 -target:winexe -platform:anycpu -optimize+ -win32icon:"%~dp0icon.ico" -out:"%ROOT%\public\downloads\DIMENSION-Editor.exe" -r:System.dll -r:System.Core.dll -r:System.Windows.Forms.dll -r:System.Drawing.dll -r:System.Web.Extensions.dll "%~dp0Editor.cs"
if errorlevel 1 exit /b 1
echo BUILD_OK
