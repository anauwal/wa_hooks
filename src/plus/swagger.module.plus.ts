import { INestApplication } from '@nestjs/common';

import { WhatsappConfigService } from '../config.service';
import { SwaggerModuleCore } from '../core/swagger.module.core';
import { BasicAuthFunction } from './auth/basicAuth';

export class SwaggerModulePlus extends SwaggerModuleCore {
  configure(app: INestApplication, webhooks: any[]) {
    const config = app.get(WhatsappConfigService);
    if (!config.getSwaggerEnabled()) {
      console.log('Swagger is disabled.');
      return;
    }

    const credentials = config.getSwaggerUsernamePassword();
    if (credentials) {
      this.setUpAuth(app, credentials);
    }
    super.configure(app, webhooks);
  }

  setUpAuth(app: INestApplication, credentials: [string, string]): void {
    const [username, password] = credentials;
    const authFunction = BasicAuthFunction(username, password, '/api/');
    app.use(authFunction);
  }
}
