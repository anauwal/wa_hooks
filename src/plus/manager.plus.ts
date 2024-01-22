import { ConsoleLogger, Injectable, NotFoundException } from '@nestjs/common';
import * as lodash from 'lodash';
import { getProxyConfig } from 'src/core/helpers.proxy';

import { WhatsappConfigService } from '../config.service';
import { SessionManager } from '../core/abc/manager.abc';
import { SessionParams, WhatsappSession } from '../core/abc/session.abc';
import { buildLogger } from '../core/manager.core';
import { WAHAEngine, WAHASessionStatus } from '../structures/enums.dto';
import {
  MeInfo,
  ProxyConfig,
  SessionConfig,
  SessionInfo,
  SessionLogoutRequest,
  SessionStartRequest,
  SessionStopRequest,
} from '../structures/sessions.dto';
import { WebhookConfig } from '../structures/webhooks.config.dto';
import { MediaStoragePlus, PlusMediaManager } from './media.plus';
import { WhatsappSessionNoWebPlus } from './session.noweb.plus';
import { WhatsappSessionVenomPlus } from './session.venom.plus';
import { WhatsappSessionWebJSPlus } from './session.webjs.plus';
import { SessionStoragePlus } from './storage.plus';
import { WebhookConductorPlus } from './webhooks.plus';

@Injectable()
export class SessionManagerPlus extends SessionManager {
  private readonly sessions: Record<string, WhatsappSession>;

  // @ts-ignore
  protected WebhookConductorClass = WebhookConductorPlus;
  protected readonly EngineClass: typeof WhatsappSession;

  constructor(
    private config: WhatsappConfigService,
    private log: ConsoleLogger,
  ) {
    super();
    this.log.setContext('SessionManager');
    this.sessions = {};
    const engineName = this.config.getDefaultEngineName();
    this.EngineClass = this.getEngine(engineName);
    this.sessionStorage = new SessionStoragePlus(engineName.toLowerCase());

    this.clearStorage();
    this.restartStoppedSessions();
    this.startPredefinedSessions();
  }

  protected async restartStoppedSessions() {
    if (!this.config.shouldRestartAllSessions) {
      return;
    }

    await this.sessionStorage.init();
    const stoppedSessions = await this.sessionStorage.getAll();

    const promises = stoppedSessions.map(async (sessionName) => {
      this.log.log(`Restarting STOPPED session - ${sessionName}...`);
      const config =
        await this.sessionStorage.configRepository.get(sessionName);
      return this.start({ name: sessionName, config: config });
    });
    await Promise.all(promises);
  }

  protected async startPredefinedSessions() {
    const startSessions = this.config.startSessions;
    const promises = startSessions.map(async (sessionName) => {
      // Do not start already started session
      if (this.sessions[sessionName]) {
        return;
      }
      const config =
        await this.sessionStorage.configRepository.get(sessionName);
      return this.start({ name: sessionName, config: config });
    });
    await Promise.all(promises);
  }

  protected getEngine(engine: WAHAEngine): typeof WhatsappSession {
    if (engine === WAHAEngine.WEBJS) {
      return WhatsappSessionWebJSPlus;
    } else if (engine === WAHAEngine.VENOM) {
      return WhatsappSessionVenomPlus;
    } else if (engine === WAHAEngine.NOWEB) {
      return WhatsappSessionNoWebPlus;
    } else {
      throw new NotFoundException(`Unknown whatsapp engine '${engine}'.`);
    }
  }

  async onApplicationShutdown(signal?: string) {
    this.log.log('Stop all sessions...');
    for (const name of Object.keys(this.sessions)) {
      await this.stop({ name: name, logout: false });
    }
  }

  private clearStorage() {
    /* We need to clear the local storage just once */
    const storage = new MediaStoragePlus(
      buildLogger(`Storage`),
      this.config.filesFolder,
      this.config.filesURL,
      this.config.filesLifetime,
    );
    storage.purge();
  }

  //
  // API Methods
  //
  async start(request: SessionStartRequest) {
    const name = request.name;
    this.log.log(`'${name}' - starting session...`);
    const log = buildLogger(`WhatsappSession - ${name}`);
    const storage = new MediaStoragePlus(
      buildLogger(`Storage - ${name}`),
      this.config.filesFolder,
      this.config.filesURL,
      this.config.filesLifetime,
    );
    const mediaManager = new PlusMediaManager(
      storage,
      this.config.mimetypes,
      buildLogger(`MediaManager - ${name}`),
    );
    const webhookLog = buildLogger(`Webhook - ${name}`);
    const webhook = new this.WebhookConductorClass(webhookLog);
    const proxyConfig = this.getProxyConfig(request);
    const sessionConfig: SessionParams = {
      name,
      mediaManager,
      log,
      sessionStorage: this.sessionStorage,
      proxyConfig: proxyConfig,
      sessionConfig: request.config,
    };
    await this.sessionStorage.init(name);
    // @ts-ignore
    const session = new this.EngineClass(sessionConfig);
    this.sessions[name] = session;

    // configure webhooks
    const webhooks = this.getWebhooks(request);
    webhook.configure(session, webhooks);

    // start session
    await session.start();
    return {
      name: session.name,
      status: session.status,
      config: session.sessionConfig,
    };
  }

  /**
   * Combine per session and global webhooks
   */
  private getWebhooks(request: SessionStartRequest) {
    let webhooks: WebhookConfig[] = [];
    if (request.config?.webhooks) {
      webhooks = webhooks.concat(request.config.webhooks);
    }
    const globalWebhookConfig = this.config.getWebhookConfig();
    if (globalWebhookConfig) {
      webhooks.push(globalWebhookConfig);
    }
    return webhooks;
  }

  /**
   * Get either session's or global proxy if defined
   */
  protected getProxyConfig(
    request: SessionStartRequest,
  ): ProxyConfig | undefined {
    if (request.config?.proxy) {
      return request.config.proxy;
    }
    return getProxyConfig(this.config, this.sessions, request.name);
  }

  async stop(request: SessionStopRequest) {
    const name = request.name;
    this.log.log(`Stopping ${name} session...`);
    const session = this.getSession(name);
    await session.stop();
    this.log.log(`"${name}" has been stopped.`);
    delete this.sessions[name];
  }

  async logout(request: SessionLogoutRequest) {
    await this.sessionStorage.clean(request.name);
  }

  getSession(name: string): WhatsappSession {
    const session = this.sessions[name];
    if (!session) {
      throw new NotFoundException(
        `We didn't find a session with name '${name}'. Please start it first by using POST /sessions/start request`,
      );
    }
    return session;
  }

  async getSessions(all): Promise<SessionInfo[]> {
    let sessionNames = Object.keys(this.sessions);
    if (all) {
      const stoppedSession = await this.sessionStorage.getAll();
      sessionNames = lodash.union(sessionNames, stoppedSession);
    }

    const sessions = sessionNames.map(async (sessionName) => {
      const status =
        this.sessions[sessionName]?.status || WAHASessionStatus.STOPPED;
      let sessionConfig: SessionConfig | undefined;
      let me: MeInfo | null;
      if (status != WAHASessionStatus.STOPPED) {
        sessionConfig = this.sessions[sessionName].sessionConfig;
        me = await this.sessions[sessionName]
          .getSessionMeInfo()
          .catch((err) => null);
      } else {
        sessionConfig =
          await this.sessionStorage.configRepository.get(sessionName);
        me = null;
      }
      return {
        name: sessionName,
        status: status,
        config: sessionConfig,
        me: me,
      };
    });
    return await Promise.all(sessions);
  }
}
