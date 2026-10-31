param([switch]$SeedDemo)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $pythonPath)) { throw 'Run python -m venv .venv and install backend dependencies first. See README.md.' }
if (-not (Test-Path (Join-Path $projectRoot '.env'))) { throw 'Configure .env first. For isolated local PostgreSQL, run scripts/init-local.ps1.' }
$localDir = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
Push-Location (Join-Path $projectRoot 'backend')
try {
    & $pythonPath -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw 'Migration failed. Verify that PostgreSQL is running.' }
    if ($SeedDemo) { & $pythonPath -m app.cli seed-demo }
} finally { Pop-Location }
$running = @()
foreach ($service in @(
    @{Port=8000;Name='backend';Exe=$pythonPath;Args='-m uvicorn app.main:app --host 127.0.0.1 --port 8000';Dir=(Join-Path $projectRoot 'backend')},
    @{Port=5173;Name='frontend';Exe=(Get-Command node.exe).Source;Args='node_modules/vite/bin/vite.js --host 127.0.0.1';Dir=(Join-Path $projectRoot 'frontend')}
)) {
    if (Get-NetTCPConnection -LocalPort $service.Port -State Listen -ErrorAction SilentlyContinue) {
        Write-Output "$($service.Name): port $($service.Port) is already in use; leaving the existing process untouched."
        continue
    }
    $process = Start-Process -FilePath $service.Exe -ArgumentList $service.Args -WorkingDirectory $service.Dir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $localDir "$($service.Name).log") -RedirectStandardError (Join-Path $localDir "$($service.Name).error.log")
    $running += @{Name=$service.Name;Pid=$process.Id;Exe=$service.Exe}
}
if ($running.Count -gt 0) { ConvertTo-Json -InputObject @($running) | Set-Content -LiteralPath (Join-Path $localDir 'services.json') }
Write-Output 'PARKLY: http://127.0.0.1:5173 | API: http://127.0.0.1:8000/docs'
Write-Output 'Use scripts/stop.ps1 to stop processes started by this script.'
