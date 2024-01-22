import { downloadMediaMessage } from '@adiwajshing/baileys';
import { UnprocessableEntityException } from '@nestjs/common';

import { toJID, WhatsappSessionNoWebCore } from '../core/session.noweb.core';
import {
  MessageFileRequest,
  MessageImageRequest,
  MessageVideoRequest,
  MessageVoiceRequest,
} from '../structures/chatting.dto';
import { BinaryFile, RemoteFile } from '../structures/files.dto';
import {
  BROADCAST_ID,
  ImageStatus,
  VideoStatus,
  VoiceStatus,
} from '../structures/status.dto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const logger = require('pino')();
import { EngineMediaProcessor as CoreEngineMediaProcessor } from '../core/session.noweb.core';

export class WhatsappSessionNoWebPlus extends WhatsappSessionNoWebCore {
  fileToMessage(file: RemoteFile | BinaryFile, type, caption = '') {
    if (!('url' in file || 'data' in file)) {
      throw new UnprocessableEntityException(
        'Either file.url or file.data must be specified.',
      );
    }

    if ('url' in file) {
      return {
        [type]: { url: file.url },
        caption: caption,
        mimetype: file.mimetype,
        fileName: file.filename,
        ptt: type === 'audio',
      };
    } else if ('data' in file) {
      return {
        [type]: Buffer.from(file.data, 'base64'),
        mimetype: file.mimetype,
        caption: caption,
        fileName: file.filename,
        ptt: type === 'audio',
      };
    }
  }

  sendImage(request: MessageImageRequest) {
    const message = this.fileToMessage(request.file, 'image', request.caption);
    return this.sock.sendMessage(request.chatId, message);
  }

  sendFile(request: MessageFileRequest) {
    const message = this.fileToMessage(
      request.file,
      'document',
      request.caption,
    );
    return this.sock.sendMessage(request.chatId, message);
  }

  sendVoice(request: MessageVoiceRequest) {
    const message = this.fileToMessage(request.file, 'audio');
    return this.sock.sendMessage(request.chatId, message);
  }

  sendVideo(request: MessageVideoRequest) {
    const message = this.fileToMessage(request.file, 'video', request.caption);
    return this.sock.sendMessage(request.chatId, message);
  }

  protected downloadMedia(message) {
    const processor = new EngineMediaProcessor(this);
    return this.mediaManager.processMedia(processor, message);
  }

  /**
   * Status methods
   */
  public sendImageStatus(status: ImageStatus) {
    const message = this.fileToMessage(status.file, 'image', status.caption);
    const options = {
      statusJidList: status.contacts.map(toJID),
    };
    return this.sock.sendMessage(BROADCAST_ID, message, options);
  }

  public sendVoiceStatus(status: VoiceStatus) {
    const message = this.fileToMessage(status.file, 'audio');
    const options = {
      backgroundColor: status.backgroundColor,
      statusJidList: status.contacts.map(toJID),
    };
    return this.sock.sendMessage(BROADCAST_ID, message, options);
  }

  public sendVideoStatus(status: VideoStatus) {
    const message = this.fileToMessage(status.file, 'video', status.caption);
    const options = {
      statusJidList: status.contacts.map(toJID),
    };
    return this.sock.sendMessage(BROADCAST_ID, message, options);
  }
}

class EngineMediaProcessor extends CoreEngineMediaProcessor {
  getMessageId(message: any): string {
    return message.key.id;
  }

  getMimetype(message: any): string {
    const messageType = Object.keys(message.message)[0];
    return message.message[messageType].mimetype;
  }

  async getMediaBuffer(message: any): Promise<Buffer | null> {
    return (await downloadMediaMessage(
      message,
      'buffer',
      {},
      {
        logger: logger,
        reuploadRequest: this.session.sock.updateMediaMessage,
      },
    )) as Buffer;
  }
}
