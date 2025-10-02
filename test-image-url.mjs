import { getSkylineUrl } from './src/lib/assets.ts';

try {
  const url = getSkylineUrl();
  console.log('✅ Skyline URL:', url);
  console.log('✅ URL is valid:', url.startsWith('http'));
  console.log('✅ Contains proper path:', url.includes('/storage/v1/object/public/ui-assets/KAFDH.webp'));
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
