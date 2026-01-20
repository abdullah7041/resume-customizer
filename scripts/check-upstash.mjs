/**
 * Script to check Upstash Redis connection and view beta quota keys
 * Run with: node scripts/check-upstash.mjs
 */

import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config();

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function checkUpstash() {
    console.log('🔌 Testing Upstash Connection...\n');
    console.log('URL:', process.env.UPSTASH_REDIS_REST_URL || '❌ NOT SET');
    console.log('Token:', process.env.UPSTASH_REDIS_REST_TOKEN ? '✓ SET' : '❌ NOT SET');
    console.log('');

    try {
        // Test connection
        const pong = await redis.ping();
        console.log('📡 Ping Response:', pong);

        // Get all keys
        const allKeys = await redis.keys('*');
        console.log(`\n📦 Total keys in database: ${allKeys.length}`);

        if (allKeys.length > 0) {
            console.log('Keys:', allKeys.slice(0, 20)); // Show first 20
        }

        // Check for beta keys specifically
        const betaKeys = await redis.keys('beta:*');
        console.log(`\n🎟️  Beta quota keys: ${betaKeys.length}`);

        if (betaKeys.length > 0) {
            console.log('Beta keys found:', betaKeys);

            // Get values for each beta key
            for (const key of betaKeys) {
                const value = await redis.get(key);
                console.log(`  ${key}: ${value}`);
            }
        } else {
            console.log('  No beta:* keys found - quota tracking may not be working');
        }

        // Check for rate limit keys
        const rateLimitKeys = await redis.keys('resume-optimizer:*');
        console.log(`\n⚡ Rate limit keys: ${rateLimitKeys.length}`);
        if (rateLimitKeys.length > 0) {
            console.log('Sample rate limit keys:', rateLimitKeys.slice(0, 5));
        }

    } catch (error) {
        console.error('❌ Error connecting to Upstash:', error.message);
    }
}

checkUpstash();
