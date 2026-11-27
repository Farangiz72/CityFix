# CityFix - BL-T1 admin smoke run (TC-23..TC-27, TC-34).
# ASCII only: Windows PowerShell 5.1 reads this file as ANSI.
# Precondition: freshly seeded DB and the API on :4000.
# The script creates two temporary users and blocks them at the end;
# run it on a demo stand and reseed afterwards if the users must not stay.
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:4000/api'
$script:pass = 0
$script:fail = 0

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
    Write-Host ("PASS  {0,-46} {1}" -f $name, $actual)
  } else {
    $script:fail++
    Write-Host ("FAIL  {0,-46} expected {1}, got {2}" -f $name, $expected, $actual)
  }
}

function Login($email, $password) {
  return (Call 'POST' '/auth/login' $null (@{ email = $email; password = $password } | ConvertTo-Json))
}

$stamp = (Get-Date -Format 'HHmmss')
$adminEmail = "smoke.operator.$stamp@cityfix.local"
$execEmail = "smoke.executor.$stamp@cityfix.local"
$password = 'Smoke12345!'

Write-Host '--- logins ---'
$admin = (Login 'admin@cityfix.local' 'Admin123!').data.token
$operator = (Login 'operator@cityfix.local' 'Operator123!').data.token
$resident = (Login 'resident@cityfix.local' 'Resident123!').data.token
$executor = (Login 'executor@cityfix.local' 'Executor123!').data.token
Check 'admin token' ([bool]$admin) 'True'
Check 'operator token' ([bool]$operator) 'True'
Check 'resident token' ([bool]$resident) 'True'

Write-Host '--- TC-23: users ---'
$users = Call 'GET' '/admin/users?limit=50' $admin
Check 'TC-23 users list' $users.code 200
Check 'TC-23 seeded users' ([int]$users.data.total -ge 9) 'True'
$new = Call 'POST' '/admin/users' $admin (@{ email = $adminEmail; fullName = 'Smoke Operator'; role = 'OPERATOR'; password = $password } | ConvertTo-Json)
Check 'TC-23 create operator' $new.code 200
Check 'TC-23 operator is active' $new.data.isActive 'True'
$operatorId = $new.data.id
Check 'TC-23 operator login' ((Login $adminEmail $password).code) 200
$noService = Call 'POST' '/admin/users' $admin (@{ email = $execEmail; fullName = 'Smoke Executor'; role = 'EXECUTOR'; password = $password } | ConvertTo-Json)
Check 'TC-23 executor without service' $noService.code 400
$services = (Call 'GET' '/admin/services' $admin).data.items
$roadsService = ($services | Where-Object { $_.code -eq 'ROADS' } | Select-Object -First 1)
$exec = Call 'POST' '/admin/users' $admin (@{ email = $execEmail; fullName = 'Smoke Executor'; role = 'EXECUTOR'; password = $password; serviceId = $roadsService.id } | ConvertTo-Json)
Check 'TC-23 executor with service' $exec.code 200
Check 'TC-23 executor service code' $exec.data.service.code 'ROADS'
$execId = $exec.data.id
Check 'TC-23 duplicate email' ((Call 'POST' '/admin/users' $admin (@{ email = $adminEmail; fullName = 'Smoke Operator'; role = 'OPERATOR'; password = $password } | ConvertTo-Json)).code) 409
Check 'TC-23 resident cannot create' ((Call 'POST' '/admin/users' $resident (@{ email = "x.$stamp@cityfix.local"; fullName = 'X User'; role = 'OPERATOR'; password = $password } | ConvertTo-Json)).code) 403
$search = Call 'GET' ("/admin/users?search=" + $adminEmail + "&role=OPERATOR") $admin
Check 'TC-23 search + role filter' $search.data.total 1

Write-Host '--- TC-24: block / unblock ---'
$probeToken = (Login $adminEmail $password).data.token
Check 'TC-24 block user' ((Call 'PATCH' ("/admin/users/" + $operatorId) $admin (@{ isActive = $false } | ConvertTo-Json)).code) 200
Check 'TC-24 blocked login 403' ((Login $adminEmail $password).code) 403
Check 'TC-24 blocked token 401' ((Call 'GET' '/requests?limit=1' $probeToken).code) 401
Check 'TC-24 unblock user' ((Call 'PATCH' ("/admin/users/" + $operatorId) $admin (@{ isActive = $true } | ConvertTo-Json)).code) 200
Check 'TC-24 unblocked login' ((Login $adminEmail $password).code) 200

