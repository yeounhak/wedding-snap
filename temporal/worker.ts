import "dotenv/config";

import { loadClientConnectConfig } from "@temporalio/envconfig";
import { NativeConnection, Worker } from "@temporalio/worker";

import * as activities from "./activities";

const TASK_QUEUE =
  process.env.TEMPORAL_TASK_QUEUE ?? "wedding-snap-image-generation";

async function main() {
  const config = loadClientConnectConfig();
  const connection = await NativeConnection.connect(config.connectionOptions);
  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: TASK_QUEUE,
    workflowsPath: require.resolve("./workflows"),
    activities,
  });

  console.log(`Temporal worker polling task queue: ${TASK_QUEUE}`);
  await worker.run();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
