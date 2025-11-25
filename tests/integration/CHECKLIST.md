# Integration Test Environment - Setup Checklist

Use this checklist to verify your integration test environment is properly configured.

## Prerequisites

- [ ] Docker installed and running
  ```bash
  docker --version
  docker ps
  ```

- [ ] Docker Compose installed
  ```bash
  docker-compose --version
  ```

- [ ] Node.js 18+ installed
  ```bash
  node --version
  ```

- [ ] npm installed
  ```bash
  npm --version
  ```

## File Verification

- [ ] `docker-compose.test.yml` exists
- [ ] `setup.sh` exists and is executable
- [ ] `setup/localstack-init.sh` exists and is executable
- [ ] `health-check.ts` exists
- [ ] `example.integration.test.ts` exists
- [ ] `fixtures/mongodb-init.js` exists
- [ ] `fixtures/test-data.ts` exists
- [ ] `setup/test-environment.ts` exists
- [ ] `README.md` exists
- [ ] `TESTING_GUIDE.md` exists
- [ ] `QUICK_START.md` exists

Run validation:
```bash
cd tests/integration
chmod +x validate-setup.sh
./validate-setup.sh
```

## Environment Setup

- [ ] Dependencies installed
  ```bash
  npm install
  ```

- [ ] `.env.test` file created
  ```bash
  cp ../../.env.test.example ../../.env.test
  ```

- [ ] Scripts are executable
  ```bash
  chmod +x setup.sh
  chmod +x setup/localstack-init.sh
  chmod +x validate-setup.sh
  ```

## Container Setup

- [ ] Containers started
  ```bash
  ./setup.sh
  # OR
  npm run docker:test:up
  ```

- [ ] PostgreSQL is healthy
  ```bash
  docker exec campaign-test-postgres pg_isready -U postgres
  ```

- [ ] MongoDB is healthy
  ```bash
  docker exec campaign-test-mongodb mongosh --quiet --eval "db.adminCommand('ping')"
  ```

- [ ] Redis is healthy
  ```bash
  docker exec campaign-test-redis redis-cli -a test_password ping
  ```

- [ ] LocalStack is healthy (optional)
  ```bash
  curl http://localhost:4566/_localstack/health
  ```

## Service Health Check

- [ ] All services pass health check
  ```bash
  npx tsx health-check.ts
  ```

Expected output:
```
PostgreSQL (localhost:5433): ✓ Healthy
MongoDB (mongodb://...): ✓ Healthy
Redis (redis://...): ✓ Healthy
```

## Test Execution

- [ ] Example integration test passes
  ```bash
  cd ../..
  npm run test:integration
  ```

Expected output:
```
✓ tests/integration/example.integration.test.ts (8)
Test Files  1 passed (1)
     Tests  8 passed (8)
```

## Verification Steps

### 1. PostgreSQL Connection

```bash
docker exec -it campaign-test-postgres psql -U postgres -d campaign_test -c "SELECT 1;"
```

Expected: `1` row returned

### 2. MongoDB Connection

```bash
docker exec -it campaign-test-mongodb mongosh -u admin -p test_password --eval "db.adminCommand('ping')"
```

Expected: `{ ok: 1 }`

### 3. Redis Connection

```bash
docker exec -it campaign-test-redis redis-cli -a test_password PING
```

Expected: `PONG`

### 4. Database Schema

```bash
docker exec -it campaign-test-postgres psql -U postgres -d campaign_test -c "\dt"
```

Expected: List of tables (users, campaigns, contacts, blacklist, call_records, sms_records)

### 5. MongoDB Collections

```bash
docker exec -it campaign-test-mongodb mongosh -u admin -p test_password campaign_test --eval "db.getCollectionNames()"
```

Expected: `[ 'call_records', 'sms_records', 'event_logs' ]`

## Troubleshooting

### Containers won't start

- [ ] Check Docker is running: `docker ps`
- [ ] Check port availability: `lsof -i :5433,27018,6380,4566`
- [ ] Clean and restart: `npm run docker:test:clean && ./setup.sh`

### Health checks fail

- [ ] Wait longer (services need ~30 seconds to start)
- [ ] Check container logs: `npm run docker:test:logs`
- [ ] Restart specific service: `docker restart campaign-test-postgres`

### Tests fail

- [ ] Verify services are healthy: `npx tsx health-check.ts`
- [ ] Check `.env.test` configuration
- [ ] Clean test data: Tests should clean automatically
- [ ] Check test output for specific errors

### Permission errors

- [ ] Make scripts executable: `chmod +x setup.sh setup/localstack-init.sh`
- [ ] Check Docker permissions: `docker ps` (should not require sudo)

## Cleanup

- [ ] Stop containers
  ```bash
  npm run docker:test:down
  ```

- [ ] Remove volumes (complete cleanup)
  ```bash
  npm run docker:test:clean
  ```

- [ ] Verify cleanup
  ```bash
  docker ps -a | grep campaign-test
  docker volume ls | grep campaign-test
  ```

## Success Criteria

✅ All prerequisites installed
✅ All files present and validated
✅ All containers running and healthy
✅ Health check passes
✅ Example integration test passes (8/8 tests)
✅ Can connect to all databases manually
✅ Documentation reviewed

## Next Steps

Once all items are checked:

1. Read the [Integration Testing Guide](./TESTING_GUIDE.md)
2. Review the [example integration test](./example.integration.test.ts)
3. Start writing your own integration tests
4. Refer to [test fixtures](./fixtures/test-data.ts) for reusable data

## Quick Reference

```bash
# Start environment
cd tests/integration && ./setup.sh

# Check health
npx tsx health-check.ts

# Run tests
npm run test:integration

# View logs
npm run docker:test:logs

# Stop environment
npm run docker:test:down

# Clean everything
npm run docker:test:clean
```

---

**Need help?** See [README.md](./README.md) for detailed documentation.
