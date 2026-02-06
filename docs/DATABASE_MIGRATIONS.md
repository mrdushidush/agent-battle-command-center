# Database Migrations

## Overview

The project uses **Prisma Migrate** for database schema management. This provides:
- Version-controlled migration history
- Rollback capability
- Safe schema evolution for deployed instances
- Automatic migration on Docker startup

## Migration Commands

### Development

**Create a new migration:**
```bash
cd packages/api
pnpm db:migrate

# Or with a name:
pnpm exec prisma migrate dev --name add_user_table
```

This will:
1. Compare schema.prisma with database
2. Generate SQL migration file
3. Apply migration to database
4. Regenerate Prisma client

**Generate Prisma client only:**
```bash
pnpm db:generate
```

**Open Prisma Studio (database GUI):**
```bash
pnpm db:studio
```

### Production (Docker)

**Migrations run automatically** on container startup via `docker-entrypoint.sh`:

```bash
npx prisma migrate deploy
```

This applies all pending migrations without prompting.

### Reset Database (Development Only)

```bash
# WARNING: Deletes all data!
cd packages/api
pnpm exec prisma migrate reset

# This will:
# 1. Drop the database
# 2. Create new database
# 3. Apply all migrations
# 4. Run seed script
```

## Migration Workflow

### 1. Make Schema Changes

Edit `packages/api/prisma/schema.prisma`:

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
}
```

### 2. Create Migration

```bash
cd packages/api
pnpm db:migrate
# Name: add_user_table
```

This creates: `prisma/migrations/YYYYMMDD_HHMMSS_add_user_table/migration.sql`

### 3. Review Migration SQL

```bash
cat prisma/migrations/YYYYMMDD_HHMMSS_add_user_table/migration.sql
```

Example output:
```sql
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
```

### 4. Test Migration

```bash
# Migration already applied locally during creation
# Test by running the app:
pnpm dev

# Or run tests:
pnpm test
```

### 5. Commit Migration

```bash
git add prisma/migrations/
git commit -m "feat: add User table migration"
```

### 6. Deploy

```bash
# Push to git
git push

# Docker will automatically apply migration on next startup
docker compose up --build
```

## Migration Directory Structure

```
packages/api/prisma/
├── schema.prisma               # Source of truth
├── seed.ts                     # Seed data script
└── migrations/
    ├── migration_lock.toml     # Lock file (DO commit)
    └── YYYYMMDD_HHMMSS_name/
        ├── migration.sql       # SQL to apply
        └── CODE_CHANGES.md     # Optional notes
