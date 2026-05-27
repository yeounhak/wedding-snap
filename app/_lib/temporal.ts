import { Client, Connection, WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import { loadClientConnectConfig } from "@temporalio/envconfig";

import { getJobWorkflowId } from "./generate-jobs";
import {
  getTemporalWorkflowVersioningOverride,
  type TemporalWorkerDeploymentVersion,
  type TemporalWorkflowVersioningOverride,
} from "./temporal-versioning";

const TASK_QUEUE =
  process.env.TEMPORAL_TASK_QUEUE ?? "wedding-snap-image-generation";

let clientPromise: Promise<Client> | undefined;

export type GenerateWorkflowVersioning = {
  deploymentVersion?: TemporalWorkerDeploymentVersion;
  versioningOverride?: TemporalWorkflowVersioningOverride;
};

export function resolveGenerateWorkflowVersioning(): GenerateWorkflowVersioning {
  const versioningOverride = getTemporalWorkflowVersioningOverride();
  return {
    deploymentVersion: versioningOverride?.pinnedTo,
    versioningOverride,
  };
}

export async function startGenerateWorkflow(
  jobId: string,
  versioning = resolveGenerateWorkflowVersioning(),
) {
  const client = await getTemporalClient();
  const workflowId = getJobWorkflowId(jobId);

  try {
    await client.workflow.start("generateWeddingImageWorkflow", {
      workflowId,
      taskQueue: TASK_QUEUE,
      args: [jobId],
      versioningOverride: versioning.versioningOverride,
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
