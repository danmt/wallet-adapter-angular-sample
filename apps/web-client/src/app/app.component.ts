import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { WalletName } from '@solana/wallet-adapter-wallets';
import { startWith } from 'rxjs/operators';

import { WalletsStore } from './wallet.store';

const DEFAULT_WALLET_PROVIDER = WalletName.Sollet;

@Component({
  selector: 'wallet-adapter-test-root',
  template: `
    <header>
      <h1>Wallet adapter test</h1>
    </header>

    <main>
      <select [formControl]="selectedProviderControl">
        <option *ngFor="let wallet of wallets$ | async" [ngValue]="wallet.name">
          {{ wallet.name }}
        </option>
      </select>

      <section>
        <p>Selected provider: {{ selectedWallet$ | async }}</p>
        <p>Wallet Key: {{ publicKey$ | async }}</p>
        <button (click)="onConnect()" *ngIf="(connected$ | async) === false">
          Connect
        </button>
        <button (click)="onDisconnect()" *ngIf="connected$ | async">
          Disconnect
        </button>
      </section>
    </main>
  `,
  styles: [],
  viewProviders: [WalletsStore],
})
export class AppComponent implements OnInit {
  wallets$ = this.walletsStore.wallets$;
  selectedWallet$ = this.walletsStore.selectedWallet$;
  selectedProviderControl = new FormControl(DEFAULT_WALLET_PROVIDER);
  connected$ = this.walletsStore.connected$;
  publicKey$ = this.walletsStore.publicKey$;

  constructor(private walletsStore: WalletsStore) {}

  ngOnInit() {
    this.walletsStore.selectWallet(
      this.selectedProviderControl.valueChanges.pipe(
        startWith(DEFAULT_WALLET_PROVIDER)
      )
    );
  }

  onConnect() {
    this.walletsStore.connect();
  }

  onDisconnect() {
    this.walletsStore.disconnect();
  }
}
