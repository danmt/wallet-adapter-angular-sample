import { Wallet } from '@solana/wallet-adapter-wallets';

import { WalletStore } from './wallet.store';
import { WALLET_OPTIONS } from './wallet.tokens';
import { WalletConfig } from './wallet.types';

export const walletProvider = (wallets: Wallet[], config?: WalletConfig) => [
  {
    provide: WALLET_OPTIONS,
    useValue: {
      wallets,
      config: {
        autoConnect: config?.autoConnect || false,
        localStorageKey: config?.localStorageKey || 'walletName',
      },
    },
  },
  WalletStore,
];
