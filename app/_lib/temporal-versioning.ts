export type TemporalWorkerVersioningMode = "off" | "required";

export type TemporalWorkerDeploymentVersion = {
  readonly deploymentName: string;
  readonly buildId: string;
};

export type TemporalWorkflowVersioningOverride = {
  readonly pinnedTo: TemporalWorkerDeploymentVersion;
};

const DEFAULT_DEPLOYMENT_NAME = "wedding-snap-worker";

export function getTemporalWorkerVersioningMode(): TemporalWorkerVersioningMode {
  const raw = (process.env.TEMPORAL_WORKER_VERSIONING ?? "off")
    .trim()
    .toLowerCase();

  if (raw === "off" || raw === "required") {
    return raw;
  }

  throw new Error(
    "TEMPORAL_WORKER_VERSIONING must be one of: off, required",
  );
}

export function getTemporalWorkerDeploymentName() {
  return (
    process.env.TEMPORAL_WORKER_DEPLOYMENT_NAME?.trim() ||
    DEFAULT_DEPLOYMENT_NAME
  );
}

export function getAppBuildId() {
  return (
    process.env.APP_BUILD_ID?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.GITHUB_SHA?.trim() ||
    undefined
  );
}

export function resolveTemporalWorkerDeploymentVersion():
  | TemporalWorkerDeploymentVersion
  | undefined {
  const mode = getTemporalWorkerVersioningMode();
  if (mode === "off") {
    return undefined;
  }

  const buildId = getAppBuildId();
  if (!buildId) {
    throw new Error(
      "TEMPORAL_WORKER_VERSIONING=required requires APP_BUILD_ID, VERCEL_GIT_COMMIT_SHA, or GITHUB_SHA",
    );
  }

  return {
    deploymentName: getTemporalWorkerDeploymentName(),
    buildId,
  };
}

export function getTemporalWorkflowVersioningOverride():
  | TemporalWorkflowVersioningOverride
  | undefined {
  const deploymentVersion = resolveTemporalWorkerDeploymentVersion();
  return deploymentVersion ? { pinnedTo: deploymentVersion } : undefined;
}
