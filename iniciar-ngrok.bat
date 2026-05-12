@echo off
echo ============================================
echo   APR - Tunnel de Acesso Remoto (ngrok)
echo ============================================
echo.
echo Iniciando tunnel...
echo A URL publica sera exibida abaixo.
echo Copie o endereco "Forwarding https://..." e envie para a outra maquina.
echo.
echo Para encerrar: pressione CTRL+C
echo.
C:\ngrok\ngrok.exe http 5173
