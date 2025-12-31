/**
 * User Service
 * Handles user synchronization between Cognito and the database
 */

import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// Initialize Secrets Manager client
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'il-central-1' });

// Cache for database password
let cachedDbPassword: string | null = null;

/**
 * Get database password from AWS Secrets Manager
 */
async function getDbPassword(): Promise<string> {
  if (cachedDbPassword) {
    return cachedDbPassword;
  }

  try {
    const secretArn = process.env.DB_SECRET_ARN;
    if (!secretArn) {
      throw new Error('DB_SECRET_ARN environment variable not set');
    }

    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await secretsClient.send(command);
    
    if (response.SecretString) {
      const secret = JSON.parse(response.SecretString);
      cachedDbPassword = secret.password as string;
      return cachedDbPassword;
    }
    
    throw new Error('No password found in secret');
  } catch (error) {
    console.error('Error retrieving database password:', error);
    throw new Error(`Failed to retrieve database password: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Database connection pool (initialized lazily)
let pool: Pool | null = null;

/**
 * Get or create database connection pool
 */
async function getPool(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  const password: string = await getDbPassword();
  
  pool = new Pool({
    host: process.env.RDS_PROXY_ENDPOINT || process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'campaign_system',
    user: process.env.DB_USER || 'dbadmin',
    password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: {
      rejectUnauthorized: false
    }
  });

  return pool;
}

export interface User {
  id: string;
  email: string;
  cognitoUserId: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserService {
  /**
   * Ensure a user exists in the database, creating them if necessary.
   * Uses the Cognito user ID as the primary key to maintain consistency.
   * 
   * @param cognitoUserId - The Cognito sub (user ID)
   * @param email - User's email address
   * @param roles - User's roles from Cognito groups
   * @returns The user record
   */
  async ensureUserExists(
    cognitoUserId: string,
    email: string,
    roles: string[]
  ): Promise<User> {
    const pool = await getPool();
    const client = await pool.connect();
    
    try {
      // First, try to find existing user by Cognito ID
      const existingQuery = 'SELECT * FROM users WHERE cognito_user_id = $1';
      const existingResult = await client.query(existingQuery, [cognitoUserId]);
      
      if (existingResult.rows.length > 0) {
        // User exists, optionally update email/role if changed
        const existingUser = existingResult.rows[0];
        const primaryRole = this.getPrimaryRole(roles);
        
        // Update if email or role changed
        if (existingUser.email !== email || existingUser.role !== primaryRole) {
          const updateQuery = `
            UPDATE users 
            SET email = $1, role = $2, updated_at = CURRENT_TIMESTAMP
            WHERE cognito_user_id = $3
            RETURNING *
          `;
          const updateResult = await client.query(updateQuery, [email, primaryRole, cognitoUserId]);
          return this.mapRowToUser(updateResult.rows[0]);
        }
        
        return this.mapRowToUser(existingUser);
      }
      
      // User doesn't exist, create them
      // Use the Cognito user ID as the database ID for consistency
      const primaryRole = this.getPrimaryRole(roles);
      
      const insertQuery = `
        INSERT INTO users (id, email, cognito_user_id, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      
      const insertResult = await client.query(insertQuery, [
        cognitoUserId,  // Use Cognito ID as the database ID
        email,
        cognitoUserId,
        primaryRole
      ]);
      
      console.log('Created new user in database:', {
        id: cognitoUserId,
        email,
        role: primaryRole
      });
      
      return this.mapRowToUser(insertResult.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get user by Cognito user ID
   */
  async getUserByCognitoId(cognitoUserId: string): Promise<User | null> {
    const pool = await getPool();
    const client = await pool.connect();
    
    try {
      const query = 'SELECT * FROM users WHERE cognito_user_id = $1';
      const result = await client.query(query, [cognitoUserId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToUser(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get the primary role from Cognito groups
   * Priority: Administrator > CampaignManager > Analyst
   */
  private getPrimaryRole(roles: string[]): string {
    if (roles.includes('Administrator')) {
      return 'Administrator';
    }
    if (roles.includes('CampaignManager')) {
      return 'CampaignManager';
    }
    if (roles.includes('Analyst')) {
      return 'Analyst';
    }
    // Default to CampaignManager if no recognized role
    return 'CampaignManager';
  }

  /**
   * Map database row to User object
   */
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      cognitoUserId: row.cognito_user_id,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
