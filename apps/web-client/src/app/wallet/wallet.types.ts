import {
  SignerWalletAdapter,
  WalletAdapter,
} from '@solana/wallet-adapter-base';
import { Wallet, WalletName } from '@solana/wallet-adapter-wallets';
import { PublicKey } from '@solana/web3.js';

export interface WalletState {
  wallets: Wallet[];
  selectedWallet: WalletName | null;
  wallet: Wallet | null;
  adapter: WalletAdapter | SignerWalletAdapter | null;
  connecting: boolean;
  disconnecting: boolean;
  connected: boolean;
  ready: boolean;
  publicKey: PublicKey | null;
  autoApprove: boolean;
}

export interface WalletConfig {
  localStorageKey?: string;
  autoConnect?: boolean;
}

export interface WalletOptions {
  wallets: Wallet[];
  config: WalletConfig;
}
