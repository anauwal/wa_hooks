import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import * as passport from 'passport';

import { WhatsappConfigService } from '../../config.service';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private config: WhatsappConfigService) {}

  use(req: any, res: any, next: () => void) {
    // No api key - skip the validation path
    if (!this.config.getApiKey()) {
      next();
      return;
    }

    passport.authenticate('headerapikey', { session: false }, (value) => {
      if (value) {
        next();
      } else {
        throw new UnauthorizedException();
      }
    })(req, res, next);
  }
}
