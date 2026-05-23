import { validateI18n } from './i18n-validate-lib.mjs';

const enDir = 'src/locales/en';
const arDir = 'src/locales/ar';

const { issues } = validateI18n(enDir, arDir);

function groupByType(list) {
  const groups = {};
  for (const item of list) {
    (groups[item.type] ||= []).push(item);
  }
  return groups;
}

const groups = groupByType(issues);

let hasErrors = false;

for (const [type, items] of Object.entries(groups)) {
  console.log(`\n${type.toUpperCase()} (${items.length})`);
  for (const item of items) {
    console.log(`  ${item.message}`);
  }
  hasErrors = true;
}

if (!hasErrors) {
  console.log('All translations valid. No issues found.');
} else {
  console.log(`\nTotal issues: ${issues.length}`);
  process.exit(1);
}
