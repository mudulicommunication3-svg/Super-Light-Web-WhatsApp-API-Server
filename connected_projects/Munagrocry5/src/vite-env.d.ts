/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_BOT_TOKEN?: string;
  readonly VITE_ADMIN_ID?: string;
  readonly VITE_ADMIN_USERNAME?: string;
  readonly VITE_ADMIN_PASSWORD?: string;
  readonly VITE_GOOGLE_SHEET_ID?: string;
  readonly VITE_GOOGLE_SHEET_NAME?: string;
  readonly VITE_SPREADSHEET_URL?: string;
  readonly VITE_SHEET_WEBHOOK_URL?: string;
  readonly VITE_APPS_SCRIPT_URL?: string;
  readonly VITE_USER_EMAIL?: string;
  readonly VITE_WEB_APP_URL?: string;
  readonly VITE_CUSTOM_SEARCH_API_KEY?: string;
  readonly VITE_SEARCH_ENGINE_ID?: string;
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
