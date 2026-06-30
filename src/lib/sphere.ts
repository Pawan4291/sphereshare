import { autoConnect, SPHERE_NETWORKS } from '@unicitylabs/sphere-sdk/connect/browser'
export const SPHERE_WALLET_URL = 'https://sphere.unicity.network';
export const SPHERE_NETWORK_TESTNET2 = { id: 4, name: 'testnet2' };
export const SESSION_KEY = 'sphereshare-session';

export interface SphereClient {
  query: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
  intent: (action: string, params?: Record<string, unknown>) => Promise<unknown>;
  on: (event: string, handler: (data: unknown) => void) => () => void;
  disconnect: () => Promise<void>;
}

export interface SphereConnectResult {
  client: SphereClient;
  connection: {
    sessionId: string;
    identity: {
      chainPubkey: string;
      directAddress?: string;
      nametag?: string;
    };
    permissions: string[];
  };
  transport: 'iframe' | 'extension' | 'popup';
  disconnect: () => Promise<void>;
}

export const ERROR_CODES = {
  NOT_CONNECTED: 4001,
  PERMISSION_DENIED: 4002,
  USER_REJECTED: 4003,
  SESSION_EXPIRED: 4004,
  ORIGIN_BLOCKED: 4005,
  RATE_LIMITED: 4006,
  UNSUPPORTED_PROTOCOL_VERSION: 4007,
  INCOMPATIBLE_NETWORK: 4008,
  INSUFFICIENT_BALANCE: 4100,
  INVALID_RECIPIENT: 4101,
  TRANSFER_FAILED: 4102,
  INTENT_CANCELLED: 4200,
} as const;

export function getErrorMessage(code: number): string {
  switch (code) {
    case ERROR_CODES.INCOMPATIBLE_NETWORK:
      return 'Your Sphere wallet is on the wrong network. Please switch to testnet2.';
    case ERROR_CODES.INSUFFICIENT_BALANCE:
      return 'Insufficient balance to complete this transaction.';
    case ERROR_CODES.INVALID_RECIPIENT:
      return 'Invalid recipient address — could not resolve to a wallet.';
    case ERROR_CODES.USER_REJECTED:
      return 'Transaction was rejected by the user.';
    case ERROR_CODES.SESSION_EXPIRED:
      return 'Wallet session expired. Please reconnect.';
    case ERROR_CODES.PERMISSION_DENIED:
      return 'Permission denied by wallet.';
    case ERROR_CODES.TRANSFER_FAILED:
      return 'Transfer failed on the network. Please try again.';
    case ERROR_CODES.INTENT_CANCELLED:
      return 'Action was cancelled.';
    case ERROR_CODES.UNSUPPORTED_PROTOCOL_VERSION:
      return 'Wallet version incompatible. Please update your Sphere wallet.';
    case ERROR_CODES.RATE_LIMITED:
      return 'Too many requests. Please wait a moment.';
    default:
      return 'An unexpected error occurred.';
  }
}

/**
 * Connects to the Sphere wallet via PostMessage popup transport (P3 mode).
 * Implements the Sphere Connect v2 protocol wire format.
 *
 * The wallet popup opens at SPHERE_WALLET_URL/connect.
 * SphereShare sends sphere_connect_request and waits for sphere_connect_approved.
 * After handshake, all queries and intents are sent via postMessage.
 *
 * Error codes discriminated on .code (not instanceof), per CONNECT.md spec.
 */
