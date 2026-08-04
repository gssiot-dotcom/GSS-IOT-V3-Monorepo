[CmdletBinding()]
param(
  [string]$Repository = "gssiot-dotcom/GSS-IOT-V3-Monorepo",
  [ValidateSet("production", "staging")]
  [string]$Environment = "production",
  [string]$EnvFile,
  [string]$SshPrivateKeyPath = "C:\Users\stran\.ssh\gss-iot-prod-key-v3.2026.08.04.pem",
  [string]$KnownHostsPath = "C:\Users\stran\.ssh\known_hosts",
  [switch]$Apply
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
  $EnvFile = Join-Path $PSScriptRoot "..\..\apps\api\.env"
}

function Get-GhPath {
  $command = Get-Command gh -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $installedPath = "C:\Program Files\GitHub CLI\gh.exe"
  if (Test-Path -LiteralPath $installedPath) {
    return $installedPath
  }

  throw "GitHub CLI (gh) is not installed."
}

function Read-DotEnv([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Environment file was not found: $Path"
  }

  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
      continue
    }

    $key = $matches[1]
    $value = $matches[2].Trim()
    if (
      $value.Length -ge 2 -and
      (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'")))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $values[$key] = $value
  }

  return $values
}

function Get-RequiredValue([hashtable]$Values, [string]$Name) {
  $value = $Values[$Name]
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Required local value is missing: $Name"
  }
  return $value
}

function Invoke-Gh([string[]]$Arguments) {
  & $script:GhPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "GitHub CLI command failed: gh $($Arguments[0])"
  }
}

function Set-EnvironmentSecret([string]$Name, [string]$Value) {
  & $script:GhPath secret set $Name --env $Environment --repo $Repository --body $Value
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to set GitHub Environment secret: $Name"
  }
  Write-Host "secret: $Name"
}

function Set-EnvironmentVariable([string]$Name, [string]$Value) {
  & $script:GhPath variable set $Name --env $Environment --repo $Repository --body $Value
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to set GitHub Environment variable: $Name"
  }
  Write-Host "variable: $Name"
}

$script:GhPath = Get-GhPath
$envValues = Read-DotEnv (Resolve-Path -LiteralPath $EnvFile)

& $script:GhPath auth status --hostname github.com
if ($LASTEXITCODE -ne 0) {
  throw "GitHub CLI is not authenticated in this PowerShell session."
}

$permission = (& $script:GhPath repo view $Repository --json viewerPermission --jq .viewerPermission).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "Unable to read repository permission for $Repository."
}
if ($permission -ne "ADMIN") {
  throw "Repository ADMIN permission is required to manage Environment secrets; current permission: $permission"
}

foreach ($name in @(
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "GSS_SUPER_ADMIN_PASSWORD",
  "MQTT_USERNAME",
  "MQTT_PASSWORD",
  "ASSET_S3_ACCESS_KEY_ID",
  "ASSET_S3_SECRET_ACCESS_KEY",
  "REPORT_S3_ACCESS_KEY_ID",
  "REPORT_S3_SECRET_ACCESS_KEY",
  "DOCKERHUB_PUSH_TOKEN",
  "DOCKERHUB_READ_TOKEN"
)) {
  [void](Get-RequiredValue $envValues $name)
}

if ((Get-RequiredValue $envValues "JWT_ACCESS_SECRET").Length -lt 32) {
  throw "JWT_ACCESS_SECRET must contain at least 32 characters."
}
if ((Get-RequiredValue $envValues "JWT_REFRESH_SECRET").Length -lt 32) {
  throw "JWT_REFRESH_SECRET must contain at least 32 characters."
}
if ($envValues["JWT_ACCESS_SECRET"] -eq $envValues["JWT_REFRESH_SECRET"]) {
  throw "JWT access and refresh secrets must be different."
}

if (-not (Test-Path -LiteralPath $SshPrivateKeyPath)) {
  throw "App EC2 SSH private key was not found: $SshPrivateKeyPath"
}
if (-not (Test-Path -LiteralPath $KnownHostsPath)) {
  throw "SSH known_hosts file was not found: $KnownHostsPath"
}

