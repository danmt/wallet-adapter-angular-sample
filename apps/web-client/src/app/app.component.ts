import { Component, OnInit } from '@angular/core';
import {
  ConnectionStore,
  WALLET_CONFIG,
  WalletStore,
} from '@danmt/wallet-adapter-angular';
import {
  getBitpieWallet,
  getBloctoWallet,
  getPhantomWallet,
  getSolflareWallet,
  getSolletWallet,
  getSolongWallet,
  WalletName,
} from '@solana/wallet-adapter-wallets';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { defer, from, throwError } from 'rxjs';
import { concatMap, first, map } from 'rxjs/operators';

import { isNotNull } from './operators';

@Component({
  selector: 'wallet-adapter-test-root',
  template: `
    <header>
      <h1>@solana/wallet-adapter-angular example</h1>
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
            [ngValue]="wallet.name"
          >
            {{ wallet.name }}
          </option>
        </select>

        <p>
          Selected provider: {{ walletName$ | async }}
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
        <button (click)="onSignMessage()">Sign Message</button>
      </section>
    </main>
  `,
  styles: [],
  viewProviders: [
    {
      provide: WALLET_CONFIG,
      useValue: {
        wallets: [
          getSolletWallet(),
          getPhantomWallet(),
          getSolflareWallet(),
          getSolongWallet(),
          getBitpieWallet(),
          getBloctoWallet(),
        ],
        autoConnect: true,
      },
    },
    WalletStore,
    ConnectionStore,
  ],
})
export class AppComponent implements OnInit {
  connection$ = this.connectionStore.connection$;
  wallets$ = this.walletStore.wallets$;
  walletName$ = this.walletStore.name$;
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
    // this.walletStore.error$.subscribe((error) => console.log(error));

    this.connectionStore.setEndpoint('https://api.devnet.solana.com');

    /* this.walletStore.anchorWallet$.subscribe((anchorWallet) => {
      if (!anchorWallet) {
        console.error('Anchor wallet not available');
      } else {
        console.log(anchorWallet);
      }
    }); */

    this.walletStore.state$.subscribe((a) => console.log(a));
  }

  onConnect() {
    this.walletStore.connect().subscribe();
  }

  onDisconnect() {
    this.walletStore.disconnect().subscribe();
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
      .subscribe(
        (signature) => console.log(`Transaction sent (${signature})`),
        (error) => console.error(error)
      );
  }

  onSignTransaction(fromPubkey: PublicKey) {
    this.connection$
      .pipe(
        first(),
        isNotNull,
        concatMap((connection) =>
          from(defer(() => connection.getRecentBlockhash())).pipe(
            map(({ blockhash }) =>
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
        ),
        concatMap((transaction) => {
          const signTransaction$ =
            this.walletStore.signTransaction(transaction);

          if (!signTransaction$) {
            return throwError(
              new Error('Sign transaction method is not defined')
            );
          }

          return signTransaction$;
        })
      )
      .subscribe(
        (transaction) => console.log('Transaction signed', transaction),
        (error) => console.error(error)
      );
  }

  onSignAllTransactions(fromPubkey: PublicKey) {
    this.connection$
      .pipe(
        first(),
        isNotNull,
        concatMap((connection) =>
          from(defer(() => connection.getRecentBlockhash())).pipe(
            map(({ blockhash }) =>
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
        ),
        concatMap((transactions) => {
          const signAllTransaction$ =
            this.walletStore.signAllTransactions(transactions);

          if (!signAllTransaction$) {
            return throwError(
              new Error('Sign all transactions method is not defined')
            );
          }

          return signAllTransaction$;
        })
      )
      .subscribe(
        (transactions) => console.log('Transactions signed', transactions),
        (error) => console.error(error)
      );
  }

  onSignMessage() {
    const signMessage$ = this.walletStore.signMessage(
      new TextEncoder().encode('Hello world!')
    );

    if (!signMessage$) {
      return console.error(new Error('Sign message method is not defined'));
    }

    signMessage$.pipe(first()).subscribe((signature) => {
      console.log(`Message signature: ${bs58.encode(signature)}`);
    });
  }
}
