import { ClipboardModule } from '@angular/cdk/clipboard';
import { DialogModule } from '@angular/cdk/dialog';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HdWalletAdapterModule } from '@heavy-duty/wallet-adapter';
import { HdWalletAdapterMaterialModule } from '@heavy-duty/wallet-adapter-material';
import { AppComponent } from './app.component';
import { HomeComponent } from './home.component';

@NgModule({
  declarations: [AppComponent, HomeComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    ClipboardModule,
    DialogModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    HdWalletAdapterModule.forRoot({ autoConnect: true }),
    HdWalletAdapterMaterialModule,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
