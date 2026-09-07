import fs from 'fs';
import path from 'path';

function isPlainObject(val) {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function valuesEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => valuesEqual(item, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(k => valuesEqual(a[k], b[k]));
  }
  return false;
}

function mergeInto(target, source, path, collisions) {
  for (const key of Object.keys(source)) {
    const currentPath = path ? `${path}.${key}` : key;
    const sourceValue = source[key];
    const targetValue = target[key];

    if (targetValue === undefined) {
      target[key] = sourceValue;
    } else if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
      mergeInto(targetValue, sourceValue, currentPath, collisions);
    } else if (!valuesEqual(targetValue, sourceValue)) {
      collisions.push({ path: currentPath, existing: targetValue, incoming: sourceValue });
    }
  }
}

export function loadLocale(dirPath) {
  const files = collectJsonFiles(dirPath);
  const objects = files.map(f => JSON.parse(fs.readFileSync(f, 'utf-8')));
  const result = {};
  const collisions = [];
  for (const obj of objects) {
    mergeInto(result, obj, '', collisions);
  }
  return { data: result, collisions };
}

function collectJsonFiles(dir) {
  const results = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.json')) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results.sort();
}

function walkKeys(obj, prefix = '', callback) {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(val)) {
      walkKeys(val, path, callback);
    } else {
      callback(path, val);
    }
  }
}

/**
 * i18next appends a CLDR plural category to the base key. English resolves only
 * `one` and `other`; Arabic resolves all six. Demanding an identical key set across
 * locales therefore forces one of two bad outcomes: English carries four forms it can
 * never select (the existing `found_*` keys do exactly that), or Arabic is capped at
 * English's two and loses its dual and its 3-10 form. Each locale is checked against
 * ITS OWN required categories instead.
 */
const PLURAL_SUFFIX_RE = /_(zero|one|two|few|many|other)$/;

const pluralCategoriesByLocale = new Map();
function requiredPluralForms(locale) {
  if (!pluralCategoriesByLocale.has(locale)) {
    pluralCategoriesByLocale.set(
      locale,
      new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories),
    );
  }
  return pluralCategoriesByLocale.get(locale);
}

/** `a.b.count_one` -> { base: 'a.b.count', form: 'one' }; null for a plain key. */
export function splitPluralKey(key) {
  const match = PLURAL_SUFFIX_RE.exec(key);
  if (!match) return null;
  return { base: key.slice(0, match.index), form: match[1] };
}

function groupPlurals(keys) {
  const plain = new Map();
  const plural = new Map();
  for (const [key, value] of keys) {
    const split = splitPluralKey(key);
    if (!split) {
      plain.set(key, value);
      continue;
    }
    if (!plural.has(split.base)) plural.set(split.base, new Map());
    plural.get(split.base).set(split.form, value);
  }
  return { plain, plural };
}

function extractVars(str) {
  if (typeof str !== 'string') return new Set();
  const matches = str.match(/\{\{[^}]+\}\}/g);
  return matches ? new Set(matches) : new Set();
}

