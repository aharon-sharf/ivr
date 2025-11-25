# Database Migrations

This directory contains SQL migration scripts for the Mass Voice Campaign System database.

## Migration Files

- `001_initial_schema.sql` - Initial database schema with all tables, indexes, and triggers

## Running Migrations

### Using psql

```bash
# Connect to your PostgreSQL database
psql -h <host> -U <username> -d <database> -f migrations/001_initial_schema.sql
```

### Using Node.js migration tool (node-pg-migrate)

```bash
npm install -g node-pg-migrate

# Run all pending migrations
DATABASE_URL=postgresql://user:pass@host:5432/dbname npm run migrate up

# Rollback last migration
DATABASE_URL=postgresql://user:pass@host:5432/dbname npm run migrate down
```

### Using Terraform (for AWS RDS)

The Terraform configuration in `terraform/modules/data/` can automatically apply migrations during provisioning.

## Migration Naming Convention

Migrations are numbered sequentially: `001_`, `002_`, `003_`, etc.

Format: `<number>_<description>.sql`

## Best Practices

1. Always wrap migrations in a transaction (BEGIN/COMMIT)
2. Test migrations on a development database first
3. Create rollback scripts for each migration
4. Never modify existing migration files after they've been applied to production
5. Use descriptive names for migrations