```

## Common Scenarios

### Add a New Field

**1. Edit schema.prisma:**
```prisma
model Task {
  // ... existing fields ...
  priority Int @default(0)  // NEW
}
```

**2. Create migration:**
```bash
pnpm db:migrate
# Name: add_task_priority
```

**3. Prisma generates SQL:**
```sql
ALTER TABLE "Task" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;
```

### Rename a Field

**1. Edit schema.prisma:**
```prisma
model Task {
  description String  // was: desc
}
```

**2. Create migration:**
```bash
pnpm db:migrate
# Name: rename_task_desc_to_description
```

**3. Review SQL (might need manual edit):**
```sql
-- Prisma might drop and recreate instead of rename
-- You may want to edit the migration.sql to use:
ALTER TABLE "Task" RENAME COLUMN "desc" TO "description";
```

**4. If you edited the SQL, mark as applied:**
```bash
npx prisma migrate resolve --applied YYYYMMDD_HHMMSS_rename_task_desc_to_description
```

### Add a New Model

**1. Edit schema.prisma:**
```prisma
model Comment {
  id        String   @id @default(cuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  content   String
  createdAt DateTime @default(now())

  @@index([taskId])
}

model Task {
  // ... existing fields ...
  comments Comment[]
}
```

**2. Create migration:**
```bash
pnpm db:migrate
# Name: add_comments
```

### Delete Old Migrations (Squash)

For a fresh start with many accumulated migrations:

```bash
# 1. Backup your database first!
docker exec abcc-postgres pg_dump -U postgres abcc > backup.sql

# 2. Delete migrations folder
rm -rf packages/api/prisma/migrations

# 3. Create initial migration
cd packages/api
pnpm exec prisma migrate dev --name init

# 4. This creates a fresh migration from current schema
```

**Warning:** Only do this if no production databases exist, or coordinate carefully.

## Troubleshooting

### "Migration failed to apply cleanly"

**Cause:** Database state doesn't match migration history

**Solution 1 - Mark as applied (if migration was already applied manually):**
```bash
npx prisma migrate resolve --applied MIGRATION_NAME
```

**Solution 2 - Rollback (if migration is broken):**
```bash
npx prisma migrate resolve --rolled-back MIGRATION_NAME
# Then fix the migration SQL and reapply
```

**Solution 3 - Reset (development only):**
```bash
pnpm exec prisma migrate reset
```

### "Prisma client out of sync"

**Symptoms:** TypeScript errors about missing fields/models

**Solution:**
```bash
pnpm db:generate
```

### "Migration conflicts" during git merge

**Cause:** Two branches created migrations at same time

**Solution:**
```bash
# 1. Keep both migrations (rename if needed)
# 2. Apply them in order
cd packages/api
pnpm db:migrate
# Prisma will apply both
```

### Production migration fails

**Check Docker logs:**
```bash
docker logs abcc-api

# You should see:
# "Running database migrations..."
# "Migration XXXXXX applied"
```

**Manual migration:**
```bash
docker exec abcc-api npx prisma migrate deploy
```

**Rollback (if safe):**
```bash
# Stop the container
docker compose down api

# Restore database from backup
docker exec -i abcc-postgres psql -U postgres abcc < backup.sql

# Fix the migration, rebuild, restart
docker compose up --build api
```

## Best Practices

### DO ✅

- **Review generated SQL** before committing migrations
- **Test migrations locally** before deploying
- **Commit migrations with code changes** that depend on them
- **Use descriptive migration names** (`add_user_auth` not `migration_1`)
- **Backup before major migrations** in production
- **Keep migration files** - never delete or edit committed migrations

### DON'T ❌

- **Don't edit migrations after committing** - create a new migration instead
- **Don't use `db push` in production** - use `migrate deploy`
- **Don't delete migrations** that have been deployed
- **Don't skip migration testing** before production deploy
- **Don't make breaking changes** without a rollback plan
- **Don't forget to generate client** after schema changes

## CI/CD Integration

### GitHub Actions Example

```yaml
jobs:
  test:
    steps:
      - name: Setup database
        run: |
          docker compose up -d postgres
          cd packages/api
          pnpm db:migrate

      - name: Run tests
        run: pnpm test
```

### Deployment Pipeline

```yaml
deploy:
  steps:
    - name: Build Docker image
      run: docker compose build

    - name: Run migrations
      run: |
        docker compose up -d postgres
        docker compose run api npx prisma migrate deploy

    - name: Start services
      run: docker compose up -d
```

## Migration History

Current migrations:
- `20260201_simplify_complexity_model` - Simplified complexity tracking fields

To view migration history:
```bash
cd packages/api
npx prisma migrate status
```

## Prisma Commands Reference

| Command | Description |
|---------|-------------|
| `prisma migrate dev` | Create and apply migration in development |
| `prisma migrate deploy` | Apply pending migrations in production |
| `prisma migrate status` | Check which migrations are applied |
| `prisma migrate resolve --applied NAME` | Mark migration as applied |
| `prisma migrate resolve --rolled-back NAME` | Mark migration as rolled back |
| `prisma migrate reset` | Reset database and reapply all migrations |
| `prisma migrate diff` | Compare schema with database |
| `prisma db push` | Push schema without migrations (dev only) |
| `prisma db seed` | Run seed script |
| `prisma generate` | Generate Prisma client |
| `prisma studio` | Open database GUI |

## Further Reading

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Migration Troubleshooting](https://www.prisma.io/docs/guides/database/troubleshooting-orm)
