import {
  Client,
  ClientOptions,
  LocalAuth,
  Message,
  MessageMedia,
} from 'whatsapp-web.js';

import { WhatsappSessionWebJSCore } from '../core/session.webjs.core';
import { EngineMediaProcessor as CoreEngineMediaProcessor } from '../core/session.webjs.core';
import {
  MessageFileRequest,
  MessageImageRequest,
  MessageVideoRequest,
} from '../structures/chatting.dto';
import { BinaryFile, RemoteFile } from '../structures/files.dto';

export class WhatsappSessionWebJSPlus extends WhatsappSessionWebJSCore {
  protected buildClient() {
    const clientOptions: ClientOptions = {
      authStrategy: new LocalAuth({
        clientId: this.name,
        dataPath: this.sessionStorage.getFolderPath(this.name),
      }),
      puppeteer: {
        headless: true,
        executablePath: this.getBrowserExecutablePath(),
        args: this.getBrowserArgsForPuppeteer(),
      },
    };
    this.addProxyConfig(clientOptions);
    return new Client(clientOptions);
  }

  private async fileToMedia(file: BinaryFile | RemoteFile) {
    if ('url' in file) {
      const mediaOptions = { unsafeMime: true };
      const media = await MessageMedia.fromUrl(file.url, mediaOptions);
      media.mimetype = file.mimetype || media.mimetype;
      media.filename = file.filename || media.filename;
      return media;
    }
    return new MessageMedia(file.mimetype, file.data, file.filename);
  }

  async sendFile(request: MessageFileRequest) {
    const media = await this.fileToMedia(request.file);
    const options = { sendMediaAsDocument: true };
    return this.whatsapp.sendMessage(request.chatId, media, options);
  }

  async sendImage(request: MessageImageRequest) {
    const media = await this.fileToMedia(request.file);
    const options = { caption: request.caption };
    return this.whatsapp.sendMessage(request.chatId, media, options);
  }

  async sendVoice(request) {
    const media = await this.fileToMedia(request.file);
    const options = { sendAudioAsVoice: true };
    return this.whatsapp.sendMessage(request.chatId, media, options);
  }

  async sendVideo(request: MessageVideoRequest) {
    const media = await this.fileToMedia(request.file);
    const options = { caption: request.caption };
    return this.whatsapp.sendMessage(request.chatId, media, options);
  }

  protected downloadMedia(message: Message) {
    const processor = new EngineMediaProcessor();
    return this.mediaManager.processMedia(processor, message);
  }
}

class EngineMediaProcessor extends CoreEngineMediaProcessor {
  getMessageId(message: Message): string {
    return message.id._serialized;
  }

  getMimetype(message: Message): string {
    // @ts-ignore
    return message.rawData.mimetype;
  }

  async getMediaBuffer(message: Message): Promise<Buffer | null> {
    return message.downloadMedia().then((media: MessageMedia) => {
      if (!media) {
        return null;
      }
      return Buffer.from(media.data, 'base64');
    });
  }
}
