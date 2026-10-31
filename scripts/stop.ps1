param([switch]$Database,[string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$statePath = Join-Path $projectRoot '.local\services.json'
if (Test-Path $statePath) {
    $services = @(Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json)
    foreach ($service in $services) {
        $process = Get-Process -Id $service.Pid -ErrorAction SilentlyContinue
        if ($process -and $process.Path -eq $service.Exe) { Stop-Process -Id $service.Pid }
    }
    Remove-Item -LiteralPath $statePath
}
if ($Database) {
    $pgData = Join-Path $projectRoot '.local\pgdata'
    if (Test-Path (Join-Path $pgData 'PG_VERSION')) { & (Join-Path $PgBin 'pg_ctl.exe') stop -D $pgData -m fast -w }
}
Write-Output 'Owned local services stopped. Database files are preserved.'
