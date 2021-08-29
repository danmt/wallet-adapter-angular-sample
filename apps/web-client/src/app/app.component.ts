import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { WalletName } from '@solana/wallet-adapter-wallets';

import { WalletsStore } from './wallet.store';

@Component({
  selector: 'wallet-adapter-test-root',
  template: `
    <header>
      <h1>Wallet adapter test</h1>
    </header>

    <main>
      <select [formControl]="selectedProviderControl">
        <option *ngFor="let wallet of wallets$ | async">
          {{ wallet.name }}
        </option>
      </select>

      <section>
        <p>Selected provider: {{ selectedWallet$ | async }}</p>
        <button (click)="onConnect()">Connect</button>
      </section>
    </main>
  `,
  styles: [],
  viewProviders: [WalletsStore],
})
export class AppComponent implements OnInit {
  wallets$ = this.walletsStore.wallets$;
  selectedWallet$ = this.walletsStore.selectedWallet$;
  selectedProviderControl = new FormControl(WalletName.Sollet);

  constructor(private walletsStore: WalletsStore) {}

  ngOnInit() {
    this.walletsStore.selectWallet(this.selectedProviderControl.valueChanges);
  }

  onConnect() {
    this.walletsStore.connect();
  }
}
