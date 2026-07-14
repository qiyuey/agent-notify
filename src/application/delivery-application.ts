import { describeError, type Logger, silentLogger } from "../core/logger.js";

interface Dispatcher {
  runOnce(): Promise<boolean>;
}

interface CloseableDatabase {
  close(): void;
}

interface RuntimeStatus {
  start(): void;
  stop(): void;
}

interface InstanceLock {
  acquire(): void;
  release(): void;
}

export interface DeliveryApplicationDependencies {
  readonly dispatchIntervalMs: number;
  readonly database: CloseableDatabase;
  readonly dispatcher: Dispatcher;
  readonly runtimeStatus: RuntimeStatus;
  readonly instanceLock: InstanceLock;
  readonly logger?: Logger;
}

export class DeliveryApplication {
  private timer: NodeJS.Timeout | null = null;
  private dispatching = false;
  private dispatchPromise: Promise<void> | null = null;
  private stopping = false;
  private stopPromise: Promise<void> | null = null;
  private readonly logger: Logger;

  constructor(private readonly dependencies: DeliveryApplicationDependencies) {
    this.logger = dependencies.logger ?? silentLogger;
  }

  async run(): Promise<void> {
    this.dependencies.instanceLock.acquire();
    this.dependencies.runtimeStatus.start();
    this.timer = setInterval(() => void this.dispatch(), this.dependencies.dispatchIntervalMs);
    this.logger.info("delivery_started");
    await this.dispatch();
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (!this.stopping) return;
        clearInterval(check);
        resolve();
      }, 50);
    });
    await this.stop();
  }

  stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    this.stopping = true;
    this.stopPromise = this.shutdown();
    return this.stopPromise;
  }

  private async dispatch(): Promise<void> {
    if (this.dispatching || this.stopping) return;
    this.dispatching = true;
    this.dispatchPromise = this.drain()
      .catch((error: unknown) => {
        this.logger.warn("delivery_loop_failed", describeError(error));
      })
      .finally(() => {
        this.dispatching = false;
        this.dispatchPromise = null;
      });
    await this.dispatchPromise;
  }

  private async drain(): Promise<void> {
    for (let processed = 0; processed < 20; processed += 1) {
      if (!(await this.dependencies.dispatcher.runOnce())) break;
    }
  }

  private async shutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.dispatchPromise;
    this.dependencies.runtimeStatus.stop();
    this.dependencies.database.close();
    this.dependencies.instanceLock.release();
    this.logger.info("delivery_stopped");
  }
}
