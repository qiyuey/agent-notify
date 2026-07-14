import { describe, expect, it, vi } from "vitest";
import { DeliveryApplication } from "../src/application/delivery-application.js";

describe("DeliveryApplication", () => {
  it("drains queued work and releases resources on stop", async () => {
    const runOnce = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const database = { close: vi.fn() };
    const runtimeStatus = { start: vi.fn(), stop: vi.fn() };
    const instanceLock = { acquire: vi.fn(), release: vi.fn() };
    const application = new DeliveryApplication({
      dispatchIntervalMs: 100,
      database,
      dispatcher: { runOnce },
      runtimeStatus,
      instanceLock,
    });

    const running = application.run();
    await vi.waitFor(() => expect(runOnce).toHaveBeenCalledTimes(2));
    await application.stop();
    await running;

    expect(instanceLock.acquire).toHaveBeenCalledOnce();
    expect(instanceLock.release).toHaveBeenCalledOnce();
    expect(runtimeStatus.start).toHaveBeenCalledOnce();
    expect(runtimeStatus.stop).toHaveBeenCalledOnce();
    expect(database.close).toHaveBeenCalledOnce();
  });

  it("logs dispatcher failures without crashing the daemon", async () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const application = new DeliveryApplication({
      dispatchIntervalMs: 100,
      database: { close: vi.fn() },
      dispatcher: { runOnce: vi.fn(async () => Promise.reject(new Error("failed"))) },
      runtimeStatus: { start: vi.fn(), stop: vi.fn() },
      instanceLock: { acquire: vi.fn(), release: vi.fn() },
      logger,
    });
    const running = application.run();
    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledOnce());
    await application.stop();
    await running;
  });
});
