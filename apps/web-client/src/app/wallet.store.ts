import { Inject, Injectable, InjectionToken, Optional } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import {
  SendTransactionOptions,
  SignerWalletAdapter,
  WalletAdapter,
  WalletError,
  WalletNotConnectedError,
  WalletNotReadyError,
} from '@solana/wallet-adapter-base';
import {
  getPhantomWallet,
  getSolletWallet,
  Wallet,
  WalletName,
} from '@solana/wallet-adapter-wallets';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
  BehaviorSubject,
  combineLatest,
  defer,
  from,
  Observable,
  of,
} from 'rxjs';
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

export type WalletEvent =
  | 'init'
  | 'connect'
  | 'disconnect'
  | 'selectWallet'
  | 'sendTransaction';

export interface SendTransactionPayload {
  transaction: Transaction;
  connection: Connection;
  options?: SendTransactionOptions;
}

export interface Action {
  type: WalletEvent;
  payload?: unknown;
}

export const LOCAL_STORAGE_WALLET_KEY = new InjectionToken(
  'localStorageWalletKey'
);

export const WALLET_AUTO_CONNECT = new InjectionToken('walletAutoConnect');

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
  autoApprove: boolean;
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

  constructor(
    @Optional()
    @Inject(LOCAL_STORAGE_WALLET_KEY)
    private localStorageKey: string,
    @Optional()
    @Inject(WALLET_AUTO_CONNECT)
    private autoConnect: boolean
  ) {
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
      autoApprove: false,
    });

    if (this.localStorageKey === null) {
      this.localStorageKey = 'walletName';
    }

    if (this.autoConnect === null) {
      this.autoConnect = false;
    }

    const walletName = localStorage.getItem(this.localStorageKey);
    this.selectWallet(
      walletName ? (walletName as WalletName) : WalletName.Sollet
    );
  }

  readonly handleAutoConnect = this.effect(() => {
    return combineLatest([this.adapter$, this.ready$]).pipe(
      filter(([adapter, ready]) => this.autoConnect && adapter && ready),
      tap(() => this.dispatcher.next({ type: 'connect' }))
    );
  });

  readonly handleSelectWallet = this.effect(() => {
    return this.actions$.pipe(
      filter((action) => action.type === 'selectWallet'),
      concatMap((action) => of(action).pipe(withLatestFrom(this.state$))),
      tap(([{ payload: walletName }, { wallets }]) => {
        localStorage.setItem(this.localStorageKey, walletName as string);
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
      concatMap(() =>
        of(null).pipe(withLatestFrom(this.adapter$, (_, adapter) => adapter))
      ),
      tap(() => this.patchState({ connecting: true })),
      concatMap((adapter) =>
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
      concatMap(() =>
        of(null).pipe(withLatestFrom(this.adapter$, (_, adapter) => adapter))
      ),
      tap(() => this.patchState({ disconnecting: true })),
      concatMap((adapter) =>
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
      concatMap((action) => of(action).pipe(withLatestFrom(this.state$))),

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

  readonly handleSendTransaction = this.effect(() => {
    return this.actions$.pipe(
      filter((action) => action.type === 'sendTransaction'),
      concatMap((action) => of(action).pipe(withLatestFrom(this.adapter$))),
      concatMap(([{ payload }, adapter]) => {
        const { transaction, connection, options } =
          payload as SendTransactionPayload;

        return from(
          defer(() => adapter.sendTransaction(transaction, connection, options))
        ).pipe(catchError(() => of(null)));
      })
    );
  });

  readonly onConnect = this.effect(() => {
    return this.adapter$.pipe(
      isNotNull,
      switchMap((adapter) =>
        of(adapter).pipe(
          fromAdapterEvent('connect'),
          tap(() =>
            this.patchState({
              connected: true,
              publicKey: adapter.publicKey,
              autoApprove: adapter.autoApprove,
            })
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

  sendTransaction(
    transaction: Transaction,
    connection: Connection,
    options?: SendTransactionOptions
  ) {
    const { adapter, connected } = this.get();

    if (!adapter) {
      throw new WalletNotSelectedError();
    }

    if (!connected) {
      throw new WalletNotConnectedError();
    }

    this.dispatcher.next({
      type: 'sendTransaction',
      payload: { transaction, connection, options },
    });
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
