@echo off
cd /d c:\temp\apr-desktop1\apr-desktop1

echo Killing processes...
taskkill /F /IM electron.exe 2>nul || echo No electron.exe found
taskkill /F /IM node.exe 2>nul || echo No node.exe found

echo Deleting old release...
if exist release (
  for /d %%i in (release\*) do (
    rmdir /s /q "%%i" 2>nul || echo Could not delete %%i
  )
  rmdir /s /q release 2>nul || echo Could not delete release
)

echo Building React...
call npm run build

echo Packaging with electron-packager...
call npx electron-packager . SolicitaWeb --platform=win32 --arch=x64 --out=release --asar=false --ignore=.git --ignore=node_modules

if exist release\SolicitaWeb-win32-x64\SolicitaWeb.exe (
  echo SUCCESS: SolicitaWeb.exe created
  dir release\SolicitaWeb-win32-x64\SolicitaWeb.exe
) else (
  echo ERROR: SolicitaWeb.exe not found
  dir release\
)

pause
