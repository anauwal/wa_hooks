import request = require('requestretry');
import * as crypto from 'crypto';

import { WebhookSender } from '../core/abc/webhooks.abc';
import { WebhookConductorCore } from '../core/webhooks.core';
import { SECOND } from '../structures/enums.dto';
import { WebhookConfig } from '../structures/webhooks.config.dto';

const DEFAULT_RETRY_DELAY_SECONDS = 2;
const DEFAULT_RETRY_ATTEMPTS = 15;
const DEFAULT_HMAC_ALGORITHM = 'sha512';

export class WebhookSenderPlus extends WebhookSender {
  private readonly attempts: number;
  private readonly delayMs: number;
  private readonly config: WebhookConfig;

  constructor(log, config: WebhookConfig) {
    super(log, config);
    this.attempts = config.retries?.attempts || DEFAULT_RETRY_ATTEMPTS;
    const delaySeconds =
      config.retries?.delaySeconds || DEFAULT_RETRY_DELAY_SECONDS;
    this.delayMs = delaySeconds * SECOND;
    this.config = config;
  }

  protected getHeaders(body) {
    // Common Headers
    const headers = {
      'content-type': 'application/json',
    };

    // Custom Headers
    if (this.config.customHeaders) {
      const customHeaders = {};
      for (const header of this.config.customHeaders) {
        customHeaders[header.name] = header.value;
      }
      Object.assign(headers, customHeaders);
    }

    // HMAC
    const hmac = this.calculateHmac(body, DEFAULT_HMAC_ALGORITHM);
    if (hmac) {
      const hmacHeader = {
        'X-Webhook-Hmac': hmac,
        'X-Webhook-Hmac-Algorithm': DEFAULT_HMAC_ALGORITHM,
      };
      Object.assign(headers, hmacHeader);
    }

    return headers;
  }

  private calculateHmac(body, algorithm) {
    if (!this.config.hmac) {
      return undefined;
    }

    return crypto
      .createHmac(algorithm, this.config.hmac.key)
      .update(body)
      .digest('hex');
  }

  send(json) {
    const body = JSON.stringify(json);
    const headers = this.getHeaders(body);
    const postParams = {
      body: body,
      maxAttempts: this.attempts,
      retryDelay: this.delayMs,
      retryStrategy: request.RetryStrategies.HTTPOrNetworkError,
      headers: headers,
    };
    this.log.log(`Sending POST to ${this.url}...`);
    this.log.verbose(`POST DATA: ${body}`);

    request.post(this.url, postParams, (error, res, body) => {
      if (error) {
        this.log.error(error);
        return;
      }
      this.log.log(`POST request was sent with status code: ${res.statusCode}`);
      this.log.debug(`Response: ${body}`);
    });
  }
}

export class WebhookConductorPlus extends WebhookConductorCore {
  protected buildSender(webhookConfig: WebhookConfig): WebhookSender {
    return new WebhookSenderPlus(this.log, webhookConfig);
  }
}
