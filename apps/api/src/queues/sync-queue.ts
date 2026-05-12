import { Queue } from "bullmq";
import { config } from "../config.ts";
import { redis } from "../db/redis.ts";

export type SyncPairJob = {
  pairId: string;
};

export const syncQueue = new Queue<SyncPairJob>("sync-pairs", {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

export async function enqueueSync(pairId: string, delayMs = 0): Promise<void> {
  await syncQueue.add(
    "sync-pair",
    { pairId },
    {
      jobId: `sync-pair:${pairId}`,
      delay: delayMs,
    },
  );
}

export function nextDelayMs(active: boolean): number {
  const seconds = active ? config.SYNC_ACTIVE_INTERVAL_SECONDS : config.SYNC_IDLE_INTERVAL_SECONDS;
  const jitter = Math.floor(Math.random() * 5000);
  return seconds * 1000 + jitter;
}
