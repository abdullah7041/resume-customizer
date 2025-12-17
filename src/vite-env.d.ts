// <reference types="vite/client" />

// Allow importing .jsx files without type errors
declare module "*.tsx" {
  const component: any;
  export default component;
}




