import { Wallet } from '@solana/wallet-adapter-wallets';
import { WALLET_CONFIG, WalletConfig } from './utils';
import { WalletsStore } from './wallet.store';

export const walletProvider = (wallets: Wallet[], config?: WalletConfig) => [
  {
    provide: WALLET_CONFIG,
    useValue: {
      wallets,
      autoConnect: config?.autoConnect || false,
      localStorageKey: config?.localStorageKey || 'walletName',
    },
  },
  WalletsStore,
];
