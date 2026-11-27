# Wave 1 smoke test: rejection reasons, PENDING, return to operator, confirm/reopen.
# Covers TC-10..TC-15 and the BL-R1 acceptance criteria from docs/10-backlog.md.
#
# Usage (API must be running on :4000, DB seeded):
#   powershell -ExecutionPolicy Bypass -File .\scripts\smoke-wave1.ps1
#
# The script mutates data: it takes two NEW filler requests (number > 100) and walks them
# through the transitions, so the six demo requests stay pristine for the UI demo.
# To reset: delete backend/data/cityfix.db, run `npx prisma db push` and `npx tsx prisma/seed.ts`.
# ASCII only (PowerShell 5.1 reads BOM-less files as ANSI).

$ErrorActionPreference = 'Stop'
$base = 'http://localhost:4000/api'
$script:fail = 0
$script:pass = 0

function Call($method, $path, $token, $body) {
  $headers = @{}
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  try {
    if ($null -ne $body) {
      $r = Invoke-RestMethod -Method $method -Uri ($base + $path) -Headers $headers -ContentType 'application/json' -Body $body
    } else {
      $r = Invoke-RestMethod -Method $method -Uri ($base + $path) -Headers $headers
    }
    return @{ code = 200; data = $r }
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    return @{ code = $code; data = $null }
  }
}

function Check($name, $actual, $expected) {
  if ("$actual" -eq "$expected") {
    $script:pass++
    Write-Host ("PASS {0,-42} {1}" -f $name, $actual)
  } else {
    $script:fail++
    Write-Host ("FAIL {0,-42} expected={1} actual={2}" -f $name, $expected, $actual)
  }
}

function Login($email, $password) {
  return (Call 'POST' '/auth/login' $null (@{ email = $email; password = $password } | ConvertTo-Json))
}

$ivanLogin = Login 'resident@cityfix.local' 'Resident123!'
$mariaLogin = Login 'resident2@cityfix.local' 'Resident123!'
$operator = (Login 'operator@cityfix.local' 'Operator123!').data.token
$executor = (Login 'executor@cityfix.local' 'Executor123!').data.token
$executor2 = (Login 'executor2@cityfix.local' 'Executor123!').data.token
$admin = (Login 'admin@cityfix.local' 'Admin123!').data.token

$resident = $ivanLogin.data.token
$resident2 = $mariaLogin.data.token
$ivanId = $ivanLogin.data.user.id
$mariaId = $mariaLogin.data.user.id

$tokenCount = 0
foreach ($t in @($resident, $resident2, $operator, $executor, $executor2, $admin)) { if ($t) { $tokenCount++ } }
Check 'six users can log in' $tokenCount 6

$all = (Call 'GET' '/requests?limit=100' $operator).data
Check 'request list works' ($all.total -gt 0) 'True'

$newList = (Call 'GET' '/requests?status=NEW&limit=100' $operator).data.items
# Filler requests only (number > 100) so the six demo requests stay pristine.
$fillers = @($newList | Where-Object { $_.number -gt 100 })
if ($fillers.Count -lt 2) { throw 'need at least two NEW filler requests for the test' }
$rReject = $fillers[0]
$rChain = $fillers[1]
if (-not $rReject -or -not $rChain) { throw 'no NEW filler requests for the test' }
Write-Host ("using #" + $rReject.number + " for rejection, #" + $rChain.number + " for the status chain")

# ---- TC-10: reject without a reason code ----
$t = Call 'PATCH' ("/requests/" + $rReject.id + "/status") $operator (@{ status = 'REJECTED'; comment = 'no reason' } | ConvertTo-Json)
Check 'TC-10 reject without reasonCode' $t.code 400

$t = Call 'PATCH' ("/requests/" + $rReject.id + "/status") $operator (@{ status = 'REJECTED'; reasonCode = 'OTHER' } | ConvertTo-Json)
Check 'reject OTHER without comment' $t.code 400

$t = Call 'PATCH' ("/requests/" + $rReject.id + "/status") $operator (@{ status = 'REJECTED'; reasonCode = 'BECAUSE' } | ConvertTo-Json)
Check 'reject with unknown reasonCode' $t.code 400

