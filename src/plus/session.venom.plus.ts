import { create, CreateConfig, Message } from 'venom-bot';

import { WhatsappSessionVenomCore } from '../core/session.venom.core';
import { EngineMediaProcessor as CoreEngineMediaProcessor } from '../core/session.venom.core';

export class WhatsappSessionVenomPlus extends WhatsappSessionVenomCore {
  protected buildClient() {
    const venomOptions: CreateConfig =
      // Keep this options in sync with core
      {
        headless: true,
        devtools: false,
        debug: false,
        logQR: true,
        browserArgs: this.getBrowserArgsForPuppeteer(),
        autoClose: 60000,
        puppeteerOptions: {},
        folderNameToken: this.sessionStorage.engine,
        mkdirFolderToken: this.sessionStorage.sessionsFolder,
      };
    this.addProxyConfig(venomOptions);
    return create(this.name, this.getCatchQR(), undefined, venomOptions);
  }

  protected async downloadMedia(message: Message) {
    const processor = new EngineMediaProcessor(this);
    return this.mediaManager.processMedia(processor, message);
  }
}

class EngineMediaProcessor extends CoreEngineMediaProcessor {
  getMessageId(message: Message): string {
    return message.id;
  }

  getMimetype(message: Message): string {
    return message.mimetype;
  }

  async getMediaBuffer(message: Message): Promise<Buffer> {
    return this.session.whatsapp.decryptFile(message);
  }
}
