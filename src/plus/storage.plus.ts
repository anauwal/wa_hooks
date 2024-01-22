import * as path from 'path';

import { SessionStorageCore } from '../core/storage.core';

export class SessionStoragePlus extends SessionStorageCore {
  constructor(engine: string) {
    super(engine);
    this.sessionsFolder = './.sessions';
  }

  getFolderPath(name: string): string {
    return path.join(this.engineFolder, name);
  }
}
