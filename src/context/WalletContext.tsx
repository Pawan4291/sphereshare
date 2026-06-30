import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { WalletIdentity } from '../types';
import {
  connectToSphere,
  disconnectFromSphere,
  SESSION_KEY,
  getErrorMessage,
  ERROR_CODES,
} from '../lib/sphere';

interface WalletContextValue {
  connected: boolean;
  identity: WalletIdentity | null;
  client: any | null;
  connecting: boolean;
  error: string | null;
  connect: (silent?: boolean) => Promise<void>;
  disconnect: () => Promise<void>;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextValue>({
  connected: false,
  identity: null,
  client: null,
  connecting: false,
  error: null,
  connect: async () => {},
  disconnect: async () => {},
  clearError: () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [identity, setIdentity] = useState<WalletIdentity | null>(null);
  const [client, setClient] = useState<any | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disconnectRef = useRef<(() => Promise<void>) | null>(null);

  const connect = useCallback(async (silent = false) => {
    setConnecting(true);
    setError(null);
    try {
      const result = await connectToSphere(silent);
      const id = result.connection.identity;

      setConnected(true);
      setIdentity({
        address: id.directAddress ?? id.chainPubkey ?? '',
        nametag: id.nametag,
        chainPubkey: id.chainPubkey,
      });
      setClient(result.client);
      disconnectRef.current = result.disconnect;

      // Listen for wallet lock
      result.client.on('wallet:locked', async () => {
        setConnected(false);
        setIdentity(null);
        setClient(null);
        sessionStorage.removeItem(SESSION_KEY);
      });

      // Listen for identity changes
      result.client.on('identity:changed', (newId: any) => {
        setIdentity({
          address: newId?.directAddress ?? newId?.chainPubkey ?? '',
          nametag: newId?.nametag,
          chainPubkey: newId?.chainPubkey,
        });
      });
    } catch (err: any) {
      const code = (err as { code?: number })?.code;
      if (code === ERROR_CODES.USER_REJECTED || code === ERROR_CODES.INTENT_CANCELLED) {
        // User cancelled — not an error to display
        setError(null);
      } else if (code) {
        setError(getErrorMessage(code));
      } else if (!silent) {
        setError(err?.message ?? 'Failed to connect to Sphere wallet.');
      }
      setConnected(false);
      setIdentity(null);
      setClient(null);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (disconnectRef.current) {
      await disconnectFromSphere(disconnectRef.current);
    }
    setConnected(false);
    setIdentity(null);
    setClient(null);
    disconnectRef.current = null;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // Attempt silent auto-connect on mount if session exists
  useEffect(() => {
    const savedSession = sessionStorage.getItem(SESSION_KEY);
    if (savedSession) {
      connect(true).catch(() => {
        sessionStorage.removeItem(SESSION_KEY);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WalletContext.Provider
      value={{ connected, identity, client, connecting, error, connect, disconnect, clearError }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
