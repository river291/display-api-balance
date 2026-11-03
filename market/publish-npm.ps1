# Publish display-api-balance to the public npm registry.
#
# The machine's default npm registry is the npmmirror read-only mirror, so this
# script always targets https://registry.npmjs.org/ and keeps the npm cache
# inside the repository (the home cache directory is not writable here).
#
# Idempotent: it refuses to publish a version that already exists, and reports
# `login-required` instead of failing when npm has no usable token.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\publish-npm.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\publish-npm.ps1 -DryRun
#
param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$Registry = 'https://registry.npmjs.org/'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Cache = Join-Path $RepoRoot '.npm-cache'
$PackageJson = Join-Path $RepoRoot 'package.json'
$LogPath = Join-Path $PSScriptRoot 'publish.log'
$StatusPath = Join-Path $PSScriptRoot 'publish-status.json'

function Write-Log {
    param([string]$Message)
    $line = '[' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '] ' + $Message
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
    Write-Host $line
}

function Resolve-Npm {
    $candidates = @()
    $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($null -ne $cmd) { $candidates += $cmd.Source }
    $candidates += 'D:\nvm4w\nodejs\npm.cmd'
    $candidates += (Join-Path $env:ProgramFiles 'nodejs\npm.cmd')
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
    }
    throw 'npm.cmd not found'
}

function Invoke-Npm {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    $output = & $script:Npm @Arguments 2>&1
    $code = $LASTEXITCODE
    return [pscustomobject]@{ Code = $code; Output = (($output | Out-String).Trim()) }
}

function Write-Status {
    param([string]$State, [string]$Version, [string]$Message)
    $status = [ordered]@{
        at = (Get-Date).ToString('o')
        state = $State
        version = $Version
        message = $Message
        dryRun = [bool]$DryRun
    }
    [IO.File]::WriteAllText($StatusPath, ($status | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
}

function Test-VersionPublished {
    param([string]$Name, [string]$Version)
    $result = Invoke-Npm -Arguments @('view', ($Name + '@' + $Version), 'version', ('--registry=' + $Registry), ('--cache=' + $Cache), '--fetch-retries=0', '--fetch-timeout=30000')
    if ($result.Code -eq 0) { return $true }
    if ($result.Output -match 'E404|404 Not Found|is not in this registry') { return $false }
    throw ('npm view failed: ' + $result.Output)
}

try {
    $script:Npm = Resolve-Npm
    $manifest = Get-Content -LiteralPath $PackageJson -Raw | ConvertFrom-Json
    $name = $manifest.name
    $version = $manifest.version
    Write-Log ('start (dryRun=' + $DryRun + ') ' + $name + '@' + $version)

    if (Test-VersionPublished -Name $name -Version $version) {
        Write-Log ('version already published: ' + $name + '@' + $version)
        Write-Status -State 'already-published' -Version $version -Message 'version exists on the registry'
        exit 0
    }

    $who = Invoke-Npm -Arguments @('whoami', ('--registry=' + $Registry), ('--cache=' + $Cache), '--fetch-retries=0', '--fetch-timeout=30000')
    if ($who.Code -ne 0) {
        Write-Log 'npm is not logged in to the public registry'
        Write-Status -State 'login-required' -Version $version -Message ('run: npm login --registry=' + $Registry)
        exit 3
    }
    Write-Log ('logged in as ' + $who.Output)

    if ($DryRun) {
        Write-Log 'dry run: would publish now'
        Write-Status -State 'dry-run' -Version $version -Message 'logged in and version is free'
        exit 0
    }

    $publish = Invoke-Npm -Arguments @('publish', ('--registry=' + $Registry), ('--cache=' + $Cache), '--access', 'public', '--no-fund', '--no-audit')
    Write-Log ('npm publish exit ' + $publish.Code + ': ' + $publish.Output)
    if ($publish.Code -ne 0) {
        if ($publish.Output -match 'EOTP|one-time password') {
            Write-Status -State 'otp-required' -Version $version -Message 'publish needs a one-time password; run npm publish with --otp=... in a terminal'
        } else {
            Write-Status -State 'failed' -Version $version -Message $publish.Output
        }
        exit 1
    }

    if (-not (Test-VersionPublished -Name $name -Version $version)) {
        throw 'publish reported success, but the version is not visible yet'
    }
    Write-Log ('published ' + $name + '@' + $version)
    Write-Status -State 'published' -Version $version -Message ('https://www.npmjs.com/package/' + $name)
    exit 0
} catch {
    $message = $_.Exception.Message
    Write-Log ('FAILED: ' + $message)
    try { Write-Status -State 'failed' -Version '' -Message $message } catch { }
    exit 1
}
