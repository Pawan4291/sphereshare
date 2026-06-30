// src/lib/sphere.ts
import {
  ConnectClient,
  ConnectError,
  ERROR_CODES,
  SPHERE_NETWORKS,
  HOST_READY_TYPE,
  HOST_READY_TIMEOUT,
  WALLET_EVENTS,
} from '@unicitylabs/sphere-sdk/connect';
import {
  PostMessageTransport,
  ExtensionTransport,
} from '@unicitylabs/sphere-sdk/connect/browser';
import type { ConnectTransport, PublicIdentity, PermissionScope } from '@unicitylabs/sphere-sdk/connect';

export const SPHERE_WALLET_URL = 'https://sphere.unicity.network';
export const SESSION_KEY = 'sphereshare-session';

export { ERROR_CODES, ConnectError, WALLET_EVENTS };
export type SphereClient = ConnectClient;

const DAPP = { name: 'SphereShare', description: 'Split bills and bulk payouts on Unicity testnet2', url: location.origin };
const PERMISSIONS: PermissionScope[] = ['balance:read','tokens:read','resolve:peer','transfer:request','payment:request','dm:request','events:subscribe','sign:request'];
export function getErrorMessage(code: number): string {
  switch (code) {
    case ERROR_CODES.INCOMPATIBLE_NETWORK: return 'Your Sphere wallet is on the wrong network. Please switch to testnet2.';
    case ERROR_CODES.INSUFFICIENT_BALANCE: return 'Insufficient balance to complete this transaction.';
    case ERROR_CODES.INVALID_RECIPIENT: return 'Invalid recipient address — could not resolve to a wallet.';
    case ERROR_CODES.USER_REJECTED: return 'Transaction was rejected by the user.';
    case ERROR_CODES.SESSION_EXPIRED: return 'Wallet session expired. Please reconnect.';
    case ERROR_CODES.PERMISSION_DENIED: return 'Permission denied by wallet.';
    case ERROR_CODES.TRANSFER_FAILED: return 'Transfer failed on the network. Please try again.';
    case ERROR_CODES.INTENT_CANCELLED: return 'Action was cancelled.';
    case ERROR_CODES.UNSUPPORTED_PROTOCOL_VERSION: return 'Wallet version incompatible. Please update your Sphere wallet.';
    case ERROR_CODES.RATE_LIMITED: return 'Too many requests. Please wait a moment.';
    default: return 'An unexpected error occurred.';
  }
}

function isInIframe(): boolean {
  try { return window.self !== window.top; } catch { return true; }
}

function hasExtension(): boolean {
  return typeof (window as any).sphereExtension !== 'undefined';
}

function waitForHostReady(timeoutMs = HOST_READY_TIMEOUT): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('Wallet popup did not become ready in time'));
    }, timeoutMs);
    function handler(event: MessageEvent) {
      if (event.data?.type === HOST_READY_TYPE) {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        resolve();
      }
    }
    window.addEventListener('message', handler);
  });
}

let clientRef: ConnectClient | null = null;
let transportRef: ConnectTransport | null = null;
let popupRef: Window | null = null;

export async function connectToSphere(silent = false): Promise<{
  client: ConnectClient;
  identity: PublicIdentity;
  permissions: readonly PermissionScope[];
  disconnect: () => Promise<void>;
}> {
  let transport: ConnectTransport;

  if (isInIframe()) {
    transport = PostMessageTransport.forClient();
  } else if (hasExtension()) {
    transport = ExtensionTransport.forClient();
  } else {
    const savedSession = sessionStorage.getItem(SESSION_KEY);
    const popup = window.open(
      `${SPHERE_WALLET_URL}/connect?origin=${encodeURIComponent(location.origin)}`,
      'sphere-wallet',
      'width=420,height=650'
    );
    if (!popup) {
      throw Object.assign(new Error('Popup blocked. Please allow popups for this site.'), { code: ERROR_CODES.NOT_CONNECTED });
    }
    popupRef = popup;
    transport = PostMessageTransport.forClient({ target: popup, targetOrigin: SPHERE_WALLET_URL });
    await waitForHostReady();

    transportRef = transport;
    const client = new ConnectClient({
      transport,
      dapp: DAPP,
      network: SPHERE_NETWORKS.testnet2,
silent,
permissions: PERMISSIONS,
      resumeSessionId: savedSession ?? undefined,
    });
    clientRef = client;
    const result = await client.connect();
    sessionStorage.setItem(SESSION_KEY, result.sessionId);
    return {
      client,
      identity: result.identity,
      permissions: result.permissions,
      disconnect: () => disconnectFromSphere(client),
    };
  }

  transportRef = transport;
  const client = new ConnectClient({
    transport,
    dapp: DAPP,
    network: SPHERE_NETWORKS.testnet2,
silent,
permissions: PERMISSIONS,
  });
  clientRef = client;
  const result = await client.connect();
  return {
    client,
    identity: result.identity,
    permissions: result.permissions,
    disconnect: () => disconnectFromSphere(client),
  };
}

export async function disconnectFromSphere(client: ConnectClient): Promise<void> {
  try {
    await client.disconnect();
  } finally {
    sessionStorage.removeItem(SESSION_KEY);
    transportRef?.destroy?.();
    clientRef = null;
    transportRef = null;
    popupRef = null;
  }
}