# ---- TC-11: reject with a valid reason ----
$t = Call 'PATCH' ("/requests/" + $rReject.id + "/status") $operator (@{ status = 'REJECTED'; reasonCode = 'INSUFFICIENT_INFO'; comment = 'Need a photo of the plate' } | ConvertTo-Json)
Check 'TC-11 reject with reason' $t.code 200
Check 'TC-11 request status' $t.data.status 'REJECTED'
Check 'TC-11 rejectReason stored' $t.data.rejectReason 'INSUFFICIENT_INFO'
$hist = $t.data.history | Select-Object -Last 1
Check 'TC-11 history reasonCode' $hist.reasonCode 'INSUFFICIENT_INFO'
Check 'TC-11 history comment kept' $hist.comment 'Need a photo of the plate'

$t = Call 'GET' ("/requests/" + $rReject.id) $resident
Check 'TC-11 author sees reason' $t.data.rejectReason 'INSUFFICIENT_INFO'
$t = Call 'GET' ("/requests/" + $rReject.id) $resident2
Check 'TC-11 non-author sees nothing' $t.code 403

# ---- TC-12: wrong role cannot reject ----
$t = Call 'PATCH' ("/requests/" + $rChain.id + "/status") $executor (@{ status = 'REJECTED'; reasonCode = 'SPAM' } | ConvertTo-Json)
Check 'TC-12 executor cannot reject' $t.code 403
$t = Call 'PATCH' ("/requests/" + $rChain.id + "/status") $resident (@{ status = 'REJECTED'; reasonCode = 'SPAM' } | ConvertTo-Json)
Check 'TC-12 resident cannot reject' $t.code 403

# ---- dispatch to the LIGHTING executor (BL-T1: one executor per service) ----
$execs = (Call 'GET' '/users/executors' $operator).data.items
Check 'five executors seeded' $execs.Count 5
$execRoads = ($execs | Where-Object { $_.service.code -eq 'ROADS' } | Select-Object -First 1)
$execLight = ($execs | Where-Object { $_.service.code -eq 'LIGHTING' } | Select-Object -First 1)
$exec1Id = $execRoads.id
$exec2Id = $execLight.id

# make sure the chain request goes to executor2 (not to executor1 by seed)
$t = Call 'PATCH' ("/requests/" + $rChain.id + "/status") $operator (@{ status = 'VERIFIED'; assigneeId = $exec2Id; comment = 'to the second service' } | ConvertTo-Json)
Check 'operator dispatches to executor2' $t.code 200
Check 'assignee is executor2' $t.data.assignee.id $exec2Id
Check 'executors differ' ($exec1Id -ne $exec2Id) 'True'

# ---- TC-15: foreign executor ----
$t = Call 'PATCH' ("/requests/" + $rChain.id + "/status") $executor (@{ status = 'IN_PROGRESS' } | ConvertTo-Json)
Check 'TC-15 foreign executor blocked' $t.code 403

# ---- take into work, then TC-13: PENDING without a comment ----
$t = Call 'PATCH' ("/requests/" + $rChain.id + "/status") $executor2 (@{ status = 'IN_PROGRESS' } | ConvertTo-Json)
Check 'executor takes the request' $t.code 200
$t = Call 'PATCH' ("/requests/" + $rChain.id + "/status") $executor2 (@{ status = 'PENDING' } | ConvertTo-Json)
Check 'TC-13 PENDING without comment' $t.code 400

$t = Call 'PATCH' ("/requests/" + $rChain.id + "/status") $executor2 (@{ status = 'PENDING'; comment = 'waiting for asphalt'; resumeDate = '2026-12-01' } | ConvertTo-Json)
Check 'PENDING with comment accepted' $t.code 200
Check 'PENDING status' $t.data.status 'PENDING'
Check 'resumeDate stored' ($t.data.resumeDate -ne $null) 'True'

