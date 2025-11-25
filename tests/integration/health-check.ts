/**
 * Health Check Script for Integration Test Environment
 * 
 * This script checks if all required services are running and healthy.
 * Run with: npx tsx tests/integration/health-check.ts
 */

import { checkServicesHealth, TEST_CONFIG } from './setup/test-environment';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

async function main() {
  console.log('\n' + COLORS.blue + '========================================' + COLORS.reset);
  console.log(COLORS.blue + 'Integration Test Environment Health Check' + COLORS.reset);
  console.log(COLORS.blue + '========================================' + COLORS.reset + '\n');

  console.log('Checking services...\n');

  const health = await checkServicesHealth();

  // PostgreSQL
  console.log(
    `PostgreSQL (${TEST_CONFIG.postgres.host}:${TEST_CONFIG.postgres.port}): ` +
    (health.postgres 
      ? COLORS.green + '✓ Healthy' + COLORS.reset
      : COLORS.red + '✗ Unhealthy' + COLORS.reset)
  );

  // MongoDB
  console.log(
    `MongoDB (${TEST_CONFIG.mongodb.url}): ` +
    (health.mongodb
      ? COLORS.green + '✓ Healthy' + COLORS.reset
      : COLORS.red + '✗ Unhealthy' + COLORS.reset)
  );

  // Redis
  console.log(
    `Redis (${TEST_CONFIG.redis.url}): ` +
    (health.redis
      ? COLORS.green + '✓ Healthy' + COLORS.reset
      : COLORS.red + '✗ Unhealthy' + COLORS.reset)
  );

  console.log('\n' + COLORS.blue + '========================================' + COLORS.reset + '\n');

  const allHealthy = health.postgres && health.mongodb && health.redis;

  if (allHealthy) {
    console.log(COLORS.green + '✓ All services are healthy!' + COLORS.reset);
    console.log('\nYou can now run integration tests:');
    console.log('  npm run test:integration\n');
    process.exit(0);
  } else {
    console.log(COLORS.red + '✗ Some services are unhealthy' + COLORS.reset);
    console.log('\nTroubleshooting steps:');
    
    if (!health.postgres) {
      console.log('\nPostgreSQL:');
      console.log('  1. Check if container is running: docker ps | grep campaign-test-postgres');
      console.log('  2. Check logs: docker logs campaign-test-postgres');
      console.log('  3. Restart: docker restart campaign-test-postgres');
    }
    
    if (!health.mongodb) {
      console.log('\nMongoDB:');
      console.log('  1. Check if container is running: docker ps | grep campaign-test-mongodb');
      console.log('  2. Check logs: docker logs campaign-test-mongodb');
      console.log('  3. Restart: docker restart campaign-test-mongodb');
    }
    
    if (!health.redis) {
      console.log('\nRedis:');
      console.log('  1. Check if container is running: docker ps | grep campaign-test-redis');
      console.log('  2. Check logs: docker logs campaign-test-redis');
      console.log('  3. Restart: docker restart campaign-test-redis');
    }

    console.log('\nOr restart all services:');
    console.log('  cd tests/integration && docker-compose -f docker-compose.test.yml restart\n');
    
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(COLORS.red + '\nError running health check:' + COLORS.reset);
  console.error(error);
  process.exit(1);
});
