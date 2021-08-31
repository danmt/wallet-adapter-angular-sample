import { InjectionToken } from '@angular/core';

import { ConnectionOptions } from './connection.types';

export const CONNECTION_OPTIONS = new InjectionToken<ConnectionOptions>(
  'connectionOptions'
);
