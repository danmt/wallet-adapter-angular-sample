import { Injectable } from '@angular/core';
import { ComponentStore, tapResponse } from '@ngrx/component-store';
import {
  getPhantomWallet,
  getSolletWallet,
  Wallet,
  WalletName,
} from '@solana/wallet-adapter-wallets';
import { Observable } from 'rxjs';
import { concatMap, withLatestFrom } from 'rxjs/operators';

const DEFAULT_WALLET_PROVIDER = WalletName.Sollet;

export interface WalletsState {
  wallets: Wallet[];
  selectedWallet: WalletName;
}

@Injectable()
export class WalletsStore extends ComponentStore<WalletsState> {
  readonly wallets$ = this.select((state) => state.wallets);
  readonly selectedWallet$ = this.select((state) => state.selectedWallet);
  readonly adapter$ = this.select((state) => {
    const wallet = state.wallets.find(
      ({ name }) => name === state.selectedWallet
    );
    return wallet ? wallet.adapter() : null;
  });

  constructor() {
    super({
      wallets: [getSolletWallet(), getPhantomWallet()],
      selectedWallet: DEFAULT_WALLET_PROVIDER,
    });
  }

  readonly selectWallet = this.effect((walletName$: Observable<WalletName>) => {
    return walletName$.pipe(
      tapResponse(
        (walletName) => this.patchState({ selectedWallet: walletName }),
        (error) => console.error(error)
      )
    );
  });

  readonly connect = this.effect((entry$: Observable<void>) => {
    return entry$.pipe(
      withLatestFrom(this.adapter$),
      concatMap(([, adapter]) => adapter.connect())
    );
  });
}