export function validateI18n(enDir, arDir) {
  const en = loadLocale(enDir);
  const ar = loadLocale(arDir);

  const issues = [];

  // Collisions
  for (const c of en.collisions) {
    issues.push({ type: 'collision', locale: 'en', path: c.path, message: `Collision at ${c.path}` });
  }
  for (const c of ar.collisions) {
    issues.push({ type: 'collision', locale: 'ar', path: c.path, message: `Collision at ${c.path}` });
  }

  const enKeys = new Map();
  const arKeys = new Map();

  walkKeys(en.data, '', (p, v) => enKeys.set(p, v));
  walkKeys(ar.data, '', (p, v) => arKeys.set(p, v));

  const enGrouped = groupPlurals(enKeys);
  const arGrouped = groupPlurals(arKeys);

  // ---- plain keys: exact parity, as before -------------------------------
  for (const key of enGrouped.plain.keys()) {
    if (!arGrouped.plain.has(key)) {
      issues.push({ type: 'missing-ar', path: key, message: `Missing in AR: ${key}` });
    }
  }
  for (const key of arGrouped.plain.keys()) {
    if (!enGrouped.plain.has(key)) {
      issues.push({ type: 'missing-en', path: key, message: `Missing in EN: ${key}` });
    }
  }

  // ---- plural sets: each locale must cover its OWN categories ------------
  const pluralBases = new Set([...enGrouped.plural.keys(), ...arGrouped.plural.keys()]);
  for (const base of pluralBases) {
    const enForms = enGrouped.plural.get(base);
    const arForms = arGrouped.plural.get(base);

    if (!arForms) {
      issues.push({ type: 'missing-ar', path: base, message: `Missing in AR: ${base} (plural set)` });
      continue;
    }
    if (!enForms) {
      issues.push({ type: 'missing-en', path: base, message: `Missing in EN: ${base} (plural set)` });
      continue;
    }

    for (const [locale, forms] of [['en', enForms], ['ar', arForms]]) {
      for (const required of requiredPluralForms(locale)) {
        if (!forms.has(required)) {
          issues.push({
            type: 'missing-plural-form',
            path: `${base}_${required}`,
            message: `Missing ${locale.toUpperCase()} plural form: ${base}_${required}`,
          });
        }
      }
      for (const [form, value] of forms) {
        if (value === '') {
          issues.push({ type: 'empty', path: `${base}_${form}`, message: `Empty string in ${locale.toUpperCase()}: ${base}_${form}` });
        }
      }
    }

    // Interpolation across a plural set, comparing the UNION of each locale's forms.
    // `{{count}}` is exempt: a form may legitimately spell the quantity out rather
    // than print it ("one word", "كلمة واحدة"), and i18next supplies it regardless.
    const varsOf = (forms) => {
      const all = new Set();
      for (const value of forms.values()) {
        for (const v of extractVars(value)) {
          if (v !== '{{count}}') all.add(v);
        }
      }
      return all;
    };
    const enVars = varsOf(enForms);
    const arVars = varsOf(arForms);
    const missingInAr = [...enVars].filter(v => !arVars.has(v));
    const missingInEn = [...arVars].filter(v => !enVars.has(v));
    if (missingInAr.length > 0) {
      issues.push({ type: 'interpolation', path: base, message: `AR missing vars ${missingInAr.join(', ')} for ${base} (plural set)` });
    }
    if (missingInEn.length > 0) {
      issues.push({ type: 'interpolation', path: base, message: `EN missing vars ${missingInEn.join(', ')} for ${base} (plural set)` });
    }
  }

  // ---- shared plain keys: empty strings and interpolation parity ---------
  for (const key of enGrouped.plain.keys()) {
    if (!arGrouped.plain.has(key)) continue;
    const enVal = enKeys.get(key);
    const arVal = arKeys.get(key);

    if (enVal === '') {
      issues.push({ type: 'empty', path: key, message: `Empty string in EN: ${key}` });
    }
    if (arVal === '') {
      issues.push({ type: 'empty', path: key, message: `Empty string in AR: ${key}` });
    }

    if (typeof enVal === 'string' && typeof arVal === 'string') {
      const enVars = extractVars(enVal);
      const arVars = extractVars(arVal);
      const missingInAr = [...enVars].filter(v => !arVars.has(v));
      const missingInEn = [...arVars].filter(v => !enVars.has(v));
      if (missingInAr.length > 0) {
        issues.push({ type: 'interpolation', path: key, message: `AR missing vars ${missingInAr.join(', ')} for ${key}` });
      }
      if (missingInEn.length > 0) {
        issues.push({ type: 'interpolation', path: key, message: `EN missing vars ${missingInEn.join(', ')} for ${key}` });
      }
    }
  }

  return {
    issues,
    enKeys,
    arKeys,
    enData: en.data,
    arData: ar.data,
  };
}
