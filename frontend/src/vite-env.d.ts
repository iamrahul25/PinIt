/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SSO_ENABLED: string;
    readonly VITE_GOOGLE_MAPS_API_KEY: string;
    readonly VITE_GOOGLE_MAPS_MAP_ID: string;
    readonly VITE_BACKEND_URL: string;
    readonly VITE_GOOGLE_CLIENT_ID: string;
    readonly VITE_DISCORD_INVITE: string;
    readonly MODE: string;
    readonly BASE_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Google Maps global
interface Window {
    L: any;
    google: any;
}
