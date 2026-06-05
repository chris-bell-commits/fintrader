#Requires -Version 5
$ErrorActionPreference = "Stop"

$Image = "fintrader"
$Container = "fintrader"
$Port = "8000"
$Volume = "fintrader-data"

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

$Build = ($args.Count -gt 0 -and $args[0] -eq "--build")

if (-not (Test-Path ".env")) {
    Write-Error "Error: .env not found. Copy .env.example to .env and add your keys."
    exit 1
}

$imageExists = docker image inspect $Image 2>$null
if ($Build -or -not $imageExists) {
    Write-Host "Building image $Image..."
    docker build -t $Image .
}

$existing = docker ps -a --format '{{.Names}}' | Select-String -Pattern "^$Container$"
if ($existing) {
    Write-Host "Stopping existing container..."
    docker rm -f $Container | Out-Null
}

Write-Host "Starting container..."
docker run -d `
    --name $Container `
    -v "${Volume}:/app/db" `
    -p "${Port}:8000" `
    --env-file .env `
    $Image | Out-Null

Write-Host "FinTrader is running at http://localhost:$Port"
