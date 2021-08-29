import { Injectable } from '@angular/core';
import { ComponentStore, tapResponse } from '@ngrx/component-store';
import {
  getPhantomWallet,
  getSolletWallet,
  Wallet,
  WalletName,
} from '@solana/wallet-adapter-wallets';
import { Observable } from 'rxjs';
import { concatMap, tap, withLatestFrom } from 'rxjs/operators';

const DEFAULT_WALLET_PROVIDER = WalletName.Sollet;

export interface WalletsState {
  wallets: Wallet[];
  selectedWallet: WalletName;
  connecting: boolean;
  disconnecting: boolean;
  connected: boolean;
}

@Injectable()
export class WalletsStore extends ComponentStore<WalletsState> {
  readonly wallets$ = this.select((state) => state.wallets);
  readonly selectedWallet$ = this.select((state) => state.selectedWallet);
  readonly connected$ = this.select((state) => state.connected);
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
      connected: false,
      connecting: false,
      disconnecting: false,
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

  readonly connect = this.effect((action$: Observable<void>) => {
    return action$.pipe(
      withLatestFrom(this.adapter$),
      tap(() => this.patchState({ connecting: true })),
      concatMap(([, adapter]) => adapter.connect()),
      tapResponse(
        () => this.patchState({ connecting: false, connected: true }),
        (error) => console.error(error)
      )
    );
  });

  readonly disconnect = this.effect((action$: Observable<void>) => {
    return action$.pipe(
      withLatestFrom(this.adapter$),
      tap(() => this.patchState({ disconnecting: true })),
      concatMap(([, adapter]) => adapter.disconnect()),
      tapResponse(
        () => this.patchState({ disconnecting: false, connected: false }),
        (error) => console.error(error)
      )
    );
  });
}
