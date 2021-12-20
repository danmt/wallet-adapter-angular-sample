import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { WALLET_CONFIG } from '@danmt/wallet-adapter-angular';

import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, FormsModule],
  providers: [
    {
      provide: WALLET_CONFIG,
      useValue: {
        autoConnect: true,
      },
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
