@echo off
echo ==================================================
echo   APR - Tunnel de Acesso Remoto (Cloudflare)
echo ==================================================
echo.
echo Iniciando tunnel...
echo A URL publica sera gerada em alguns segundos.
echo.
echo Procure pela linha que contem: "https://...trycloudflare.com"
echo.
echo Para encerrar: pressione CTRL+C
echo.
C:\cloudflare\cloudflared.exe tunnel --url http://localhost:5173
pause