export async function connectToSphere(silent = false): Promise<SphereConnectResult> {
  if (silent) {
    const savedSession = sessionStorage.getItem(SESSION_KEY);
    if (!savedSession) {
      throw Object.assign(new Error('No saved session'), { code: ERROR_CODES.NOT_CONNECTED });
    }
  }

  return new Promise((resolve, reject) => {
    const walletPopup = window.open(
      `${SPHERE_WALLET_URL}/connect`,
      'sphere-wallet',
      'width=420,height=700,scrollbars=no,resizable=no,toolbar=no,menubar=no'
    );

    if (!walletPopup) {
      reject(Object.assign(
        new Error('Popup was blocked. Please allow popups for this site and try again.'),
        { code: ERROR_CODES.NOT_CONNECTED }
      ));
      return;
    }

    const eventHandlers: Map<string, Set<(data: unknown) => void>> = new Map();
    let handshakeDone = false;

    const approvalTimeout = setTimeout(() => {
      if (!handshakeDone) {
        cleanup();
        reject(Object.assign(
          new Error('Connection timed out. Make sure Sphere wallet is open at sphere.unicity.network.'),
          { code: ERROR_CODES.NOT_CONNECTED }
        ));
      }
    }, 90000);

    const cleanup = () => {
      window.removeEventListener('message', messageListener);
      eventHandlers.clear();
      clearTimeout(approvalTimeout);
    };

    const messageListener = (event: MessageEvent) => {
      if (event.origin !== SPHERE_WALLET_URL && event.origin !== location.origin) return;
      const msg = event.data as Record<string, unknown>;
      if (!msg || typeof msg !== 'object') return;

      const type = msg.type as string;

      if (type === 'sphere_connect_approved' || type === 'SPHERE_CONNECT_APPROVED') {
        clearTimeout(approvalTimeout);
        handshakeDone = true;

        const rawIdentity = (msg.identity ?? {}) as Record<string, string>;
        const identity = {
          chainPubkey: (rawIdentity.chainPubkey ?? rawIdentity.address ?? '') as string,
          directAddress: (rawIdentity.directAddress ?? rawIdentity.address) as string | undefined,
          nametag: rawIdentity.nametag as string | undefined,
        };

        const sessionId = (msg.sessionId as string) ?? crypto.randomUUID();
        sessionStorage.setItem(SESSION_KEY, sessionId);

        const client: SphereClient = buildClient(walletPopup, eventHandlers, cleanup);

        resolve({
          client,
          connection: {
            sessionId,
            identity,
            permissions: (msg.permissions as string[]) ?? [],
          },
          transport: 'popup',
          disconnect: async () => {
            cleanup();
            sessionStorage.removeItem(SESSION_KEY);
          },
        });
      }

      if (type === 'sphere_connect_rejected' || type === 'SPHERE_CONNECT_REJECTED') {
        clearTimeout(approvalTimeout);
        cleanup();
        reject(Object.assign(new Error('Connection rejected by wallet.'), { code: ERROR_CODES.USER_REJECTED }));
      }

      if (type === 'sphere_error') {
        clearTimeout(approvalTimeout);
        cleanup();
        const errCode = (msg.code as number) ?? ERROR_CODES.NOT_CONNECTED;
        reject(Object.assign(new Error((msg.message as string) ?? 'Wallet error'), { code: errCode }));
      }

      // Push events from wallet to dApp listeners
      if (type === 'sphere_event') {
        const evtName = msg.event as string;
        const handlers = eventHandlers.get(evtName);
        if (handlers) handlers.forEach((h) => h(msg.data));
      }

      // wallet:locked auto-pushed (no subscribe needed)
      if (type === 'wallet:locked' || type === 'WALLET_EVENTS.LOCKED') {
        const handlers = eventHandlers.get('wallet:locked');
        if (handlers) handlers.forEach((h) => h(null));
      }

      if (type === 'identity:changed') {
        const handlers = eventHandlers.get('identity:changed');
        if (handlers) handlers.forEach((h) => h(msg.identity));
      }
    };

    window.addEventListener('message', messageListener);

    // Send handshake after popup has time to load
    const sendHandshake = () => {
      if (walletPopup.closed) {
        cleanup();
        reject(Object.assign(new Error('Wallet popup was closed before connecting.'), { code: ERROR_CODES.USER_REJECTED }));
        return;
      }
      try {
        walletPopup.postMessage(
          {
            type: 'sphere_connect_request',
            dapp: {
              name: 'SphereShare',
              url: location.origin,
              description: 'Split bills and send bulk payouts on Unicity testnet2',
            },
            network: SPHERE_NETWORK_TESTNET2,
            silent,
            sdkVersion: '1.6.0',
            protocolVersion: '2.0',
            permissions: [
              'identity:read',
              'balance:read',
              'tokens:read',
              'history:read',
              'events:subscribe',
              'resolve:peer',
              'transfer:request',
              'payment:request',
              'dm:request',
              'dm:read',
              'dm:manage',
              'sign:request',
              'mint:request',
            ],
          },
          SPHERE_WALLET_URL
        );
      } catch {
        setTimeout(() => {
          if (!handshakeDone) {
            cleanup();
            reject(Object.assign(new Error('Failed to communicate with Sphere wallet.'), { code: ERROR_CODES.NOT_CONNECTED }));
          }
        }, 5000);
      }
    };

    setTimeout(sendHandshake, 1500);
  });
}

