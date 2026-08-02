@echo off
title Controle de Vendas - Iniciar servidor
cd /d "%~dp0"

echo ============================================
echo  Controle de Vendas
echo  Iniciando servidor (API + site)...
echo ============================================
echo.
echo  Se o Firewall do Windows perguntar,
echo  clique em "Permitir acesso" para o Node.js.
echo.

start "Controle de Vendas - API + Site :3000" cmd /k "cd /d %~dp0backend && node server.js"

echo  Pronto! Janela aberta.
echo  No notebook:  http://localhost:3000
echo  No celular:   http://SEU-IP:3000
echo.
pause
