import {
  SendTransactionOptions,
  SignerWalletAdapter,
  WalletAdapter,
} from '@solana/wallet-adapter-base';
import { Wallet, WalletName } from '@solana/wallet-adapter-wallets';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';

export type WalletEvent =
  | 'init'
  | 'connect'
  | 'disconnect'
  | 'selectWallet'
  | 'sendTransaction'
  | 'signTransaction'
  | 'signAllTransactions';

export interface SendTransactionPayload {
  transaction: Transaction;
  connection: Connection;
  options?: SendTransactionOptions;
}

export interface Action {
  type: WalletEvent;
  payload?: unknown;
}

export interface WalletsState {
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
