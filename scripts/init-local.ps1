param([string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$localDir = Join-Path $projectRoot '.local'
$pgData = Join-Path $localDir 'pgdata'
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
if (-not (Test-Path (Join-Path $projectRoot '.env'))) {
    $randomBytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $generator.GetBytes($randomBytes)
    $generator.Dispose()
    $dbSecret = [BitConverter]::ToString($randomBytes).Replace('-', '')
    @"
DATABASE_URL=postgresql+psycopg://parkly:$dbSecret@127.0.0.1:55432/parkly
POSTGRES_USER=parkly
POSTGRES_PASSWORD=$dbSecret
POSTGRES_DB=parkly
APP_ENV=development
COOKIE_SECURE=false
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:5174
"@ | Set-Content -LiteralPath (Join-Path $projectRoot '.env')
} else {
    $secretLine = Get-Content -LiteralPath (Join-Path $projectRoot '.env') | Where-Object { $_ -like 'POSTGRES_PASSWORD=*' }
    $dbSecret = $secretLine.Substring('POSTGRES_PASSWORD='.Length)
}
if (-not (Test-Path (Join-Path $pgData 'PG_VERSION'))) {
    $passwordFile = Join-Path $localDir 'init-password.tmp'
    try {
        Set-Content -LiteralPath $passwordFile -Value $dbSecret -NoNewline
        & (Join-Path $PgBin 'initdb.exe') -D $pgData -U parkly --auth=scram-sha-256 --encoding=UTF8 --locale=C --pwfile=$passwordFile
        if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL initialization failed.' }
        Add-Content -LiteralPath (Join-Path $pgData 'postgresql.conf') -Value "`nlisten_addresses = '127.0.0.1'`nport = 55432`ntimezone = 'UTC'"
    } finally { if (Test-Path $passwordFile) { Remove-Item -LiteralPath $passwordFile } }
}
& (Join-Path $PgBin 'pg_ctl.exe') status -D $pgData 2>$null
if ($LASTEXITCODE -ne 0) {
    & (Join-Path $PgBin 'pg_ctl.exe') start -D $pgData -l (Join-Path $localDir 'postgres.log') -w
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL startup failed.' }
}
$env:PGPASSWORD = $dbSecret
try {
    foreach ($dbName in @('parkly', 'parkly_test', 'parkly_e2e')) {
        $exists = & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p 55432 -U parkly -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$dbName'"
        if ($exists -ne '1') { & (Join-Path $PgBin 'createdb.exe') -h 127.0.0.1 -p 55432 -U parkly $dbName }
    }
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
Write-Output 'Isolated PostgreSQL ready on 127.0.0.1:55432. Credentials are in the ignored .env file.'
