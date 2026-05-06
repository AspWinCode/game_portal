param(
  [string]$DatabaseName = "game_game",
  [string]$DatabaseUser = "postgres",
  [string]$DatabaseHost = "localhost"
)

$ErrorActionPreference = "Stop"

Write-Host "Checking database '$DatabaseName'..."
$exists = psql -h $DatabaseHost -U $DatabaseUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName'"

if (-not $exists) {
  Write-Host "Creating database '$DatabaseName'..."
  createdb -h $DatabaseHost -U $DatabaseUser $DatabaseName
}

Write-Host "Generating Prisma client..."
npm --workspace @game-game/api run prisma:generate

Write-Host "Applying Prisma migrations..."
Push-Location "apps/api"
try {
  npx prisma migrate deploy
} finally {
  Pop-Location
}

Write-Host "Seeding demo data..."
$env:DATABASE_URL = "postgresql://$DatabaseUser`:postgres@$DatabaseHost`:5432/$DatabaseName?schema=public"
npm --workspace @game-game/api run prisma:seed

Write-Host "Done."

