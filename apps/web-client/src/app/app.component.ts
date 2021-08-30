import { Component } from '@angular/core';
import { WalletName } from '@solana/wallet-adapter-wallets';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';

import { WalletsStore } from './wallet.store';

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
  viewProviders: [WalletsStore],
})
export class AppComponent {
  connection = new Connection('https://api.devnet.solana.com');
  wallets$ = this.walletsStore.wallets$;
  selectedWallet$ = this.walletsStore.selectedWallet$;
  connected$ = this.walletsStore.connected$;
  publicKey$ = this.walletsStore.publicKey$;
  ready$ = this.walletsStore.ready$;
  lamports = 0;
  recipient = '';

  constructor(private walletsStore: WalletsStore) {}

  onConnect() {
    this.walletsStore.connect();
  }

  onDisconnect() {
    this.walletsStore.disconnect();
  }

  onSelectWallet(walletName: WalletName) {
    this.walletsStore.selectWallet(walletName);
  }

  onSendTransaction(fromPubkey: PublicKey) {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey: new PublicKey(this.recipient),
        lamports: this.lamports,
      })
    );

    this.walletsStore.sendTransaction(transaction, this.connection);
  }

  async onSignTransaction(fromPubkey: PublicKey) {
    const recentBlockhash = await this.connection.getRecentBlockhash();
    const transaction = new Transaction({
      recentBlockhash: recentBlockhash.blockhash,
      feePayer: fromPubkey,
    }).add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey: new PublicKey(this.recipient),
        lamports: this.lamports,
      })
    );

    this.walletsStore.signTransaction(transaction);
  }

  async onSignAllTransactions(fromPubkey: PublicKey) {
    const recentBlockhash = await this.connection.getRecentBlockhash();
    const transactions = new Array(3).fill(0).map(() =>
      new Transaction({
        recentBlockhash: recentBlockhash.blockhash,
        feePayer: fromPubkey,
      }).add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey: new PublicKey(this.recipient),
          lamports: this.lamports,
        })
      )
    );

    this.walletsStore.signAllTransactions(transactions);
  }
}
