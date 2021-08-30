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
import { PublicKey } from '@solana/web3.js';
import { BehaviorSubject, defer, from, Observable, of } from 'rxjs';
import {
  catchError,
  concatMap,
  filter,
  switchMap,
  tap,
  withLatestFrom,
} from 'rxjs/operators';

import { fromAdapterEvent } from './from-adapter-event';
import { isNotNull } from './not-null';

interface Action {
  type: string;
  payload?: unknown;
}

const DEFAULT_WALLET_PROVIDER = WalletName.Sollet;

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
  publicKey: PublicKey | null;
}

@Injectable()
export class WalletsStore extends ComponentStore<WalletsState> {
  private readonly dispatcher = new BehaviorSubject<Action>({ type: 'init' });
  private readonly actions$ = this.dispatcher.asObservable();
  readonly wallets$ = this.select((state) => state.wallets);
  readonly selectedWallet$ = this.select((state) => state.selectedWallet);
  readonly connected$ = this.select((state) => state.connected);
  readonly adapter$ = this.select((state) => state.adapter);
  readonly publicKey$ = this.select((state) => state.publicKey);
  readonly ready$ = this.select((state) => state.ready);

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
      publicKey: null,
    });

    const walletName = localStorage.getItem('walletName');
    this.selectWallet(
      walletName ? (walletName as WalletName) : DEFAULT_WALLET_PROVIDER
    );
  }

  readonly handleSelectWallet = this.effect(() => {
    return this.actions$.pipe(
      filter((action) => action.type === 'selectWallet'),
      withLatestFrom(this.state$),
      tap(([{ payload: walletName }, { wallets }]) => {
        localStorage.setItem('walletName', walletName as string);
        const wallet = wallets.find(({ name }) => name === walletName);
        const adapter = wallet ? wallet.adapter() : null;
        this.patchState({
          selectedWallet: walletName as WalletName,
          adapter,
          wallet,
          ready: adapter.ready || false,
        });
      })
    );
  });

  readonly handleConnect = this.effect(() => {
    return this.actions$.pipe(
      filter((action) => action.type === 'connect'),
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

  readonly handleDisconnect = this.effect(() => {
    return this.actions$.pipe(
      filter((action) => action.type === 'disconnect'),
      withLatestFrom(this.adapter$),
      tap(() => this.patchState({ disconnecting: true })),
      concatMap(([, adapter]) =>
        from(defer(() => adapter.disconnect())).pipe(
          tap(() => this.patchState({ disconnecting: false })),
          catchError(() => of(null))
        )
      )
    );
  });

  readonly selectWallet = this.effect((walletName$: Observable<WalletName>) => {
    return walletName$.pipe(
      isNotNull,
      withLatestFrom(this.state$),
      filter(
        ([walletName, { selectedWallet }]) => walletName !== selectedWallet
      ),
      concatMap(([walletName, { adapter }]) =>
        (adapter ? from(defer(() => adapter.disconnect())) : of(null)).pipe(
          tap(() => {
            this.dispatcher.next({
              type: 'selectWallet',
              payload: walletName,
            });
          }),
          catchError(() => of(null))
        )
      )
    );
  });

  readonly onConnect = this.effect(() => {
    return this.adapter$.pipe(
      isNotNull,
      switchMap((adapter) =>
        of(adapter).pipe(
          fromAdapterEvent('connect'),
          tap(() =>
            this.patchState({ connected: true, publicKey: adapter.publicKey })
          )
        )
      )
    );
  });

  readonly onDisconnect = this.effect(() => {
    return this.adapter$.pipe(
      isNotNull,
      fromAdapterEvent('disconnect'),
      tap(() =>
        this.patchState({
          connected: false,
          connecting: false,
          disconnecting: false,
          publicKey: null,
        })
      )
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

      this.dispatcher.next({ type: 'connect' });
    }
  }

  disconnect() {
    const { disconnecting } = this.get();

    if (!disconnecting) {
      this.dispatcher.next({ type: 'disconnect' });
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
