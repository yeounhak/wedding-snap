import { proxyActivities, setWorkflowOptions } from "@temporalio/workflow";

import type * as activities from "./activities";

const jobActivities = proxyActivities<
  Pick<
    typeof activities,
    "markJobRunning" | "markJobSucceeded" | "markJobFailed"
  >
>({
  startToCloseTimeout: "30 seconds",
  retry: {
    maximumAttempts: 5,
  },
});

const imageActivities = proxyActivities<
  Pick<typeof activities, "generateWeddingImage">
>({
  startToCloseTimeout: "10 minutes",
  retry: {
    initialInterval: "5 seconds",
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export async function generateWeddingImageWorkflow(jobId: string) {
  await jobActivities.markJobRunning(jobId);

  try {
    const result = await imageActivities.generateWeddingImage(jobId);
    await jobActivities.markJobSucceeded(jobId, result);
    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Image generation failed";
    await jobActivities.markJobFailed(jobId, message);
    throw error;
  }
}

setWorkflowOptions(
  { versioningBehavior: "PINNED" },
  generateWeddingImageWorkflow,
);