Write-Host '--- TC-25: self protection ---'
$me = (Call 'GET' '/auth/me' $admin).data.user
Check 'TC-25 self role change' ((Call 'PATCH' ("/admin/users/" + $me.id) $admin (@{ role = 'OPERATOR' } | ConvertTo-Json)).code) 409
Check 'TC-25 self block' ((Call 'PATCH' ("/admin/users/" + $me.id) $admin (@{ isActive = $false } | ConvertTo-Json)).code) 409
Check 'TC-25 unknown user' ((Call 'PATCH' '/admin/users/nope' $admin (@{ isActive = $false } | ConvertTo-Json)).code) 404

Write-Host '--- TC-26: categories ---'
$cats = (Call 'GET' '/admin/categories' $admin).data.items
Check 'TC-26 categories' ([int]$cats.Count -ge 5) 'True'
$otherCat = ($cats | Where-Object { $_.code -eq 'OTHER' } | Select-Object -First 1)
$off = Call 'PATCH' ("/admin/categories/" + $otherCat.id) $admin (@{ isActive = $false; name = 'Other' } | ConvertTo-Json)
Check 'TC-26 disable category' $off.code 200
Check 'TC-26 disabled flag' $off.data.isActive 'False'
$active = (Call 'GET' '/categories' $resident).data.items
Check 'TC-26 resident list hides it' (@($active | Where-Object { $_.code -eq 'OTHER' }).Count) 0
$oldOther = (Call 'GET' '/requests?category=OTHER&limit=1' $admin).data
Check 'TC-26 history still counted' ([int]$oldOther.total -gt 0) 'True'
$oldOtherId = $oldOther.items[0].id
Check 'TC-26 old request opens' ((Call 'GET' ('/requests/' + $oldOtherId) $admin).code) 200
Check 'TC-26 enable category' ((Call 'PATCH' ("/admin/categories/" + $otherCat.id) $admin (@{ isActive = $true } | ConvertTo-Json)).code) 200
Check 'TC-26 category code guard' ((Call 'POST' '/admin/categories' $admin (@{ code = 'bad code'; name = 'Bad'; slaHours = 24 } | ConvertTo-Json)).code) 400
Check 'TC-26 duplicate category' ((Call 'POST' '/admin/categories' $admin (@{ code = 'ROADS'; name = 'Roads'; slaHours = 24 } | ConvertTo-Json)).code) 409
$newCat = Call 'POST' '/admin/categories' $admin (@{ code = "SMOKE$stamp"; name = 'Smoke category'; slaHours = 48 } | ConvertTo-Json)
Check 'TC-26 create category' $newCat.code 200
Check 'TC-26 new category sla' $newCat.data.slaHours 48

Write-Host '--- TC-27: role guard ---'
Check 'TC-27 operator users 403' ((Call 'GET' '/admin/users' $operator).code) 403
Check 'TC-27 resident services 403' ((Call 'GET' '/admin/services' $resident).code) 403
Check 'TC-27 executor categories 403' ((Call 'GET' '/admin/categories' $executor).code) 403
Check 'TC-27 resident audit 403' ((Call 'GET' '/admin/audit' $resident).code) 403
Check 'TC-27 operator stats 200' ((Call 'GET' '/admin/stats' $operator).code) 200

Write-Host '--- statistics ---'
$stats = (Call 'GET' '/admin/stats' $admin).data
Check 'stats total' ([int]$stats.total -gt 1000) 'True'
Check 'stats byStatus sum' ((($stats.byStatus.PSObject.Properties | ForEach-Object { $_.Value }) | Measure-Object -Sum).Sum) $stats.total
Check 'stats byCategory rows' ([int]$stats.byCategory.Count -ge 5) 'True'
Check 'stats byService rows' $stats.byService.Count 5
Check 'stats rejected' ($stats.rejected -eq $stats.byStatus.REJECTED) 'True'
Check 'stats avg hours' ($stats.avgResolutionHours -gt 0) 'True'
Check 'stats unassigned' ($stats.unassigned -ge 0) 'True'

