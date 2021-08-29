import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import {
  SignerWalletAdapter,
  WalletAdapter,
  WalletError,
  WalletNotReadyError,
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

export class WalletNotSelectedError extends WalletError {
  constructor() {
    super();
    this.name = 'WalletNotSelectedError';
  }
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

  private readonly handleConnect = this.effect((action$: Observable<void>) => {
    return action$.pipe(
      withLatestFrom(this.adapter$),
      tap(() => this.patchState({ connecting: true })),
      concatMap(([, adapter]) =>
        from(defer(() => adapter.connect())).pipe(
          tap(() => this.patchState({ connecting: false })),
          catchError(() => of(null))
        )
      )
    );
  });

  private readonly handleDisconnect = this.effect(
    (action$: Observable<void>) => {
      return action$.pipe(
        withLatestFrom(this.adapter$),
        tap(() => this.patchState({ disconnecting: true })),
        concatMap(([, adapter]) =>
          from(defer(() => adapter.disconnect())).pipe(
            tap(() => this.patchState({ disconnecting: false })),
            catchError(() => of(null))
          )
        )
      );
    }
  );

  readonly onConnect = this.effect(() => {
    return this.adapter$.pipe(
      isNotNull,
      fromAdapterEvent('connect'),
      tap(() => this.patchState({ connected: true }))
    );
  });

  readonly onDisconnect = this.effect(() => {
    return this.adapter$.pipe(
      isNotNull,
      fromAdapterEvent('disconnect'),
      tap(() => this.patchState({ connected: false }))
    );
  });

  readonly onReady = this.effect(() => {
    return this.adapter$.pipe(
      isNotNull,
      fromAdapterEvent('ready'),
      tap(() => this.patchState({ ready: true }))
    );
  });

  readonly onError = this.effect(() => {
    return this.adapter$.pipe(
      isNotNull,
      fromAdapterEvent('error'),
      tap((error) => this.logError(error))
    );
  });

  connect() {
    const { ready, wallet, adapter, connected, connecting, disconnecting } =
      this.get();

    if (!connected && !connecting && !disconnecting) {
      if (!wallet || !adapter) {
        throw new WalletNotSelectedError();
      }
      if (!ready) {
        window.open(wallet.url, '_blank');
        throw new WalletNotReadyError();
      }

      this.handleConnect();
    }
  }

  disconnect() {
    const { disconnecting } = this.get();

    if (!disconnecting) {
      this.handleDisconnect();
    }
  }

  private logError(error: unknown) {
    if (typeof error === 'string') {
      console.error(error);
    } else if (error instanceof WalletError) {
      console.error(error);
    } else {
      console.error(error);
    }
  }
}
