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

  // EN keys missing in AR
  for (const key of enKeys.keys()) {
    if (!arKeys.has(key)) {
      issues.push({ type: 'missing-ar', path: key, message: `Missing in AR: ${key}` });
    }
  }

  // AR keys missing in EN
  for (const key of arKeys.keys()) {
    if (!enKeys.has(key)) {
      issues.push({ type: 'missing-en', path: key, message: `Missing in EN: ${key}` });
    }
  }

  // Shared keys: empty strings and interpolation parity
  for (const key of enKeys.keys()) {
    if (!arKeys.has(key)) continue;
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
