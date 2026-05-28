import "dotenv/config";

import { loadClientConnectConfig } from "@temporalio/envconfig";
import { NativeConnection, Worker } from "@temporalio/worker";

import { resolveTemporalWorkerDeploymentVersion } from "../app/_lib/temporal-versioning";
import * as activities from "./activities";

const TASK_QUEUE =
  process.env.TEMPORAL_TASK_QUEUE ?? "wedding-snap-image-generation";

async function main() {
  const config = loadClientConnectConfig();
  const deploymentVersion = resolveTemporalWorkerDeploymentVersion();
  const connection = await NativeConnection.connect(config.connectionOptions);
  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: TASK_QUEUE,
    workflowsPath: require.resolve("./workflows"),
    activities,
    ...(deploymentVersion
      ? {
          workerDeploymentOptions: {
            useWorkerVersioning: true,
            version: deploymentVersion,
            defaultVersioningBehavior: "PINNED" as const,
          },
        }
      : {}),
    shutdownGraceTime: "12 minutes",
  });

  console.log(
    JSON.stringify({
      event: "temporal_worker_polling",
      taskQueue: TASK_QUEUE,
      namespace: config.namespace,
      deploymentName: deploymentVersion?.deploymentName,
      buildId: deploymentVersion?.buildId,
    }),
  );
  await worker.run();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
