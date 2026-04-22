/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_REMOTE_STORAGE?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
