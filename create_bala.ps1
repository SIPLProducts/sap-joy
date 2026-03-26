$SUPABASE_URL = "http://10.10.4.178:8000"
$SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzM5ODk0MjMsImV4cCI6MTkzMTY2OTQyM30.mjeZP8eVX1rd-cV7s1Ox5Gtjcfc0pBW9ItmUqOIZ5WA"

$headers = @{
    "Authorization" = "Bearer $SERVICE_KEY"
    "apikey" = $SERVICE_KEY
    "Content-Type" = "application/json"
}

Write-Host "Fetching users..."

$response = Invoke-RestMethod -Uri "$SUPABASE_URL/auth/v1/admin/users" -Method GET -Headers $headers
$users = $response.users

$balaUser = $users | Where-Object { $_.email -eq "bala@sharviinfotech.com" }

if ($balaUser) {
    Write-Host "Found bala@sharviinfotech.com (ID: $($balaUser.id)) - deleting and rebuilding..." -ForegroundColor Yellow
    Invoke-RestMethod -Uri "$SUPABASE_URL/auth/v1/admin/users/$($balaUser.id)" -Method DELETE -Headers $headers
}

$body = '{
  "email": "bala@sharviinfotech.com",
  "password": "123456",
  "email_confirm": true,
  "user_metadata": {
    "full_name": "Bala System Admin",
    "role": "admin",
    "plant": "1300"
  }
}'

try {
    $creation = Invoke-RestMethod -Uri "$SUPABASE_URL/auth/v1/admin/users" -Method POST -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "✅ SUCCESS! User created properly with password 123456." -ForegroundColor Green
} catch {
    Write-Host "❌ FAILED: $($_.ErrorDetails.Message)" -ForegroundColor Red
}
