/// <reference types="vite/client" />

// Allow importing .jsx files without type errors
declare module "*.jsx" {
  const component: any;
  export default component;
}