$appHost = "13.209.142.179"
$knownHostLines = @(
  ssh-keygen -F $appHost -f $KnownHostsPath |
    Where-Object { $_ -and -not $_.StartsWith("#") }
)
if ($knownHostLines.Count -eq 0) {
  throw "The verified App EC2 host is missing from known_hosts: $appHost"
}

$knownHostsValue = $knownHostLines -join "`n"
$fingerprintOutput = ($knownHostsValue | ssh-keygen -lf - -E sha256) -join "`n"
$expectedFingerprint = "SHA256:VL2qmP0xYD3FyZOYLRXf8Go2Ehp7xqefifHUvIfSBdg"
if ($fingerprintOutput -notmatch [regex]::Escape($expectedFingerprint)) {
  throw "The App EC2 ED25519 fingerprint does not match the manually verified fingerprint."
}

$variables = [ordered]@{
  PORT                              = "3000"
  CORS_ALLOWED_ORIGINS              = "https://infogssiot.com"
  AUTH_COOKIE_SECURE                = "true"
  AUTH_COOKIE_SAME_SITE             = "lax"
  AUTH_ACCESS_COOKIE_NAME           = "gss_access"
  AUTH_REFRESH_COOKIE_NAME          = "gss_refresh"
  AUTH_CSRF_COOKIE_NAME             = "gss_csrf"
  JWT_ACCESS_EXPIRES_IN             = "900"
  JWT_REFRESH_EXPIRES_IN            = "2592000"
  GSS_SUPER_ADMIN_EMAIL             = (Get-RequiredValue $envValues "GSS_SUPER_ADMIN_EMAIL")
  MQTT_BROKER_URL                   = "mqtt://gssiot.iptime.org:10200"
  MQTT_CLIENT_ID                    = "gss-iot-v3-production-api"
  MQTT_TOPIC_BASE                   = (Get-RequiredValue $envValues "MQTT_TOPIC_BASE")
  MQTT_ENABLED                      = "true"
  MQTT_FAKE_ACK                     = "false"
  MQTT_COMMAND_ACK_TIMEOUT_MS       = "30000"
  MQTT_COMMAND_EXPIRES_IN_SECONDS   = "300"
  MQTT_MAX_PUBLISH_ATTEMPTS         = "3"
  MQTT_PUBLISH_TIMEOUT_MS           = "5000"
  ASSET_STORAGE_PROVIDER            = "s3"
  ASSET_S3_ENDPOINT                 = "https://s3.ap-northeast-2.amazonaws.com"
  ASSET_S3_REGION                   = "ap-northeast-2"
  ASSET_S3_BUCKET                   = "gss-iot-v3-prod-assets-796973490873"
  ASSET_S3_FORCE_PATH_STYLE         = "false"
  REPORT_STORAGE_PROVIDER           = "s3"
  REPORT_S3_ENDPOINT                = "https://s3.ap-northeast-2.amazonaws.com"
  REPORT_S3_REGION                  = "ap-northeast-2"
  REPORT_S3_BUCKET                  = "gss-iot-v3-prod-reports-796973490873"
  REPORT_S3_FORCE_PATH_STYLE        = "false"
  REPORT_WORKER_ENABLED             = "true"
  REPORT_WORKER_INTERVAL_MS         = "30000"
  REPORT_WORKER_BATCH_SIZE          = "10"
  REPORT_CLEANUP_ENABLED            = "true"
  REPORT_CLEANUP_INTERVAL_MS        = "300000"
  REPORT_CLEANUP_BATCH_SIZE         = "100"
  NODE_OFFLINE_EVALUATOR_ENABLED    = "true"
  NODE_OFFLINE_SWEEP_INTERVAL_MS    = "10000"
  NODE_OFFLINE_BATCH_SIZE           = "250"
  DELETION_WORKER_ENABLED           = "false"
  DELETION_WORKER_INTERVAL_MS       = "5000"
  DELETION_WORKER_BATCH_SIZE        = "250"
  DELETION_WORKER_HEARTBEAT_MS      = "5000"
  DELETION_WORKER_LEASE_MS          = "30000"
  SENSOR_RETENTION_ENABLED          = "false"
  SENSOR_RETENTION_DRY_RUN          = "true"
  SENSOR_RETENTION_DAYS             = "180"
  SENSOR_RETENTION_INTERVAL_MS      = "3600000"
  SENSOR_RETENTION_BATCH_SIZE       = "1000"
  SENSOR_RETENTION_MAX_ROWS_PER_CYCLE = "10000"
  VITE_API_BASE_URL                 = "https://apiv3.infogssiot.com"
  VITE_AUTH_CSRF_COOKIE_NAME        = "gss_csrf"
  WEB_SMOKE_URL                     = "https://infogssiot.com"
  APP_EC2_HOST                      = $appHost
  APP_EC2_USER                      = "ubuntu"
  APP_EC2_SSH_PORT                  = "22"
  DOCKERHUB_USERNAME                = "gssiot2026"
}

