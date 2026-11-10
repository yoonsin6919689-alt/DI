@echo off
setlocal
set ROOT=%~dp0
set LIBS=C:\Users\qw691\Downloads\26.2-199\libraries
set CP=%LIBS%\io\papermc\paper\paper-api\26.3.build.202-stable\paper-api-26.3.build.202-stable.jar
set CP=%CP%;%LIBS%\net\kyori\adventure-key\5.2.0\adventure-key-5.2.0.jar
set CP=%CP%;%LIBS%\net\kyori\adventure-api\5.2.0\adventure-api-5.2.0.jar
set CP=%CP%;%ROOT%lib\annotations-24.1.0.jar
set OUT=%ROOT%build
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%\classes"
javac -encoding UTF-8 -cp "%CP%" -d "%OUT%\classes" "%ROOT%src\kr\dimension\status\StatusPlugin.java"
if errorlevel 1 exit /b 1
copy /y "%ROOT%resources\plugin.yml" "%OUT%\classes\plugin.yml" >nul
copy /y "%ROOT%resources\config.yml" "%OUT%\classes\config.yml" >nul
jar cf "%OUT%\DIMENSIONStatus-1.2.0.jar" -C "%OUT%\classes" .
if errorlevel 1 exit /b 1
echo BUILD_OK
