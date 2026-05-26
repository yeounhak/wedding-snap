import { Client, Connection, WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import { loadClientConnectConfig } from "@temporalio/envconfig";

import { getJobWorkflowId } from "./generate-jobs";

const TASK_QUEUE =
  process.env.TEMPORAL_TASK_QUEUE ?? "wedding-snap-image-generation";

let clientPromise: Promise<Client> | undefined;

export async function startGenerateWorkflow(jobId: string) {
  const client = await getTemporalClient();
  const workflowId = getJobWorkflowId(jobId);

  try {
    await client.workflow.start("generateWeddingImageWorkflow", {
      workflowId,
      taskQueue: TASK_QUEUE,
      args: [jobId],
    });
  } catch (error) {
    if (error instanceof WorkflowExecutionAlreadyStartedError) {
      return;
    }
    throw error;
  }
}

async function getTemporalClient() {
  clientPromise ??= createTemporalClient();
  return clientPromise;
}

async function createTemporalClient() {
  const config = loadClientConnectConfig();
  const connection = await Connection.connect(config.connectionOptions);
  return new Client({
    connection,
    namespace: config.namespace,
  });
}
