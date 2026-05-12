import { Worker } from "bullmq";
import { redis } from "../db/redis.ts";
import { prisma } from "../db/prisma.ts";
import { enqueueSync, nextDelayMs, type SyncPairJob } from "../queues/sync-queue.ts";
import { syncPair } from "../sync/sync-pair.ts";

export async function rebuildSyncSchedules(): Promise<void> {
  const pairs = await prisma.pair.findMany({
    where: { status: "active" },
    select: { id: true },
  });
  await Promise.all(pairs.map((pair) => enqueueSync(pair.id)));
}

export function startSyncWorker(): Worker<SyncPairJob> {
  return new Worker<SyncPairJob>(
    "sync-pairs",
    async (job) => {
      const result = await syncPair(job.data.pairId);
      await enqueueSync(job.data.pairId, nextDelayMs(result.active));
      return result;
    },
    { connection: redis },
  );
}
