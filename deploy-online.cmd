@echo off
setlocal

powershell -ExecutionPolicy Bypass -File "%~dp0deploy-online.ps1" %*

endlocal
