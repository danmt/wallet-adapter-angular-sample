import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import {
  SignerWalletAdapter,
  WalletAdapter,
} from '@solana/wallet-adapter-base';
import {
  getPhantomWallet,
  getSolletWallet,
  Wallet,
  WalletName,
} from '@solana/wallet-adapter-wallets';
import { defer, from, Observable, of } from 'rxjs';
import {
  catchError,
  concatMap,
  filter,
  tap,
  withLatestFrom,
} from 'rxjs/operators';

import { fromAdapterEvent } from './from-adapter-event';
import { isNotNull } from './not-null';

export interface WalletsState {
  wallets: Wallet[];
  selectedWallet: WalletName | null;
  wallet: Wallet | null;
  adapter: WalletAdapter | SignerWalletAdapter | null;
  connecting: boolean;
  disconnecting: boolean;
  connected: boolean;
  ready: boolean;
}

@Injectable()
export class WalletsStore extends ComponentStore<WalletsState> {
  readonly wallets$ = this.select((state) => state.wallets);
  readonly selectedWallet$ = this.select((state) => state.selectedWallet);
  readonly connected$ = this.select((state) => state.connected);
  readonly adapter$ = this.select((state) => state.adapter);

  constructor() {
    super({
      wallets: [getSolletWallet(), getPhantomWallet()],
      selectedWallet: null,
      wallet: null,
      adapter: null,
      connected: false,
      connecting: false,
      disconnecting: false,
      ready: false,
    });

    this.state$.subscribe((a) => console.log(a));
  }

  readonly selectWallet = this.effect((walletName$: Observable<WalletName>) => {
    return walletName$.pipe(
      withLatestFrom(this.state$),
      filter(
        ([walletName, { selectedWallet }]) => walletName !== selectedWallet
      ),
      tap(([walletName, { wallets }]) => {
        const wallet = wallets.find(({ name }) => name === walletName);
        const adapter = wallet ? wallet.adapter() : null;
        this.patchState({
          selectedWallet: walletName,
          adapter,
          wallet,
          ready: adapter.ready || false,
        });
      })
    );
  });

  readonly connect = this.effect((action$: Observable<void>) => {
    return action$.pipe(
      withLatestFrom(this.state$),
      filter(
        ([, state]) =>
          !state.connected && !state.connecting && !state.disconnecting
      ),
      tap(() => this.patchState({ connecting: true })),
      concatMap(([, { adapter }]) =>
        from(defer(() => adapter.connect())).pipe(catchError(() => of(null)))
      ),
      tap(() => this.patchState({ connecting: false }))
    );
  });

  readonly disconnect = this.effect((action$: Observable<void>) => {
    return action$.pipe(
      withLatestFrom(this.state$),
      filter(([, { disconnecting }]) => disconnecting),
      tap(() => this.patchState({ disconnecting: true })),
      concatMap(([, { adapter }]) =>
        from(defer(() => adapter.disconnect())).pipe(catchError(() => of(null)))
      ),
      tap(() => this.patchState({ disconnecting: false }))
    );
  });

  onConnect = this.effect(() => {
    return this.adapter$.pipe(
      isNotNull,
      fromAdapterEvent('connect'),
      tap(() => this.patchState({ connected: true }))
    );
  });

  onDisconnect = this.effect(() => {
    return this.adapter$.pipe(
      isNotNull,
      fromAdapterEvent('disconnect'),
      tap(() => this.patchState({ connected: false }))
    );
  });

  onReady = this.effect(() => {
    return this.adapter$.pipe(
      isNotNull,
      fromAdapterEvent('ready'),
      tap(() => this.patchState({ ready: true }))
    );
  });

  onError = this.effect(() => {
    return this.adapter$.pipe(
      isNotNull,
      fromAdapterEvent('error'),
      tap((error) => this.logError(error))
    );
  });

  private logError(error: unknown) {
    if (typeof error === 'string') {
      console.error(error);
    } else if (error instanceof Error) {
      console.error(error);
    } else {
      console.error('Wrong error type');
    }
  }
}
