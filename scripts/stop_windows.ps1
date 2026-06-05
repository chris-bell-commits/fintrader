#Requires -Version 5
$ErrorActionPreference = "Stop"

$Container = "fintrader"

$existing = docker ps -a --format '{{.Names}}' | Select-String -Pattern "^$Container$"
if ($existing) {
    docker rm -f $Container | Out-Null
    Write-Host "Stopped and removed container $Container. Data volume preserved."
} else {
    Write-Host "Container $Container is not running."
}
