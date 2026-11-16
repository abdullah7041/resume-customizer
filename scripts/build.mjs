import { build } from "vite";

process.env.VITE_BUILD_ID = Date.now().toString();
process.env.VITE_SENTRY_RELEASE ||= process.env.COMMIT_REF || process.env.VITE_BUILD_ID;

try {
  await build();
} catch (error) {
  console.error(error);
  process.exit(1);
}

