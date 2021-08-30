import { Inject, Injectable, Optional } from '@angular/core';
import { ComponentStore, tapResponse } from '@ngrx/component-store';
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

import { fromAdapterEvent, isNotNull } from './operators';
import {
  Action,
  LOCAL_STORAGE_WALLET_KEY,
  SendTransactionPayload,
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

  readonly handleSendTransaction = this.effect(() => {
    return this.actions$.pipe(
      filter((action) => action.type === 'sendTransaction'),
      concatMap((action) => of(action).pipe(withLatestFrom(this.adapter$))),
      concatMap(([{ payload }, adapter]) => {
        const { transaction, connection, options } =
          payload as SendTransactionPayload;

        return from(
          defer(() => adapter.sendTransaction(transaction, connection, options))
        ).pipe(
          tapResponse(
            (txId) => console.log(txId),
            (error) => this.logError(error)
          )
        );
      })
    );
  });

  readonly handleSignTransaction = this.effect(() => {
    return this.actions$.pipe(
      filter((action) => action.type === 'signTransaction'),
      concatMap((action) => of(action).pipe(withLatestFrom(this.adapter$))),
      concatMap(([{ payload: transaction }, adapter]) =>
        from(defer(() => adapter.signTransaction(transaction))).pipe(
          tapResponse(
            (signedTransaction) => console.log(signedTransaction),
            (error) => this.logError(error)
          )
        )
      )
    );
  });

  readonly handleSignAllTransactions = this.effect(() => {
    return this.actions$.pipe(
      filter((action) => action.type === 'signAllTransactions'),
      concatMap((action) => of(action).pipe(withLatestFrom(this.adapter$))),
      concatMap(([{ payload: transactions }, adapter]) =>
        from(defer(() => adapter.signAllTransactions(transactions))).pipe(
          tapResponse(
            (signedTransactions) => console.log(signedTransactions),
            (error) => this.logError(error)
          )
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

  signTransaction(transaction: Transaction) {
    const { adapter, connected } = this.get();

    if (!adapter) {
      throw new WalletNotSelectedError();
    }

    if (!connected) {
      throw new WalletNotConnectedError();
    }

    if ('signTransaction' in adapter) {
      this.dispatcher.next({
        type: 'signTransaction',
        payload: transaction,
      });
    }
  }

  signAllTransactions(transactions: Transaction[]) {
    const { adapter, connected } = this.get();

    if (!adapter) {
      throw new WalletNotSelectedError();
    }

    if (!connected) {
      throw new WalletNotConnectedError();
    }

    if ('signAllTransactions' in adapter) {
      this.dispatcher.next({
        type: 'signAllTransactions',
        payload: transactions,
      });
    }
  }

  private logError(error: unknown) {
    if (typeof error === 'string') {
      console.error(error);
    } else {
      console.error(error);
    }
  }
}
