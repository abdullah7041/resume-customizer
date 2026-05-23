type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function isPlainObject(val: unknown): val is Record<string, JsonValue> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function valuesEqual(a: JsonValue, b: JsonValue): boolean {
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

function mergeInto(target: Record<string, JsonValue>, source: Record<string, JsonValue>, path: string): void {
  for (const key of Object.keys(source)) {
    const currentPath = path ? `${path}.${key}` : key;
    const sourceValue = source[key];
    const targetValue = target[key];

    if (targetValue === undefined) {
      target[key] = sourceValue;
    } else if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
      mergeInto(targetValue, sourceValue, currentPath);
    } else if (!valuesEqual(targetValue, sourceValue)) {
      throw new Error(`Collision detected at key path: ${currentPath}`);
    }
  }
}

export function deepMerge(objects: Record<string, JsonValue>[]): Record<string, JsonValue> {
  const result: Record<string, JsonValue> = {};
  for (const obj of objects) {
    mergeInto(result, obj, '');
  }
  return result;
}
