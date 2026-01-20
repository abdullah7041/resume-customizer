/**
 * Simple Upstash test using fetch
 */

import dotenv from 'dotenv';
dotenv.config();

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

console.log('URL:', url);
console.log('Token set:', token ? 'YES' : 'NO');

async function test() {
    try {
        // Test PING
        const pingRes = await fetch(`${url}/PING`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const ping = await pingRes.json();
        console.log('\n✅ PING:', ping);

        // Get all keys
        const keysRes = await fetch(`${url}/KEYS/*`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const keys = await keysRes.json();
        console.log('\n📦 All keys:', keys);

        // Get beta keys
        const betaRes = await fetch(`${url}/KEYS/beta:*`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const betaKeys = await betaRes.json();
        console.log('\n🎟️ Beta keys:', betaKeys);

    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

test();
