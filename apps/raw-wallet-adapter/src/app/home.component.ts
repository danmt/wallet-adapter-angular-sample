import { Component } from '@angular/core';
import { WalletName, WalletReadyState } from '@solana/wallet-adapter-base';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { encode } from 'bs58';
import { defer, from, throwError } from 'rxjs';
import { concatMap, first, map } from 'rxjs/operators';
import { isNotNull } from './operators';
import { ConnectionStore, WalletStore } from '@heavy-duty/wallet-adapter';

@Component({
  selector: 'wa-home',
  template: `
    <header>
      <h1>@heavy-duty/wallet-adapter example</h1>
    </header>

    <main>
      <section>
        <h2>Wallet details</h2>

        <select
          [ngModel]="walletName$ | async"
          (ngModelChange)="onSelectWallet($event)"
        >
          <option [ngValue]="null">Not selected</option>
          <option
            *ngFor="let wallet of wallets$ | async"
            [ngValue]="wallet.adapter.name"
          >
            {{ wallet.adapter.name }} ({{ wallet.readyState }})
          </option>
        </select>

        <p>
          Selected provider: {{ walletName$ | async }}
          <ng-container *ngIf="ready$ | async">(READY)</ng-container>
        </p>
        <p>Wallet Key: {{ publicKey$ | async }}</p>
        <button
          (click)="onConnect()"
          *ngIf="
            (connected$ | async) === false && (walletName$ | async) !== null
          "
          [disabled]="(ready$ | async) === false"
        >
          Connect
        </button>
        <button (click)="onDisconnect()" *ngIf="connected$ | async">
          Disconnect
        </button>
      </section>

      <section *ngIf="publicKey$ | async as publicKey">
        <h2>Transaction</h2>

        <div>
          <label>Recipient</label>
          <input type="text" [(ngModel)]="recipient" />
        </div>

        <div>
          <label>Lamports</label>
          <input type="number" [(ngModel)]="lamports" />
        </div>

        <button (click)="onSendTransaction(publicKey)">Send Transaction</button>
        <button (click)="onSignTransaction(publicKey)">Sign Transaction</button>
        <button (click)="onSignAllTransactions(publicKey)">
          Sign All Transactions
        </button>
        <button (click)="onSignMessage()">Sign Message</button>
      </section>
    </main>
  `,
})
export class HomeComponent {
  readonly connection$ = this._connectionStore.connection$;
  readonly wallets$ = this._walletStore.wallets$;
  readonly wallet$ = this._walletStore.wallet$;
  readonly walletName$ = this.wallet$.pipe(
    map((wallet) => wallet?.adapter.name || null)
  );
  readonly ready$ = this.wallet$.pipe(
    map(
      (wallet) =>
        wallet &&
        (wallet.adapter.readyState === WalletReadyState.Installed ||
          wallet.adapter.readyState === WalletReadyState.Loadable)
    )
  );
  readonly connected$ = this._walletStore.connected$;
  readonly publicKey$ = this._walletStore.publicKey$;
  lamports = 0;
  recipient = '';

  constructor(
    private readonly _connectionStore: ConnectionStore,
    private readonly _walletStore: WalletStore
  ) {}

  onConnect() {
    this._walletStore.connect().subscribe();
  }

  onDisconnect() {
    this._walletStore.disconnect().subscribe();
  }

  onSelectWallet(walletName: WalletName) {
    this._walletStore.selectWallet(walletName);
  }

  onSendTransaction(fromPubkey: PublicKey) {
    this.connection$
      .pipe(
        first(),
        isNotNull,
        concatMap((connection) =>
          from(defer(() => connection.getLatestBlockhash())).pipe(
            concatMap(({ blockhash, lastValidBlockHeight }) =>
              this._walletStore.sendTransaction(
                new Transaction({
                  blockhash,
                  feePayer: fromPubkey,
                  lastValidBlockHeight,
                }).add(
                  SystemProgram.transfer({
                    fromPubkey,
                    toPubkey: new PublicKey(this.recipient),
                    lamports: this.lamports,
                  })
                ),
                connection
              )
            )
          )
        )
      )
      .subscribe({
        next: (signature) => console.log(`Transaction sent (${signature})`),
        error: (error) => console.error(error),
      });
  }

  onSignTransaction(fromPubkey: PublicKey) {
    this.connection$
      .pipe(
        first(),
        isNotNull,
        concatMap((connection) =>
          from(defer(() => connection.getLatestBlockhash())).pipe(
            map(({ blockhash, lastValidBlockHeight }) =>
              new Transaction({
                blockhash,
                feePayer: fromPubkey,
                lastValidBlockHeight
              }).add(
                SystemProgram.transfer({
                  fromPubkey,
                  toPubkey: new PublicKey(this.recipient),
                  lamports: this.lamports,
                })
              )
            )
          )
        ),
        concatMap((transaction) => {
          const signTransaction$ =
            this._walletStore.signTransaction(transaction);

          if (!signTransaction$) {
            return throwError(
              () => new Error('Sign transaction method is not defined')
            );
          }

          return signTransaction$;
        })
      )
      .subscribe({
        next: (transaction) => console.log('Transaction signed', transaction),
        error: (error) => console.error(error)
      });
  }

  onSignAllTransactions(fromPubkey: PublicKey) {
    this.connection$
      .pipe(
        first(),
        isNotNull,
        concatMap((connection) =>
          from(defer(() => connection.getLatestBlockhash())).pipe(
            map(({ blockhash, lastValidBlockHeight }) =>
              new Array(3).fill(0).map(() =>
                new Transaction({
                  blockhash,
                  feePayer: fromPubkey,
                  lastValidBlockHeight
                }).add(
                  SystemProgram.transfer({
                    fromPubkey,
                    toPubkey: new PublicKey(this.recipient),
                    lamports: this.lamports,
                  })
                )
              )
            )
          )
        ),
        concatMap((transactions) => {
          const signAllTransaction$ =
            this._walletStore.signAllTransactions(transactions);

          if (!signAllTransaction$) {
            return throwError(
              () => new Error('Sign all transactions method is not defined')
            );
          }

          return signAllTransaction$;
        })
      )
      .subscribe({
        next: (transactions) => console.log('Transactions signed', transactions),
        error: (error) => console.error(error)
      });
  }

  onSignMessage() {
    const signMessage$ = this._walletStore.signMessage(
      new TextEncoder().encode('Hello world!')
    );

    if (!signMessage$) {
      return console.error(new Error('Sign message method is not defined'));
    }

    signMessage$.pipe(first()).subscribe((signature) => {
      console.log(`Message signature: ${{ encode }.encode(signature)}`);
    });
  }
}
