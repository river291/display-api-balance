# Submit display-api-balance to the awesome-dsh-plugin community list.
#
# Idempotent: safe to run repeatedly. It checks the repository age, an existing
# pull request, the fork, the branch file and only then opens the PR. All writes
# go through the GitHub API via `gh`, so no git remote/TLS setup is involved.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\submit-to-market.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\submit-to-market.ps1 -DryRun
#   ... -PrepareOnly  # fork + file only, no pull request
#   ... -Force        # skip the "repository is at least 1 day old" gate
#
param(
    [switch]$DryRun,
    [switch]$PrepareOnly,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$Gh = 'C:\Program Files\GitHub CLI\gh.exe'
$Upstream = 'awesome-dsh-plugin/awesome-dsh-plugin'
$ForkOwner = 'river291'
$ForkRepo = 'awesome-dsh-plugin'
$SourceRepo = 'river291/display-api-balance'
$Branch = 'add-display-api-balance'
$EntryPath = 'data/plugins/river291__display-api-balance.yml'
$PrTitle = 'Add display-api-balance'

$EntryFile = Join-Path $PSScriptRoot 'river291__display-api-balance.yml'
$PrBodyFile = Join-Path $PSScriptRoot 'PR-body.md'
$LogPath = Join-Path $PSScriptRoot 'submit.log'
$StatusPath = Join-Path $PSScriptRoot 'submit-status.json'

function Write-Log {
    param([string]$Message)
    $line = '[' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '] ' + $Message
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
    Write-Host $line
}

function Invoke-Gh {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [switch]$AllowFailure
    )
    $output = & $Gh @Arguments 2>&1
    $code = $LASTEXITCODE
    $text = ($output | Out-String).Trim()
    if ($code -ne 0 -and -not $AllowFailure) {
        throw ('gh ' + ($Arguments -join ' ') + ' failed (exit ' + $code + '): ' + $text)
    }
    return [pscustomobject]@{ Code = $code; Output = $text }
}

