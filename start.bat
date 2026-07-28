@echo off
setlocal
cd /d "%~dp0"

rem Prefer the active Conda/venv interpreter when it is Python 3.11.
python -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 11) else 1)" >nul 2>&1
if not errorlevel 1 goto run_python

rem Support the repository's documented Conda environment without a hard-coded path.
call conda run -n python3.11 python -c "import sys" >nul 2>&1
if not errorlevel 1 goto run_conda

rem Fall back to the Windows Python launcher.
py -3.11 -c "import sys" >nul 2>&1
if not errorlevel 1 goto run_py_launcher

echo [ERROR] Python 3.11 was not found.
echo Activate a Python 3.11 Conda/venv environment, or install Python 3.11
echo with the Windows Python launcher enabled.
pause
exit /b 1

:run_python
python run.py %*
if errorlevel 1 goto launch_failed
exit /b 0

:run_conda
call conda run --no-capture-output -n python3.11 python run.py %*
if errorlevel 1 goto launch_failed
exit /b 0

:run_py_launcher
py -3.11 run.py %*
if errorlevel 1 goto launch_failed
exit /b 0

:launch_failed
echo.
echo [ERROR] Pisces-Explorer failed to start. Review the message above.
pause
exit /b 1
