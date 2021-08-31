import { Inject, Injectable, Optional } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import {
  SendTransactionOptions,
  WalletNotConnectedError,
  WalletNotReadyError,
} from '@solana/wallet-adapter-base';
import {
  getPhantomWallet,
  getSolletWallet,
  WalletName,
} from '@solana/wallet-adapter-wallets';
import { Connection, Transaction } from '@solana/web3.js';
import {
  BehaviorSubject,
  combineLatest,
  defer,
  EMPTY,
  from,
  Observable,
  of,
  throwError,
} from 'rxjs';
import {
  catchError,
  concatMap,
  filter,
  first,
  map,
  switchMap,
  tap,
  withLatestFrom,
} from 'rxjs/operators';

import { fromAdapterEvent, isNotNull } from './operators';
import {
  Action,
  LOCAL_STORAGE_WALLET_KEY,
  SignAllTransactionsNotFoundError,
  SignTransactionNotFoundError,
  WALLET_AUTO_CONNECT,
  WalletNotSelectedError,
  WalletsState,
} from './utils';

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
    private _localStorageKey: string,
    @Optional()
    @Inject(WALLET_AUTO_CONNECT)
    private _autoConnect: boolean
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

    if (this._localStorageKey === null) {
      this._localStorageKey = 'walletName';
    }

    if (this._autoConnect === null) {
      this._autoConnect = false;
    }

    const walletName = localStorage.getItem(this._localStorageKey);
    this.selectWallet(
      walletName ? (walletName as WalletName) : WalletName.Sollet
    );
  }

  readonly autoConnect = this.effect(() => {
    return combineLatest([this.adapter$, this.ready$]).pipe(
      filter(([adapter, ready]) => this._autoConnect && adapter && ready),
      tap(() => this.dispatcher.next({ type: 'connect' }))
    );
  });

  readonly connect = this.effect((action$: Observable<void>) => {
    return action$.pipe(
      concatMap(() =>
        of(null).pipe(withLatestFrom(this.state$, (_, state) => state))
      ),
      filter(
        ({ connected, connecting, disconnecting }) =>
          !connected && !connecting && !disconnecting
      ),
      tap(() => this.patchState({ connecting: true })),
      concatMap(({ adapter, wallet, ready }) => {
        if (!wallet || !adapter) {
          this.logError(new WalletNotSelectedError());
          return of(null);
        }

        if (!ready) {
          window.open(wallet.url, '_blank');
          this.logError(new WalletNotReadyError());
          return of(null);
        }

        return from(defer(() => adapter.connect())).pipe(
          catchError(() => of(null))
        );
      }),
      tap(() => this.patchState({ connecting: false }))
    );
  });

  readonly disconnect = this.effect((action$: Observable<void>) => {
    return action$.pipe(
      concatMap(() =>
        of(null).pipe(withLatestFrom(this.state$, (_, state) => state))
      ),
      filter(({ disconnecting }) => !disconnecting),
      tap(() => this.patchState({ disconnecting: true })),
      concatMap(({ adapter }) =>
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
      concatMap(([walletName, { adapter, wallets }]) =>
        (adapter ? from(defer(() => adapter.disconnect())) : of(null)).pipe(
          tap(() => {
            const wallet = wallets.find(({ name }) => name === walletName);
            const adapter = wallet ? wallet.adapter() : null;
            this.patchState({
              selectedWallet: walletName as WalletName,
              adapter,
              wallet,
              ready: adapter.ready || false,
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

  sendTransaction(
    transaction: Transaction,
    connection: Connection,
    options?: SendTransactionOptions
  ): Observable<string> {
    return this.state$.pipe(
      first(),
      concatMap(({ adapter, connected }) => {
        if (!adapter) {
          return throwError(new WalletNotSelectedError());
        }

        if (!connected) {
          return throwError(new WalletNotConnectedError());
        }

        return from(
          defer(() => adapter.sendTransaction(transaction, connection, options))
        ).pipe(
          map((txId) => txId as string),
          catchError(() => EMPTY)
        );
      })
    );
  }

  signTransaction(transaction: Transaction): Observable<Transaction> {
    return this.state$.pipe(
      first(),
      concatMap(({ adapter, connected }) => {
        if (!adapter) {
          return throwError(new WalletNotSelectedError());
        }

        if (!connected) {
          return throwError(new WalletNotConnectedError());
        }

        if (!('signTransaction' in adapter)) {
          return throwError(new SignTransactionNotFoundError());
        }

        return from(defer(() => adapter.signTransaction(transaction))).pipe(
          map((transaction) => transaction as Transaction)
        );
      })
    );
  }

  signAllTransactions(transactions: Transaction[]): Observable<Transaction[]> {
    return this.state$.pipe(
      first(),
      concatMap(({ adapter, connected }) => {
        if (!adapter) {
          return throwError(new WalletNotSelectedError());
        }

        if (!connected) {
          return throwError(new WalletNotConnectedError());
        }

        if (!('signAllTransactions' in adapter)) {
          return throwError(new SignAllTransactionsNotFoundError());
        }

        return from(
          defer(() => adapter.signAllTransactions(transactions))
        ).pipe(map((transactions) => transactions as Transaction[]));
      })
    );
  }

  private logError(error: unknown) {
    console.error(error);
  }
}
