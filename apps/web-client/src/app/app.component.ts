import { Component, OnInit } from '@angular/core';
import {
  connectionProvider,
  ConnectionStore,
  walletProvider,
  WalletStore,
} from '@solana/wallet-adapter-angular';
import {
  getPhantomWallet,
  getSolletWallet,
  WalletName,
} from '@solana/wallet-adapter-wallets';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { defer, from } from 'rxjs';
import { concatMap, first } from 'rxjs/operators';

import { isNotNull } from './operators';

@Component({
  selector: 'wallet-adapter-test-root',
  template: `
    <header>
      <h1>Wallet adapter test</h1>
    </header>

    <main>
      <section>
        <h2>Wallet details</h2>

        <select
          [ngModel]="selectedWallet$ | async"
          (ngModelChange)="onSelectWallet($event)"
        >
          <option
            *ngFor="let wallet of wallets$ | async"
            [ngValue]="wallet.name"
          >
            {{ wallet.name }}
          </option>
        </select>

        <p>
          Selected provider: {{ selectedWallet$ | async }}
          <ng-container *ngIf="ready$ | async">(READY)</ng-container>
        </p>
        <p>Wallet Key: {{ publicKey$ | async }}</p>
        <button
          (click)="onConnect()"
          *ngIf="(connected$ | async) === false"
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
      </section>
    </main>
  `,
  styles: [],
  viewProviders: [
    ...walletProvider({
      wallets: [getSolletWallet(), getPhantomWallet()],
    }),
    ...connectionProvider(),
  ],
})
export class AppComponent implements OnInit {
  connection$ = this.connectionStore.connection$;
  wallets$ = this.walletStore.wallets$;
  selectedWallet$ = this.walletStore.selectedWallet$;
  connected$ = this.walletStore.connected$;
  publicKey$ = this.walletStore.publicKey$;
  ready$ = this.walletStore.ready$;
  lamports = 0;
  recipient = '';

  constructor(
    private connectionStore: ConnectionStore,
    private walletStore: WalletStore
  ) {}

  ngOnInit() {
    this.connectionStore.setEndpoint('https://api.devnet.solana.com');
  }

  onConnect() {
    this.walletStore.connect();
  }

  onDisconnect() {
    this.walletStore.disconnect();
  }

  onSelectWallet(walletName: WalletName) {
    this.walletStore.selectWallet(walletName);
  }

  onSendTransaction(fromPubkey: PublicKey) {
    this.connection$
      .pipe(
        first(),
        isNotNull,
        concatMap((connection) =>
          this.walletStore.sendTransaction(
            new Transaction().add(
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
      .subscribe((signature) => console.log(`Transaction sent (${signature})`));
  }

  onSignTransaction(fromPubkey: PublicKey) {
    this.connection$
      .pipe(
        first(),
        isNotNull,
        concatMap((connection) =>
          from(defer(() => connection.getRecentBlockhash()))
        ),
        concatMap(({ blockhash }) =>
          this.walletStore.signTransaction(
            new Transaction({
              recentBlockhash: blockhash,
              feePayer: fromPubkey,
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
      .subscribe((transaction) =>
        console.log('Transaction signed', transaction)
      );
  }

  onSignAllTransactions(fromPubkey: PublicKey) {
    this.connection$
      .pipe(
        first(),
        isNotNull,
        concatMap((connection) =>
          from(defer(() => connection.getRecentBlockhash()))
        ),
        concatMap(({ blockhash }) =>
          this.walletStore.signAllTransactions(
            new Array(3).fill(0).map(() =>
              new Transaction({
                recentBlockhash: blockhash,
                feePayer: fromPubkey,
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
      )
      .subscribe((transactions) =>
        console.log('Transactions signed', transactions)
      );
  }
}