if (-not $Apply) {
  Write-Host "Validation passed for $Repository ($permission)."
  Write-Host "Ready to create/update Environment '$Environment' with 14 secrets and $($variables.Count) variables."
  Write-Host "Re-run with -Apply to perform the GitHub writes."
  exit 0
}

$secureDbPassword = Read-Host "Enter the PostgreSQL gss_app production password" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureDbPassword)
try {
  $plainDbPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  if ([string]::IsNullOrWhiteSpace($plainDbPassword)) {
    throw "The production database password cannot be empty."
  }
  $encodedDbPassword = [Uri]::EscapeDataString($plainDbPassword)
  $databaseUrl = "postgresql://gss_app:${encodedDbPassword}@172.31.37.205:5432/gss_iot_v3?sslmode=require"
}
finally {
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
  $plainDbPassword = $null
}

Invoke-Gh @("api", "--method", "PUT", "repos/$Repository/environments/$Environment", "--silent")

$secrets = [ordered]@{
  DATABASE_URL                  = $databaseUrl
  JWT_ACCESS_SECRET             = $envValues["JWT_ACCESS_SECRET"]
  JWT_REFRESH_SECRET            = $envValues["JWT_REFRESH_SECRET"]
  GSS_SUPER_ADMIN_PASSWORD      = $envValues["GSS_SUPER_ADMIN_PASSWORD"]
  MQTT_USERNAME                 = $envValues["MQTT_USERNAME"]
  MQTT_PASSWORD                 = $envValues["MQTT_PASSWORD"]
  ASSET_S3_ACCESS_KEY_ID        = $envValues["ASSET_S3_ACCESS_KEY_ID"]
  ASSET_S3_SECRET_ACCESS_KEY    = $envValues["ASSET_S3_SECRET_ACCESS_KEY"]
  REPORT_S3_ACCESS_KEY_ID       = $envValues["REPORT_S3_ACCESS_KEY_ID"]
  REPORT_S3_SECRET_ACCESS_KEY   = $envValues["REPORT_S3_SECRET_ACCESS_KEY"]
  APP_EC2_SSH_PRIVATE_KEY       = Get-Content -Raw -LiteralPath $SshPrivateKeyPath
  APP_EC2_SSH_KNOWN_HOSTS       = $knownHostsValue
  DOCKERHUB_PUSH_TOKEN          = $envValues["DOCKERHUB_PUSH_TOKEN"]
  DOCKERHUB_READ_TOKEN          = $envValues["DOCKERHUB_READ_TOKEN"]
}

foreach ($entry in $secrets.GetEnumerator()) {
  Set-EnvironmentSecret $entry.Key $entry.Value
}
foreach ($entry in $variables.GetEnumerator()) {
  Set-EnvironmentVariable $entry.Key $entry.Value
}

$databaseUrl = $null
$encodedDbPassword = $null
$secrets.Clear()

Write-Host "GitHub Environment '$Environment' configured successfully."
