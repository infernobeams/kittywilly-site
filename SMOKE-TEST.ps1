# Smoke test - Insanity Dashboard
# Boots nothing. Hits a running instance and fails loudly.
#   .\SMOKE-TEST.ps1                  -> http://localhost:3000
#   .\SMOKE-TEST.ps1 -Base http://host:3000
param(
    [string]$Base = "http://localhost:3000"
)

$ErrorActionPreference = "Continue"
$fail = 0
$pass = 0

function Check([string]$path, [int[]]$expect, [string]$method = "GET", [string]$body = $null) {
    $url = "$Base$path"
    try {
        $params = @{
            Uri                = $url
            Method             = $method
            UseBasicParsing    = $true
            TimeoutSec         = 25
            MaximumRedirection = 0
        }
        if ($body) { $params.ContentType = "application/json"; $params.Body = $body }
        $r = Invoke-WebRequest @params -ErrorAction Stop
        $code = [int]$r.StatusCode
    } catch {
        $resp = $_.Exception.Response
        if ($resp) { $code = [int]$resp.StatusCode } else { $code = -1 }
    }

    if ($expect -contains $code) {
        $script:pass++
        Write-Host ("  ok   {0,-38} {1}" -f $path, $code) -ForegroundColor DarkGreen
    } else {
        $script:fail++
        Write-Host ("  FAIL {0,-38} {1} (wanted {2})" -f $path, $code, ($expect -join '/')) -ForegroundColor Red
    }
}

Write-Host "`n== public surface ==" -ForegroundColor Cyan
Check "/"                  @(200)
Check "/healthz"           @(200)
Check "/login"             @(200)
Check "/dashboard"         @(200)
Check "/favicon.ico"       @(200, 404)

Write-Host "`n== read APIs ==" -ForegroundColor Cyan
Check "/api/user"          @(200)
Check "/api/stats"         @(200)
Check "/api/signins"       @(200)
Check "/api/hits"          @(200)
Check "/api/visits"        @(200)
Check "/api/leaderboard"   @(200)
Check "/api/login-state"   @(200)
Check "/api/templates"     @(200)
Check "/api/sites"         @(200)
Check "/api/system/stats"  @(200)
Check "/api/proxy/stats"   @(200)
Check "/api/proxy/healthy" @(200)

Write-Host "`n== write APIs are gated ==" -ForegroundColor Cyan
foreach ($p in @("/api/webhook/save", "/api/generate", "/api/save-profile", "/api/webhook/test", "/api/proxy/rotate", "/api/sites/triplehook")) {
    Check $p @(401) "POST" "{}"
}

Write-Host "`n== public write surface ==" -ForegroundColor Cyan
Check "/api/capture-login" @(200) "POST" "{}"
Check "/api/auth/validate" @(400) "POST" "{}"
Check "/api/pow/solve"     @(400) "POST" "{}"

Write-Host "`n== roblox shims ==" -ForegroundColor Cyan
Check "/rblx-users/v1/users/1" @(200)
Check "/rblx-friends/v1/users/1/followers/count" @(200)

Write-Host "`n== 404 shape ==" -ForegroundColor Cyan
Check "/nope-page"         @(404)
Check "/api/does-not-exist" @(404)

Write-Host "`n== headers ==" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest -Uri $Base -UseBasicParsing -TimeoutSec 15
    $want = @{
        "X-Content-Type-Options" = "nosniff"
        "X-Frame-Options"        = "SAMEORIGIN"
    }
    foreach ($k in $want.Keys) {
        $got = ($r.Headers[$k] -join ",")
        if ($got -eq $want[$k]) { $script:pass++; Write-Host ("  ok   {0,-38} {1}" -f $k, $got) -ForegroundColor DarkGreen }
        else { $script:fail++; Write-Host ("  FAIL {0,-38} '{1}' (wanted '{2}')" -f $k, $got, $want[$k]) -ForegroundColor Red }
    }
    if (($r.Headers["X-Powered-By"] -join "") -eq "") { $script:pass++; Write-Host "  ok   x-powered-by not disclosed" -ForegroundColor DarkGreen }
    else { $script:fail++; Write-Host "  FAIL x-powered-by still disclosed" -ForegroundColor Red }
} catch {
    $script:fail++
    Write-Host "  FAIL could not read headers" -ForegroundColor Red
}

Write-Host ""
if ($fail -eq 0) {
    Write-Host "PASS - $pass checks clean" -ForegroundColor Green
    exit 0
} else {
    Write-Host "FAIL - $fail failed, $pass passed" -ForegroundColor Red
    exit 1
}

