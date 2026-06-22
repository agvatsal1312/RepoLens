import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

let redisClient: Redis | null = null;
let redisDisabled = false;
const memoryLocks = new Map<string, { token: string, expires: number }>();

export const getRedisClient = (): Redis | null => {
  if (!redisClient && !redisDisabled && process.env.REDIS_URL) {
    try {
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null // don't retry, fail fast
      });

      redisClient.on('error', (err) => {
        // console.warn('Redis connection error (disabling Redis fallback):', err.message);
        redisClient = null; // Disable redis completely
        redisDisabled = true;
      });

      redisClient.on('connect', () => {
        console.log('Connected to Redis');
      });
    } catch(e) {
      // console.warn('Failed to initialize Redis:', e);
      redisClient = null;
      redisDisabled = true;
    }
  }
  
  return redisClient;
};

/**
 * A simple distributed lock implementation using Redis SET NX PX
 */
export const acquireLock = async (key: string, ttlMs: number = 30000): Promise<string | null> => {
  const client = getRedisClient();
  const token = Math.random().toString(36).substring(2, 15);
  
  if (client) {
    try {
      const result = await client.set(key, token, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        return token;
      }
      return null;
    } catch (err: any) {
       // Failover to memory lock without warning to prevent log pollution
    }
  }
  
  // In-memory fallback
  const now = Date.now();
  const existing = memoryLocks.get(key);
  if (!existing || existing.expires < now) {
    memoryLocks.set(key, { token, expires: now + ttlMs });
    return token;
  }
  return null;
};

export const releaseLock = async (key: string, token: string): Promise<boolean> => {
  const client = getRedisClient();
  
  if (client) {
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      const result = await client.eval(script, 1, key, token);
      return result === 1;
    } catch (err: any) {
      // Failover to memory without warning to prevent log pollution
    }
  }
  
  // In-memory fallback
  const existing = memoryLocks.get(key);
  if (existing && existing.token === token) {
    memoryLocks.delete(key);
    return true;
  }
  
  return false;
};
