import { Connection, ConnectionConfig } from '@solana/web3.js';

export interface ConnectionState {
  connection: Connection;
}

export interface ConnectionOptions {
  endpoint: string;
  config: ConnectionConfig;
}
