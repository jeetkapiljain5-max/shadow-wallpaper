# Shadow: your YouTube Music library for the Launchpad search (your playlists, the songs in them, and your likes).
#   google.ps1 -SignIn   opens Google's own sign-in page in your browser; you approve read-only YouTube access there.
#   google.ps1 -Sync     refreshes the library (the helper runs this every few hours).
# Needs google-client.json (your own OAuth "Desktop app" client from console.cloud.google.com) next to this script.
# Your sign-in is kept only on this PC, in google-token.dat, encrypted with your Windows account (DPAPI).
param([switch]$SignIn, [switch]$Sync)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$here = $PSScriptRoot
$clientFile = Join-Path $here 'google-client.json'
$tokenFile = Join-Path $here 'google-token.dat'
$libFile = Join-Path $here 'google-library.json'
$stateFile = Join-Path $here 'google-state.json'
$scope = 'https://www.googleapis.com/auth/youtube.readonly'
Add-Type -AssemblyName System.Security
function Say([string]$state, [string]$msg) { ([ordered]@{ state = $state; msg = $msg; at = [DateTimeOffset]::Now.ToUnixTimeMilliseconds() } | ConvertTo-Json -Compress) | Set-Content $stateFile -Encoding UTF8 }

$mutex = New-Object System.Threading.Mutex($false, 'ShadowGoogle'); if (-not $mutex.WaitOne(0)) { exit }
try {
    if (-not (Test-Path $clientFile)) { Say 'noclient' 'google-client.json is missing'; exit }
    $c = Get-Content $clientFile -Raw | ConvertFrom-Json; $c = if ($c.installed) { $c.installed } else { $c.web }
    if (-not $c.client_id -or -not $c.client_secret) { Say 'noclient' 'google-client.json has no client_id / client_secret'; exit }

    function Save-Token($t) { $b = [Text.Encoding]::UTF8.GetBytes(($t | ConvertTo-Json -Compress)); [IO.File]::WriteAllBytes($tokenFile, [Security.Cryptography.ProtectedData]::Protect($b, $null, 'CurrentUser')) }
    function Load-Token { if (-not (Test-Path $tokenFile)) { return $null }; try { [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($tokenFile), $null, 'CurrentUser')) | ConvertFrom-Json } catch { $null } }
    function B64Url([byte[]]$b) { [Convert]::ToBase64String($b).TrimEnd('=').Replace('+', '-').Replace('/', '_') }

    if ($SignIn) {
        # Google's loopback sign-in for desktop apps, with PKCE: the code comes back to this PC only
        Say 'signing' 'Waiting for you to approve in the browser'
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        $vb = New-Object byte[] 48; $rng.GetBytes($vb); $verifier = B64Url $vb
        $challenge = B64Url ([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::ASCII.GetBytes($verifier)))
        $sb = New-Object byte[] 16; $rng.GetBytes($sb); $state = B64Url $sb
        $redirect = 'http://localhost:47615/'
        $l = New-Object System.Net.HttpListener; $l.Prefixes.Add($redirect); $l.Start()
        $url = 'https://accounts.google.com/o/oauth2/v2/auth?' + (((@{
            client_id = $c.client_id; redirect_uri = $redirect; response_type = 'code'; scope = $scope; access_type = 'offline'; prompt = 'consent'
            code_challenge = $challenge; code_challenge_method = 'S256'; state = $state }).GetEnumerator() | ForEach-Object { $_.Key + '=' + [uri]::EscapeDataString([string]$_.Value) }) -join '&')
        Start-Process $url
        $task = $l.GetContextAsync(); if (-not $task.Wait([TimeSpan]::FromMinutes(5))) { $l.Stop(); Say 'error' 'Sign-in timed out'; exit }
        $ctx = $task.Result; $q = $ctx.Request.QueryString
        $ok = $q['state'] -eq $state -and $q['code']
        $page = if ($ok) { 'Signed in. You can close this tab - your YouTube Music library is loading into Shadow.' } else { 'Sign-in did not finish (' + [Net.WebUtility]::HtmlEncode([string]$q['error']) + '). You can close this tab and try again.' }
        $html = [Text.Encoding]::UTF8.GetBytes("<!doctype html><meta charset=utf-8><title>Shadow</title><body style='font:16px system-ui;background:#111;color:#eee;display:grid;place-items:center;height:90vh'><p>$page</p>")
        $ctx.Response.ContentType = 'text/html; charset=utf-8'; $ctx.Response.OutputStream.Write($html, 0, $html.Length); $ctx.Response.Close(); $l.Stop()
        if (-not $ok) { Say 'error' ('Sign-in cancelled: ' + [string]$q['error']); exit }
        $t = Invoke-RestMethod 'https://oauth2.googleapis.com/token' -Method Post -Body @{
            code = $q['code']; client_id = $c.client_id; client_secret = $c.client_secret; redirect_uri = $redirect; grant_type = 'authorization_code'; code_verifier = $verifier }
        if (-not $t.refresh_token) { Say 'error' 'Google did not return a refresh token'; exit }
        Save-Token @{ refresh_token = $t.refresh_token; access_token = $t.access_token; expires = [DateTimeOffset]::Now.ToUnixTimeSeconds() + [int]$t.expires_in - 60 }
        $Sync = $true
    }

    if ($Sync) {
        $tok = Load-Token; if (-not $tok) { Say 'signedout' 'Not signed in'; exit }
        if ([DateTimeOffset]::Now.ToUnixTimeSeconds() -ge [long]$tok.expires) {
            try {
                $t = Invoke-RestMethod 'https://oauth2.googleapis.com/token' -Method Post -Body @{ refresh_token = $tok.refresh_token; client_id = $c.client_id; client_secret = $c.client_secret; grant_type = 'refresh_token' }
            } catch {
                Remove-Item $tokenFile -ErrorAction SilentlyContinue; Say 'expired' 'Google asked you to sign in again'; exit      # testing-mode apps expire after a week
            }
            $tok = @{ refresh_token = $tok.refresh_token; access_token = $t.access_token; expires = [DateTimeOffset]::Now.ToUnixTimeSeconds() + [int]$t.expires_in - 60 }; Save-Token $tok
        }
        Say 'syncing' 'Loading your library'
        $h = @{ Authorization = 'Bearer ' + $tok.access_token }
        function Pages([string]$url, [int]$max) {
            $out = New-Object System.Collections.ArrayList; $next = $null
            do {
                $u = $url + $(if ($next) { "&pageToken=$next" } else { '' })
                $r = Invoke-RestMethod $u -Headers $h; foreach ($i in $r.items) { [void]$out.Add($i) }; $next = $r.nextPageToken
            } while ($next -and $out.Count -lt $max)
            return $out
        }
        $img = { param($s) if ($s.thumbnails.medium) { $s.thumbnails.medium.url } elseif ($s.thumbnails.default) { $s.thumbnails.default.url } else { '' } }
        $artist = { param([string]$a) ($a -replace '\s*-\s*Topic$', '' -replace 'VEVO$', '').Trim() }
        $api = 'https://www.googleapis.com/youtube/v3'
        $pls = Pages "$api/playlists?part=snippet,contentDetails&mine=true&maxResults=50" 500
        $playlists = @(); $songs = New-Object System.Collections.ArrayList
        foreach ($p in $pls) {
            $playlists += [ordered]@{ id = $p.id; t = $p.snippet.title; n = [int]$p.contentDetails.itemCount; img = (& $img $p.snippet) }
            if ($songs.Count -lt 4000) {
                foreach ($it in (Pages "$api/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=$($p.id)" 400)) {
                    if ($it.snippet.title -in 'Deleted video', 'Private video') { continue }
                    [void]$songs.Add([ordered]@{ v = $it.contentDetails.videoId; t = $it.snippet.title; a = (& $artist $it.snippet.videoOwnerChannelTitle); img = (& $img $it.snippet); pl = $p.snippet.title; list = $p.id })
                }
            }
        }
        $liked = @(Pages "$api/videos?part=snippet&myRating=like&maxResults=50" 1000 | ForEach-Object {
            [ordered]@{ v = $_.id; t = $_.snippet.title; a = (& $artist $_.snippet.channelTitle); img = (& $img $_.snippet); music = ($_.snippet.categoryId -eq '10') } })
        $lib = [ordered]@{ at = [DateTimeOffset]::Now.ToUnixTimeMilliseconds(); playlists = $playlists; songs = @($songs); liked = $liked }
        ($lib | ConvertTo-Json -Depth 5 -Compress) | Set-Content $libFile -Encoding UTF8
        Say 'ok' ("$($playlists.Count) playlists, $($songs.Count) playlist songs, $($liked.Count) likes")
    }
} catch {
    Say 'error' $_.Exception.Message
} finally { $mutex.ReleaseMutex() }
