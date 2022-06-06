import { Component, OnInit } from '@angular/core';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  LedgerWalletAdapter,
  PhantomWalletAdapter,
  SlopeWalletAdapter,
  SolflareWalletAdapter,
  SolletWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { ConnectionStore, WalletStore } from '@heavy-duty/wallet-adapter';

@Component({
  selector: 'wa-root',
  template: ` <wa-home> </wa-home> `,
})
export class AppComponent implements OnInit {
  constructor(
    private _connectionStore: ConnectionStore,
    private _walletStore: WalletStore
  ) {}

  ngOnInit() {
    this._connectionStore.setEndpoint('http://api.devnet.solana.com');
    this._walletStore.setAdapters([
      new PhantomWalletAdapter(),
      new SlopeWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
      new LedgerWalletAdapter(),
      new SolletWalletAdapter({ network: WalletAdapterNetwork.Devnet }),
    ]);
  }
}
