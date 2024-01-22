import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';

import { WhatsappConfigService } from '../../config.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(HeaderAPIKeyStrategy) {
  constructor(private config: WhatsappConfigService) {
    super({ header: 'X-Api-Key', prefix: '' }, true, (apikey, done) => {
      return done(apikey == this.config.getApiKey());
    });
  }
}
