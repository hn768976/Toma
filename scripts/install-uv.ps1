<#
.SYNOPSIS
    Install uv (https://docs.astral.sh/uv/) on Windows.

.DESCRIPTION
    Wrapper around the official installer:
        powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

.PARAMETER Version
    Release to install, e.g. "0.8.17". Defaults to "latest".

.PARAMETER Force
    Reinstall even when uv is already on PATH.

.EXAMPLE
    powershell -ExecutionPolicy ByPass -File .\scripts\install-uv.ps1

.EXAMPLE
    powershell -ExecutionPolicy ByPass -File .\scripts\install-uv.ps1 -Version 0.8.17 -Force

.NOTES
    Linux/macOS equivalent: scripts/install-uv.sh
#>
[CmdletBinding()]
param(
    [string]$Version = 'latest',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$existing = Get-Command uv -ErrorAction SilentlyContinue
if ($existing -and -not $Force) {
    Write-Host "uv is already installed: $($existing.Source) ($(& uv --version))"
    Write-Host "Re-run with -Force to reinstall, or use 'uv self update'."
    exit 0
}

$url = if ($Version -eq 'latest') {
    'https://astral.sh/uv/install.ps1'
} else {
    "https://astral.sh/uv/$Version/install.ps1"
}

Write-Host "Installing uv from $url ..."

# TLS 1.2 for Windows PowerShell 5.1, which does not negotiate it by default.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Invoke-RestMethod -Uri $url | Invoke-Expression

# The installer updates the user PATH; refresh it so this session sees uv too.
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [Environment]::GetEnvironmentVariable('Path', 'User')

$installed = Get-Command uv -ErrorAction SilentlyContinue
if (-not $installed) {
    Write-Host ''
    Write-Host 'uv was installed but is not on PATH in this session.'
    Write-Host 'Open a new terminal, or add %USERPROFILE%\.local\bin to PATH.'
    exit 0
}

Write-Host ''
Write-Host "Installed: $($installed.Source) ($(& uv --version))"