/**
 * Build a SphereClient that communicates with an open wallet popup.
 */
function buildClient(
  walletPopup: Window,
  eventHandlers: Map<string, Set<(data: unknown) => void>>,
  _cleanup: () => void
): SphereClient {
  return {
    query: async (method: string, params?: Record<string, unknown>) => {
      if (walletPopup.closed) {
        throw Object.assign(new Error('Wallet disconnected'), { code: ERROR_CODES.NOT_CONNECTED });
      }
      return new Promise((res, rej) => {
        const id = crypto.randomUUID();
        const t = setTimeout(
          () => rej(Object.assign(new Error('Query timeout'), { code: ERROR_CODES.NOT_CONNECTED })),
          30000
        );
        const h = (e: MessageEvent) => {
          if ((e.data as Record<string, unknown>)?.id !== id) return;
          clearTimeout(t);
          window.removeEventListener('message', h);
          const data = e.data as Record<string, unknown>;
          if (data.error) {
            const err = data.error as Record<string, unknown>;
            rej(Object.assign(new Error(err.message as string), { code: err.code }));
          } else {
            res(data.result);
          }
        };
        window.addEventListener('message', h);
        walletPopup.postMessage(
          { type: 'sphere_query', id, method, params },
          SPHERE_WALLET_URL
        );
      });
    },

    intent: async (action: string, params?: Record<string, unknown>) => {
      if (walletPopup.closed) {
        throw Object.assign(new Error('Wallet disconnected'), { code: ERROR_CODES.NOT_CONNECTED });
      }
      walletPopup.focus();
      return new Promise((res, rej) => {
        const id = crypto.randomUUID();
        const t = setTimeout(
          () => rej(Object.assign(new Error('Intent timeout'), { code: ERROR_CODES.INTENT_CANCELLED })),
          120000
        );
        const h = (e: MessageEvent) => {
          if ((e.data as Record<string, unknown>)?.id !== id) return;
          clearTimeout(t);
          window.removeEventListener('message', h);
          const data = e.data as Record<string, unknown>;
          if (data.error) {
            const err = data.error as Record<string, unknown>;
            rej(Object.assign(new Error(err.message as string), { code: err.code }));
          } else {
            res(data.result);
          }
        };
        window.addEventListener('message', h);
        walletPopup.postMessage(
          { type: 'sphere_intent', id, action, params },
          SPHERE_WALLET_URL
        );
      });
    },

    on: (event: string, handler: (data: unknown) => void) => {
      if (!eventHandlers.has(event)) eventHandlers.set(event, new Set());
      eventHandlers.get(event)!.add(handler);
      return () => {
        eventHandlers.get(event)?.delete(handler);
      };
    },

    disconnect: async () => {
      _cleanup();
    },
  };
}

export async function disconnectFromSphere(disconnect: () => Promise<void>): Promise<void> {
  try {
    await disconnect();
  } finally {
    sessionStorage.removeItem(SESSION_KEY);
  }
}
