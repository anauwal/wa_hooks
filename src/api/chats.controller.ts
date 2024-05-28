import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { SessionManager } from '../core/abc/manager.abc';
import { WhatsappSession } from '../core/abc/session.abc';
import { parseBool } from '../helpers';
import { GetChatMessagesQuery } from '../structures/chats.dto';
import { SessionApiParam, SessionParam } from './helpers';
import { EditMessageRequest } from 'src/structures/chatting.dto';

@ApiSecurity('api_key')
@Controller('api/:session/chats')
@ApiTags('chats')
class ChatsController {
  constructor(private manager: SessionManager) { }

  @Get('')
  @SessionApiParam
  @ApiOperation({ summary: 'Get all chats' })
  getAllChats(@SessionParam session: WhatsappSession) {
    return session.getChats();
  }

  @Delete(':chatId')
  @SessionApiParam
  @ApiOperation({ summary: 'Deletes the chat' })
  deleteChat(
    @SessionParam session: WhatsappSession,
    @Param('chatId') chatId: string,
  ) {
    return session.deleteChat(chatId);
  }

  @Delete(':chatId/messages/:messageId')
  @SessionApiParam
  @ApiOperation({ summary: 'Deletes a message from the chat' })
  deleteMessage(
    @SessionParam session: WhatsappSession,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
  ) {
    return session.deleteMessage(chatId, messageId);
  }

  @Put(':chatId/messages/:messageId')
  @SessionApiParam

  @ApiOperation({ summary: 'Edits a message in the chat' })
  editMessage(
    @SessionParam session: WhatsappSession,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Body() body: EditMessageRequest,
  ) {
    return session.editMessage(chatId, messageId, body);
  }

  @Get(':chatId/messages')
  @SessionApiParam
  @ApiOperation({ summary: 'Gets messages in the chat' })
  getChatMessages(
    @Query() query: GetChatMessagesQuery,
    @SessionParam session: WhatsappSession,
    @Param('chatId') chatId: string,
  ) {
    const downloadMedia = parseBool(query.downloadMedia);
    return session.getChatMessages(chatId, query.limit, downloadMedia);
  }

  @Delete(':chatId/messages')
  @SessionApiParam
  @ApiOperation({ summary: 'Clears all messages from the chat' })
  clearMessages(
    @SessionParam session: WhatsappSession,
    @Param('chatId') chatId: string,
  ) {
    return session.clearMessages(chatId);
  }
}

export { ChatsController };
