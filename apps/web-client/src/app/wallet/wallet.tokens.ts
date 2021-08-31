import { InjectionToken } from '@angular/core';

import { WalletOptions } from './wallet.types';

export const WALLET_OPTIONS = new InjectionToken<WalletOptions>(
  'walletOptions'
);
