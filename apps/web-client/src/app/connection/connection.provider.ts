import { ConnectionConfig } from '@solana/web3.js';

import { ConnectionStore } from './connection.store';
import { CONNECTION_OPTIONS } from './connection.tokens';

export const connectionProvider = (
  endpoint: string,
  config?: ConnectionConfig
) => [
  {
    provide: CONNECTION_OPTIONS,
    useValue: {
      endpoint,
      config: config || { commitment: 'confirmed' },
    },
  },
  ConnectionStore,
];
