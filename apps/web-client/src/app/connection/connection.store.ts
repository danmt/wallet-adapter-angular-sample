import { Inject, Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { Connection } from '@solana/web3.js';
import { map } from 'rxjs/operators';

import { CONNECTION_OPTIONS } from './connection.tokens';
import { ConnectionOptions, ConnectionState } from './connection.types';

@Injectable()
export class ConnectionStore extends ComponentStore<ConnectionState> {
  connection$ = this.state$.pipe(map((state) => state.connection));

  constructor(
    @Inject(CONNECTION_OPTIONS)
    _options: ConnectionOptions
  ) {
    super({
      connection: new Connection(_options.endpoint, _options.config),
    });
  }
}
