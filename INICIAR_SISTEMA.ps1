# ╔══════════════════════════════════════════════════════════════╗
# ║   INAPYMI – Script de inicio de servidores                  ║
# ║   Ejecute este archivo con PowerShell como administrador     ║
# ╚══════════════════════════════════════════════════════════════╝

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "  ██╗███╗   ██╗ █████╗ ██████╗ ██╗   ██╗███╗   ███╗██╗" -ForegroundColor Red
Write-Host "  ██║████╗  ██║██╔══██╗██╔══██╗╚██╗ ██╔╝████╗ ████║██║" -ForegroundColor Red
Write-Host "  ██║██╔██╗ ██║███████║██████╔╝ ╚████╔╝ ██╔████╔██║██║" -ForegroundColor Yellow
Write-Host "  ██║██║╚██╗██║██╔══██║██╔═══╝   ╚██╔╝  ██║╚██╔╝██║██║" -ForegroundColor Yellow
Write-Host "  ██║██║ ╚████║██║  ██║██║        ██║   ██║ ╚═╝ ██║██║" -ForegroundColor White
Write-Host "  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝        ╚═╝   ╚═╝     ╚═╝╚═╝" -ForegroundColor White
Write-Host ""
Write-Host "  Sistema de Registro Post-Sismo" -ForegroundColor Cyan
Write-Host "  Instituto Nacional de Desarrollo de la Pequeña y Mediana Industria" -ForegroundColor Gray
Write-Host ""

# ── Verificar Node.js ──────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  [ERROR] Node.js no está instalado. Descárgalo de: https://nodejs.org" -ForegroundColor Red
} else {
    $nodeVersion = node --version
    Write-Host "  [OK] Node.js $nodeVersion encontrado" -ForegroundColor Green
    
    # Instalar dependencias si no existen
    if (-not (Test-Path "$root\node_backend\node_modules")) {
        Write-Host "  [INFO] Instalando dependencias Node.js..." -ForegroundColor Cyan
        Set-Location "$root\node_backend"
        npm install
    }
    
    # Iniciar backend Node.js en nueva ventana
    Write-Host "  [START] Iniciando backend Node.js en puerto 3001..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'INAPYMI - Backend Node.js' -ForegroundColor Cyan; node server.js" -WorkingDirectory "$root\node_backend" -WindowStyle Normal
}


# ── Abrir frontend en el navegador ────────────────────────────────
Write-Host ""
Write-Host "  [INFO] Esperando 2 segundos para que los servidores inicien..." -ForegroundColor Cyan
Start-Sleep -Seconds 2

Write-Host "  [BROWSER] Abriendo la aplicación en el navegador (http://localhost:3001)..." -ForegroundColor Green
Start-Process "http://localhost:3001"

Write-Host ""
Write-Host "  ╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Presione cualquier tecla para cerrar esta ventana..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