Write-Host '--- filters and export ---'
$today = (Get-Date -Format 'yyyy-MM-dd')
$byDate = Call 'GET' ("/requests?dateFrom=" + $today + "&dateTo=" + $today + "&limit=1") $admin
Check 'filter date today' $byDate.code 200
$byCategory = (Call 'GET' '/requests?category=ROADS&limit=1' $admin).data
$byService = (Call 'GET' ("/requests?serviceId=" + $roadsService.id + "&limit=1") $admin).data
$roadsStat = ($stats.byService | Where-Object { $_.code -eq 'ROADS' } | Select-Object -First 1)
Check 'filter service matches stats' $byService.total $roadsStat.count
Check 'service filter within category' ([int]$byService.total -le [int]$byCategory.total) 'True'
$csv = Invoke-WebRequest -Uri ($base + '/admin/export/requests.csv?status=REJECTED') -Headers @{ Authorization = "Bearer $admin" } -UseBasicParsing
Check 'CSV status' $csv.StatusCode 200
Check 'CSV content type' ($csv.Headers['Content-Type'] -like 'text/csv*') 'True'
Check 'CSV length' ([int]$csv.Content.Length -gt 1000) 'True'
Check 'CSV separator' ([bool]($csv.Content -split "`r`n")[0].Contains(';')) 'True'
Check 'CSV rows header' ([int]$csv.Headers['X-Total-Count'] -gt 0) 'True'
Check 'CSV operator 403' ((Call 'GET' '/admin/export/requests.csv' $operator).code) 403

Write-Host '--- TC-34: audit ---'
$audit = Call 'GET' '/admin/audit?limit=50' $admin
Check 'TC-34 audit list' $audit.code 200
Check 'TC-34 audit has entries' ([int]$audit.data.total -gt 2) 'True'
$actions = ($audit.data.items | ForEach-Object { $_.action }) -join ','
Check 'TC-34 block recorded' ([bool]($actions -match 'USER_BLOCKED')) 'True'
Check 'TC-34 export recorded' ([bool]($actions -match 'REQUESTS_EXPORTED')) 'True'
Check 'TC-34 audit actor role' $audit.data.items[0].actor.role 'ADMIN'
$auditId = $audit.data.items[0].id
Check 'TC-34 audit PATCH blocked' ((Call 'PATCH' ("/admin/audit/" + $auditId) $admin (@{ summary = 'x' } | ConvertTo-Json)).code) 404
Check 'TC-34 audit DELETE blocked' ((Call 'DELETE' ("/admin/audit/" + $auditId) $admin $null).code) 404
$auditUser = Call 'GET' '/admin/audit?objectType=USER&limit=5' $admin
Check 'TC-34 audit filter' (@($auditUser.data.items | Where-Object { $_.objectType -ne 'USER' }).Count) 0

Write-Host '--- reassign category ---'
$newList = (Call 'GET' '/requests?status=NEW&limit=100' $admin).data.items
$filler = ($newList | Where-Object { $_.number -gt 100 } | Select-Object -First 1)
$change = Call 'PATCH' ("/admin/requests/" + $filler.id + "/category") $admin (@{ category = 'LIGHTING' } | ConvertTo-Json)
Check 'reassign on NEW' $change.code 200
Check 'reassign category value' $change.data.category 'LIGHTING'
Check 'reassign same again' ((Call 'PATCH' ("/admin/requests/" + $filler.id + "/category") $admin (@{ category = 'LIGHTING' } | ConvertTo-Json)).code) 400
Check 'reassign unknown' ((Call 'PATCH' ("/admin/requests/" + $filler.id + "/category") $admin (@{ category = 'NOWHERE' } | ConvertTo-Json)).code) 400
Check 'reassign by operator' ((Call 'PATCH' ("/admin/requests/" + $filler.id + "/category") $operator (@{ category = 'ROADS' } | ConvertTo-Json)).code) 403
Check 'reassign back' ((Call 'PATCH' ("/admin/requests/" + $filler.id + "/category") $admin (@{ category = 'ROADS' } | ConvertTo-Json)).code) 200

Write-Host '--- reset password ---'
$reset = Call 'POST' ("/admin/users/" + $operatorId + "/reset-password") $admin $null
Check 'reset password' $reset.code 200
Check 'reset password length' $reset.data.password.Length 15
Check 'login with new password' ((Login $adminEmail $reset.data.password).code) 200
Check 'reset unknown user' ((Call 'POST' '/admin/users/nope/reset-password' $admin $null).code) 404

Write-Host '--- cleanup ---'
Check 'cleanup operator' ((Call 'PATCH' ("/admin/users/" + $operatorId) $admin (@{ isActive = $false } | ConvertTo-Json)).code) 200
Check 'cleanup executor' ((Call 'PATCH' ("/admin/users/" + $execId) $admin (@{ isActive = $false } | ConvertTo-Json)).code) 200

Write-Host ''
Write-Host ("RESULT: pass={0} fail={1}" -f $script:pass, $script:fail)
if ($script:fail -gt 0) { exit 1 }
