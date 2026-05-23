import fs from 'fs';
import { validateI18n } from './i18n-validate-lib.mjs';

const enDir = 'src/locales/en';
const arDir = 'src/locales/ar';

const { enKeys, arKeys } = validateI18n(enDir, arDir);

const missingKeys = [];
for (const [key, value] of enKeys) {
  if (!arKeys.has(key)) {
    missingKeys.push({ key, value });
  }
}

const glossary = fs.existsSync('docs/i18n-glossary.md')
  ? fs.readFileSync('docs/i18n-glossary.md', 'utf-8')
  : '';

const prompt = `# Arabic Translation Prompt for Watheq

## Task
Translate the following missing English UI keys into Saudi-friendly Arabic for the Watheq resume optimizer app.

## Rules
- Preserve the exact JSON structure (nested keys).
- Preserve all i18next interpolation variables such as {{count}}, {{remaining}}, {{score}}, etc. Do not translate or modify them.
- Use a formal but clear SaaS tone suitable for a Saudi professional audience.
- Use existing product terminology from the glossary below.
- Do not invent product features or change the meaning of the English text.
- If a value is an array of strings, translate each string and preserve the array order.

## Product Context
Watheq is an AI-powered resume optimizer for the Saudi job market. It supports Arabic and English resumes, ATS optimization, job matching, interview preparation, and Vision 2030 alignment.

## Glossary
${glossary || '(No glossary found — refer to existing AR translations for terminology consistency.)'}

## Missing Keys

${missingKeys.map(({ key, value }) => `- ${key}\n  EN: "${value}"`).join('\n\n')}

## Output Format
Return a JSON object with the same nested key structure, containing only the keys listed above. Do not include keys that already have Arabic translations.
`;

const outputPath = 'i18n-translation-prompt-ar.md';
fs.writeFileSync(outputPath, prompt);

console.log(`Generated ${outputPath} with ${missingKeys.length} missing keys.`);
