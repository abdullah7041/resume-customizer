import fs from 'fs';
import { validateI18n } from './i18n-validate-lib.mjs';

const enDir = 'src/locales/en';
const arDir = 'src/locales/ar';

const { enKeys, arKeys } = validateI18n(enDir, arDir);

const missing = {};
for (const [key, value] of enKeys) {
  if (!arKeys.has(key)) {
    missing[key] = value;
  }
}

const outputPath = 'i18n-missing-ar.json';
fs.writeFileSync(outputPath, JSON.stringify(missing, null, 2) + '\n');

console.log(`Generated ${outputPath} with ${Object.keys(missing).length} missing AR keys.`);
