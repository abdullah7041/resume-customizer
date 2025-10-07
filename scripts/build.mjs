/* eslint-env node */
import { build } from "vite";

process.env.VITE_BUILD_ID = Date.now().toString();

try {
  await build();
} catch (error) {
  console.error(error);
  process.exit(1);
}

