// Quick test script to check Redis connection
// Run this locally or in a Lambda to test Redis authentication

const { createClient } = require('redis');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

async function testRedisConnection() {
  const secretsClient = new SecretsManagerClient({ region: 'il-central-1' });
  
  try {
    // Get the Redis password from Secrets Manager
    const command = new GetSecretValueCommand({ 
      SecretId: 'mass-voice-campaign-redis-password-staging' 
    });
    const response = await secretsClient.send(command);
    const secret = JSON.parse(response.SecretString);
    
    console.log('Secret retrieved:', {
      endpoint: secret.endpoint,
      port: secret.port,
      passwordLength: secret.password.length
    });
    
    // Test connection with password
    const redisUrlWithAuth = `redis://:${secret.password}@${secret.endpoint}:${secret.port}`;
    console.log('Trying connection with auth...');
    
    const clientWithAuth = createClient({ url: redisUrlWithAuth });
    
    clientWithAuth.on('error', (err) => {
      console.error('Redis Client Error (with auth):', err.message);
    });
    
    try {
      await clientWithAuth.connect();
      console.log('✅ Connected to Redis WITH authentication');
      const pong = await clientWithAuth.ping();
      console.log('✅ PING response:', pong);
      await clientWithAuth.quit();
    } catch (authError) {
      console.error('❌ Failed to connect with auth:', authError.message);
      
      // Try without password
      console.log('Trying connection without auth...');
      const redisUrlNoAuth = `redis://${secret.endpoint}:${secret.port}`;
      const clientNoAuth = createClient({ url: redisUrlNoAuth });
      
      clientNoAuth.on('error', (err) => {
        console.error('Redis Client Error (no auth):', err.message);
      });
      
      try {
        await clientNoAuth.connect();
        console.log('✅ Connected to Redis WITHOUT authentication');
        const pong = await clientNoAuth.ping();
        console.log('✅ PING response:', pong);
        await clientNoAuth.quit();
        console.log('🔍 Redis is running but NOT configured with authentication!');
      } catch (noAuthError) {
        console.error('❌ Failed to connect without auth:', noAuthError.message);
        console.log('🔍 Redis might not be running or accessible');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testRedisConnection();