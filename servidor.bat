@echo off
title Controle de Vendas - Iniciar servidores
cd /d "%~dp0"

echo ============================================
echo  Controle de Vendas
echo  Iniciando servidores...
echo ============================================
echo.
echo  Se o Firewall do Windows perguntar,
echo  clique em "Permitir acesso" para o Node.js.
echo.

start "Backend - API :3000" cmd /k "cd /d %~dp0backend && node server.js"
start "Frontend - Web :8080" cmd /k "cd /d %~dp0frontend && node server.js"

echo  Pronto! Janelas separadas abriram.
echo  No notebook:  http://localhost:8080
echo  No celular:   http://SEU-IP:8080  (endereco do servidor: http://SEU-IP:3000)
echo.
pause