# ---- TC-14: resume and complete ----
$t1 = Call 'PATCH' ("/requests/" + $rChain.id + "/status") $executor2 (@{ status = 'IN_PROGRESS'; comment = 'back to work' } | ConvertTo-Json)
Check 'PENDING -> IN_PROGRESS' $t1.code 200
Check 'status IN_PROGRESS' $t1.data.status 'IN_PROGRESS'
$t2 = Call 'PATCH' ("/requests/" + $rChain.id + "/status") $executor2 (@{ status = 'RESOLVED'; comment = 'hole filled' } | ConvertTo-Json)
Check 'IN_PROGRESS -> RESOLVED' $t2.code 200
Check 'resolvedAt set' ($t2.data.resolvedAt -ne $null) 'True'
$chain = ($t2.data.history | ForEach-Object { $_.toStatus }) -join '>'
# Filler requests are seeded in bulk without history rows, so the chain starts at the first transition.
Check 'TC-14 chain in history' $chain 'VERIFIED>IN_PROGRESS>PENDING>IN_PROGRESS>RESOLVED'
Check 'history size' $t2.data.history.Count 5
Check 'chain starts from NEW' ($t2.data.history[0].fromStatus) 'NEW'

# ---- BL-R1 in progress: RESOLVED ----
$t = Call 'POST' ("/requests/" + $rChain.id + "/confirm") $resident2 $null
Check 'non-author cannot confirm' $t.code 403
$t = Call 'POST' ("/requests/" + $rChain.id + "/reopen") $resident2 (@{ comment = 'x' } | ConvertTo-Json)
Check 'non-author cannot reopen' $t.code 403

# ---- BL-R1: confirm ----
$t = Call 'POST' ("/requests/" + $rChain.id + "/confirm") $resident $null
Check 'resident confirms result' $t.code 200
Check 'confirmedAt set' ($t.data.confirmedAt -ne $null) 'True'
$t = Call 'POST' ("/requests/" + $rChain.id + "/confirm") $resident $null
Check 'double confirm rejected' $t.code 409

# ---- BL-R1: reopen ----
$t = Call 'POST' ("/requests/" + $rChain.id + "/reopen") $resident (@{ comment = 'still broken' } | ConvertTo-Json)
Check 'resident reopens' $t.code 200
Check 'reopen status' $t.data.status 'VERIFIED'
Check 'reopenCount incremented' $t.data.reopenCount 1
Check 'resolvedAt cleared' ($t.data.resolvedAt -eq $null) 'True'
Check 'confirmedAt cleared' ($t.data.confirmedAt -eq $null) 'True'

# ---- return to the operator, then reject ----
$t = Call 'PATCH' ("/requests/" + $rChain.id + "/status") $executor2 (@{ status = 'IN_PROGRESS' } | ConvertTo-Json)
Check 'executor takes the reopened request' $t.code 200
$t = Call 'PATCH' ("/requests/" + $rChain.id + "/status") $executor2 (@{ status = 'VERIFIED'; comment = 'needs another service' } | ConvertTo-Json)
Check 'executor returns to operator' $t.code 200
Check 'status back to VERIFIED' $t.data.status 'VERIFIED'

$t = Call 'PATCH' ("/requests/" + $rChain.id + "/status") $operator (@{ status = 'REJECTED'; reasonCode = 'DUPLICATE'; comment = 'duplicate' } | ConvertTo-Json)
Check 'VERIFIED -> REJECTED allowed' $t.code 200
Check 'rejectReason DUPLICATE' $t.data.rejectReason 'DUPLICATE'

# ---- stats and seeded reason ----
$t = Call 'GET' '/admin/stats' $admin
Check 'stats include PENDING' ($t.data.byStatus.PSObject.Properties.Name -contains 'PENDING') 'True'
$pendingCount = $t.data.byStatus.PENDING
Write-Host ("PENDING in stats: " + $pendingCount)

$rej = (Call 'GET' '/requests?status=REJECTED&limit=100' $operator).data.items
$demoRejected = ($rej | Where-Object { $_.number -le 6 } | Select-Object -First 1)
if ($demoRejected) {
  $t = Call 'GET' ("/requests/" + $demoRejected.id) $operator
  Check 'seeded REJECTED has reason code' $t.data.rejectReason 'NOT_CITY_SERVICE'
}

Write-Host ""
Write-Host ("RESULT pass=" + $script:pass + " fail=" + $script:fail)
if ($script:fail -gt 0) { exit 1 }
