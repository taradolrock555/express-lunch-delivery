interface RuntimeConfig {
  apiBaseUrl?: string;
}

const runtimeConfig =
  typeof window === 'undefined'
    ? undefined
    : (window as Window & { __APP_CONFIG__?: RuntimeConfig }).__APP_CONFIG__;
const configuredApiUrl = runtimeConfig?.apiBaseUrl?.trim();
const hostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
const isAngularDevServer = typeof window !== 'undefined' && window.location.port === '4200';

const defaultApiUrl = isLocalHost || isAngularDevServer
  ? `http://${hostname}:3000/api`
  : `${window.location.origin}/api`;

export const API_BASE_URL = (configuredApiUrl || defaultApiUrl).replace(/\/+$/, '');
