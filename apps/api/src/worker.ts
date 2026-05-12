import { rebuildSyncSchedules, startSyncWorker } from "./workers/sync-worker.ts";

await rebuildSyncSchedules();
const worker = startSyncWorker();

worker.on("completed", (job) => {
  console.log(`sync job completed: ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`sync job failed: ${job?.id}`, err);
});
