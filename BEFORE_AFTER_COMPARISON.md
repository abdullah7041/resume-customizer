# withVersion() Idempotency - Before and After

## Problem Statement
Previously, `withVersion()` would blindly append `?v=` or `&v=` to any URL, even if a version parameter already existed. This could lead to URLs like:
```
https://example.com/image.webp?v=123&v=123
```

## Solution
Added an idempotency check to detect if `v=` already exists in the URL.

## Before/After Comparison

### Before (❌ Could append twice)
```typescript
export const withVersion = (url: string) => {
  if (typeof url !== "string" || url.length === 0) {
    return url;
  }

  const version = readBuildId() ?? "__dev__";
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${version}`;
};
```

**Behavior:**
```typescript
withVersion("https://example.com/image.webp")
// → "https://example.com/image.webp?v=123"

withVersion("https://example.com/image.webp?v=123")
// → "https://example.com/image.webp?v=123&v=123" ❌ DUPLICATE!
```

### After (✅ Idempotent)
```typescript
export const withVersion = (url: string) => {
  if (typeof url !== "string" || url.length === 0) {
    return url;
  }

  // Check if v= already exists in the URL to prevent double-appending
  if (/[?&]v=/.test(url)) {
    return url;
  }

  const version = readBuildId() ?? "__dev__";
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${version}`;
};
```

**Behavior:**
```typescript
withVersion("https://example.com/image.webp")
// → "https://example.com/image.webp?v=123"

withVersion("https://example.com/image.webp?v=123")
// → "https://example.com/image.webp?v=123" ✅ UNCHANGED!

withVersion(withVersion("https://example.com/image.webp"))
// → "https://example.com/image.webp?v=123" ✅ IDEMPOTENT!
```

## Test Cases Validating Idempotency

### Test 1: Basic Idempotency
```typescript
it("is idempotent - does not append version twice", async () => {
  const url = "https://example.com/hero.webp";
  const versionedOnce = withVersion(url);
  const versionedTwice = withVersion(versionedOnce);
  
  expect(versionedTwice).toBe(versionedOnce);
  // "https://example.com/hero.webp?v=1234567890" === "https://example.com/hero.webp?v=1234567890"
});
```

### Test 2: Preserves Existing Version
```typescript
it("does not append version if v= query param already exists", async () => {
  const urlWithVersion = "https://example.com/hero.webp?v=oldversion";
  
  expect(withVersion(urlWithVersion)).toBe(urlWithVersion);
  // Input: "...?v=oldversion"
  // Output: "...?v=oldversion" (unchanged)
});
```

### Test 3: Works With Multiple Query Parameters
```typescript
it("does not append version if v= exists with other params", async () => {
  const urlWithVersion = "https://example.com/hero.webp?quality=80&v=oldversion&format=webp";
  
  expect(withVersion(urlWithVersion)).toBe(urlWithVersion);
  // Input: "...?quality=80&v=oldversion&format=webp"
  // Output: "...?quality=80&v=oldversion&format=webp" (unchanged)
});
```

## Where It's Used

The `withVersion()` function is called by `getSkylineUrl()` in `src/lib/assets.ts`:

```typescript
export const getSkylineUrl = () => {
  if (memoizedSkylineUrl) {
    return memoizedSkylineUrl;
  }

  const strictThrow = shouldStrictThrow();
  const rawBaseUrl = getSupabaseBaseUrl();
  const projectBaseUrl = normalizeSupabaseProjectUrl(rawBaseUrl, strictThrow);
  const skylineUrl = buildSkylineObjectUrl(projectBaseUrl);
  const versionedUrl = withVersion(skylineUrl);  // ← Called here
  
  memoizedSkylineUrl = versionedUrl;
  return versionedUrl;
};
```

And `getSkylineUrl()` is used in `src/components/Layout/Header.jsx`:

```jsx
const skylineUrl = useMemo(() => {
  try {
    const url = getSkylineUrl();  // ← Gets versioned URL
    console.log("[skylineUrl]", url);
    return url;
  } catch (error) {
    console.error("Failed to resolve skyline asset", error);
    return "";
  }
}, []);
```

## Benefits

1. **Prevents Duplicate Parameters**: No more `?v=123&v=123` in URLs
2. **Safe to Call Multiple Times**: `withVersion(withVersion(url))` is safe
3. **Preserves Existing Versions**: Won't overwrite manually set versions
4. **Cache Busting Still Works**: First call still adds the version parameter
5. **No Breaking Changes**: All existing tests continue to pass

## Mathematical Property

The function is now **idempotent**, meaning:
```
f(f(x)) = f(x)
```

In our case:
```
withVersion(withVersion(url)) === withVersion(url)
```

This is a desirable property for functions that modify URLs, as it prevents accidental duplicate modifications when the function is called multiple times in a chain.
