import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { DECORATORS } from '@nestjs/swagger/dist/constants';

import { WhatsappConfigService } from '../config.service';
import { VERSION } from '../version';

export class SwaggerModuleCore {
  configure(app: INestApplication, webhooks: any[]) {
    const builder = new DocumentBuilder();

    builder
      .setTitle('WAHOOKS')
      .setDescription(
        'Whatsapp API with WEBHOOKS by Akbar-Studios<br/>' 
      )
      .setExternalDoc('WAHOOKS', 'https://github.com/anauwal/wa_hooks')
      .setVersion(VERSION.version)
      .addTag('sessions', 'Control WhatsApp sessions')
      .addTag('auth', 'Authentication')
      .addTag('screenshot', 'Get screenshot of WhatsApp and show QR code')
      .addTag('chatting', 'Chatting methods')
      .addTag(
        'status',
        'Status (aka stories) methods. <b>NOWEB</b> engine only!',
      )
      .addTag('chats', `Chats methods`)
      .addTag(
        'contacts',
        `Contacts methods.<br>
                Use phone number (without +) or phone number and \`@c.us\` at the end as \`contactId\`.<br>
                'E.g: \`12312312310\` OR \`12312312310@c.us\`<br>`,
      )
      .addTag('groups', `Groups methods.<br>`)
      .addTag('presence', `Presence information`)
      .addTag('other', 'Other methods')
      .addApiKey({
        type: 'apiKey',
        description: 'Your secret api key',
        name: 'X-Api-Key',
      });

    const config = app.get(WhatsappConfigService);
    if (config.getSwaggerAdvancedConfigEnabled()) {
      builder.addServer('{protocol}://{host}:{port}/{baseUrl}', '', {
        protocol: {
          default: 'http',
          enum: ['http', 'https'],
          description: 'The protocol used to access the server.',
        },
        host: {
          default: config.hostname,
          description: 'The hostname or IP address of the server.',
        },
        port: {
          default: config.port,
          description:
            'The port number on which the server is listening for requests',
        },
        baseUrl: {
          default: '',
          description:
            'The base URL path for all API endpoints. This can be used to group related endpoints together under a common path.',
        },
      });
    }

    const swaggerDocumentConfig = builder.build();
    const swaggerDocumentOptions = {
      extraModels: webhooks,
    };
    let document = SwaggerModule.createDocument(
      app,
      swaggerDocumentConfig,
      swaggerDocumentOptions,
    );
    document = this.configureWebhooks(document, webhooks);
    SwaggerModule.setup('', app, document, {
      customSiteTitle: 'WAHOOKS',
    });
  }

  private configureWebhooks(document: OpenAPIObject, supportedWebhooks) {
    document.openapi = '3.1.0';
    const webhooks = {};
    for (const webhook of supportedWebhooks) {
      const eventMetadata = Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        webhook.prototype,
        'event',
      );
      const event = new webhook().event;
      const schemaName = webhook.name;
      webhooks[event] = {
        post: {
          summary: eventMetadata.description,
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  $ref: `#/components/schemas/${schemaName}`,
                },
              },
            },
          },
          responses: {
            '200': {
              description:
                'Return a 200 status to indicate that the data was received successfully',
            },
          },
        },
      };
    }
    // @ts-ignore
    document.webhooks = webhooks;
    return document;
  }
}