function Write-Status {
    param([string]$State, [string]$PrUrl, [string]$Message)
    $status = [ordered]@{
        at = (Get-Date).ToString('o')
        state = $State
        prUrl = $PrUrl
        message = $Message
        dryRun = [bool]$DryRun
    }
    [IO.File]::WriteAllText($StatusPath, ($status | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
}

function Invoke-TempFile {
    param([string]$Suffix)
    $dir = Join-Path ([IO.Path]::GetTempPath()) 'display-api-balance-submit'
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    return (Join-Path $dir ((Get-Date -Format 'yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N') + $Suffix))
}

try {
    Write-Log ('start (dryRun=' + $DryRun + ', force=' + $Force + ')')

    if (-not (Test-Path -LiteralPath $Gh)) { throw ('gh not found at ' + $Gh) }
    if (-not (Test-Path -LiteralPath $EntryFile)) { throw ('entry file missing: ' + $EntryFile) }
    if (-not (Test-Path -LiteralPath $PrBodyFile)) { throw ('PR body missing: ' + $PrBodyFile) }

    # 1. Repository age: the list's CI requires at least one day.
    $created = (Invoke-Gh -Arguments @('api', ('repos/' + $SourceRepo), '--jq', '.created_at')).Output
    $createdAt = [datetimeoffset]::Parse($created, [Globalization.CultureInfo]::InvariantCulture)
    $ageHours = ([datetimeoffset]::UtcNow - $createdAt).TotalHours
    Write-Log ('source repo created ' + $created + '; age ' + [math]::Round($ageHours, 2) + 'h')

    if ((-not $Force) -and ($ageHours -lt 24)) {
        if ($DryRun) {
            Write-Log 'age gate not met yet; dry run continues (no writes)'
        } else {
            Write-Log 'age gate not met (<24h); nothing to do'
            Write-Status -State 'too-young' -PrUrl '' -Message ('age ' + [math]::Round($ageHours, 2) + 'h')
            exit 2
        }
    }

    # 2. Existing pull request for this branch? Then there is nothing to do.
    $prList = Invoke-Gh -Arguments @('pr', 'list', '--repo', $Upstream, '--state', 'all', '--head', ($ForkOwner + ':' + $Branch), '--json', 'number,url,state')
    $existing = $null
    if ($prList.Code -eq 0 -and $prList.Output -ne '') {
        try { $asArray = @($prList.Output | ConvertFrom-Json) } catch { $asArray = @() }
        if ($asArray.Count -gt 0) { $existing = $asArray[0] }
    }
    if ($null -ne $existing) {
        Write-Log ('PR already exists: ' + $existing.url + ' (' + $existing.state + ')')
        Write-Status -State 'exists' -PrUrl $existing.url -Message ('PR #' + $existing.number)
        exit 0
    }

    # 3. Fork, created on demand and waited for.
    $fork = Invoke-Gh -Arguments @('api', ('repos/' + $ForkOwner + '/' + $ForkRepo), '--jq', '.full_name') -AllowFailure
    if ($fork.Code -ne 0) {
        if ($DryRun) {
            Write-Log 'fork does not exist; would create it'
        } else {
            Write-Log 'creating fork...'
            Invoke-Gh -Arguments @('api', ('repos/' + $Upstream + '/forks'), '-X', 'POST') | Out-Null
            $ready = $false
            for ($i = 0; $i -lt 24; $i++) {
                Start-Sleep -Seconds 5
                $fork = Invoke-Gh -Arguments @('api', ('repos/' + $ForkOwner + '/' + $ForkRepo), '--jq', '.full_name') -AllowFailure
                if ($fork.Code -eq 0) { $ready = $true; break }
            }
            if (-not $ready) { throw 'fork did not become available' }
            Write-Log ('fork ready: ' + $fork.Output)
        }
    } else {
        Write-Log ('fork exists: ' + $fork.Output)
    }

    # 4. Keep the fork's default branch current so the PR is not stale.
    $defaultBranch = (Invoke-Gh -Arguments @('api', ('repos/' + $Upstream), '--jq', '.default_branch')).Output
    if ($DryRun) {
        Write-Log ('would merge upstream ' + $defaultBranch + ' into the fork and write ' + $EntryPath + ' on branch ' + $Branch)
    } else {
        $sync = Invoke-Gh -Arguments @('api', '-X', 'POST', ('repos/' + $ForkOwner + '/' + $ForkRepo + '/merge-upstream'), '-f', ('branch=' + $defaultBranch)) -AllowFailure
        Write-Log ('merge-upstream exit ' + $sync.Code + ': ' + $sync.Output)
    }

    # 5. Write the entry file on the PR branch (creating that branch if needed).
    if (-not $DryRun) {
        $branchRef = Invoke-Gh -Arguments @('api', ('repos/' + $ForkOwner + '/' + $ForkRepo + '/git/ref/heads/' + $Branch), '--jq', '.object.sha') -AllowFailure
        if ($branchRef.Code -ne 0) {
            $baseSha = (Invoke-Gh -Arguments @('api', ('repos/' + $ForkOwner + '/' + $ForkRepo + '/git/ref/heads/' + $defaultBranch), '--jq', '.object.sha')).Output
            Invoke-Gh -Arguments @('api', '-X', 'POST', ('repos/' + $ForkOwner + '/' + $ForkRepo + '/git/refs'), '-f', ('ref=refs/heads/' + $Branch), '-f', ('sha=' + $baseSha)) | Out-Null
            Write-Log ('branch created: ' + $Branch + ' at ' + $baseSha)
        } else {
            Write-Log ('branch exists: ' + $Branch + ' at ' + $branchRef.Output)
        }

        $content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($EntryFile))
        $existingSha = ''
        $unchanged = $false
        $lookup = Invoke-Gh -Arguments @('api', ('repos/' + $ForkOwner + '/' + $ForkRepo + '/contents/' + $EntryPath + '?ref=' + $Branch), '--jq', '.sha') -AllowFailure
        if ($lookup.Code -eq 0 -and $lookup.Output -ne '') {
            $existingSha = $lookup.Output.Trim('"')
            $remote = (Invoke-Gh -Arguments @('api', ('repos/' + $ForkOwner + '/' + $ForkRepo + '/contents/' + $EntryPath + '?ref=' + $Branch), '--jq', '.content') -AllowFailure).Output -replace '\s', ''
            if ($remote -eq $content) { $unchanged = $true }
        }

        if ($unchanged) {
            Write-Log 'entry already up to date; skipping write'
        } else {
            $payload = [ordered]@{
                message = 'Add display-api-balance'
                content = $content
                branch = $Branch
            }
            if ($existingSha -ne '') { $payload['sha'] = $existingSha }

            $payloadFile = Invoke-TempFile '.json'
            [IO.File]::WriteAllText($payloadFile, ($payload | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
            try {
                $put = Invoke-Gh -Arguments @('api', '-X', 'PUT', ('repos/' + $ForkOwner + '/' + $ForkRepo + '/contents/' + $EntryPath), '--input', $payloadFile)
                Write-Log ('entry written: ' + $put.Output)
            } finally {
                Remove-Item -LiteralPath $payloadFile -Force -ErrorAction SilentlyContinue
            }
        }
    }

    # 6. Open the pull request.
    if ($PrepareOnly) {
        Write-Log 'prepare-only: fork and entry file are ready; skipping PR creation'
        Write-Status -State 'prepared' -PrUrl '' -Message ('entry ready on ' + $Branch)
        exit 0
    }

    if ($DryRun) {
        Write-Log 'dry run: would create the PR now'
        Write-Status -State 'dry-run' -PrUrl '' -Message 'all preconditions checked'
        exit 0
    }

    $bodyTmp = Invoke-TempFile '.md'
    [IO.File]::WriteAllText($bodyTmp, [IO.File]::ReadAllText($PrBodyFile, [Text.Encoding]::UTF8), (New-Object Text.UTF8Encoding($false)))
    try {
        $pr = Invoke-Gh -Arguments @('pr', 'create', '--repo', $Upstream, '--head', ($ForkOwner + ':' + $Branch), '--base', $defaultBranch, '--title', $PrTitle, '--body-file', $bodyTmp)
    } finally {
        Remove-Item -LiteralPath $bodyTmp -Force -ErrorAction SilentlyContinue
    }
    $prUrl = $pr.Output
    Write-Log ('PR created: ' + $prUrl)
    Write-Status -State 'created' -PrUrl $prUrl -Message 'submission PR opened'
    exit 0
} catch {
    $message = $_.Exception.Message
    Write-Log ('FAILED: ' + $message)
    try { Write-Status -State 'failed' -PrUrl '' -Message $message } catch { }
    exit 1
}
