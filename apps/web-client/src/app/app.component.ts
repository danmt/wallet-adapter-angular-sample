import { Component } from '@angular/core';
import { WalletName } from '@solana/wallet-adapter-wallets';

import { WalletsStore, WALLET_AUTO_CONNECT } from './wallet.store';

@Component({
  selector: 'wallet-adapter-test-root',
  template: `
    <header>
      <h1>Wallet adapter test</h1>
    </header>

    <main>
      <select
        [ngModel]="selectedWallet$ | async"
        (ngModelChange)="onSelectWallet($event)"
      >
        <option *ngFor="let wallet of wallets$ | async" [ngValue]="wallet.name">
          {{ wallet.name }}
        </option>
      </select>

      <section>
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
    </main>
  `,
  styles: [],
  viewProviders: [
    { provide: WALLET_AUTO_CONNECT, useValue: true },
    WalletsStore,
  ],
})
export class AppComponent {
  wallets$ = this.walletsStore.wallets$;
  selectedWallet$ = this.walletsStore.selectedWallet$;
  connected$ = this.walletsStore.connected$;
  publicKey$ = this.walletsStore.publicKey$;
  ready$ = this.walletsStore.ready$;

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
}
