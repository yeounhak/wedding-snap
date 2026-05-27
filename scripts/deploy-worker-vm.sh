#!/usr/bin/env bash
set -euo pipefail

: "${IMAGE:?IMAGE is required}"
: "${BUILD_ID:?BUILD_ID is required}"

DEPLOYMENT_NAME="${TEMPORAL_WORKER_DEPLOYMENT_NAME:-wedding-snap-worker}"
ENV_FILE="${WEDDING_SNAP_WORKER_ENV_FILE:-/etc/wedding-snap/worker.env}"
KEEP_VERSIONS="${WEDDING_SNAP_WORKER_KEEP_VERSIONS:-3}"
SHORT_BUILD_ID="${BUILD_ID:0:12}"
CONTAINER_NAME="wedding-snap-worker-${SHORT_BUILD_ID}"
UNIT_NAME="${CONTAINER_NAME}.service"
UNIT_PATH="/etc/systemd/system/${UNIT_NAME}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing worker env file: ${ENV_FILE}" >&2
  exit 1
fi

PODMAN_BIN="${PODMAN_BIN:-$(command -v podman || true)}"
if [[ -z "${PODMAN_BIN}" ]]; then
  echo "podman is required on the worker VM" >&2
  exit 1
fi

TEMPORAL_BIN="${TEMPORAL_BIN:-$(command -v temporal || true)}"
if [[ -z "${TEMPORAL_BIN}" ]]; then
  echo "temporal CLI is required on the worker VM" >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
. "${ENV_FILE}"
set +a

strip_trailing_cr() {
  local var_name="$1"
  if [[ -v "${var_name}" ]]; then
    printf -v "${var_name}" '%s' "${!var_name%$'\r'}"
    export "${var_name}"
  fi
}

strip_trailing_cr TEMPORAL_ADDRESS
strip_trailing_cr TEMPORAL_NAMESPACE
strip_trailing_cr TEMPORAL_API_KEY

registry_host="${IMAGE%%/*}"
registry_token=""
if command -v gcloud >/dev/null 2>&1; then
  registry_token="$(timeout 30s gcloud auth print-access-token --quiet 2>/dev/null || true)"
fi

if [[ -z "${registry_token}" ]] && command -v curl >/dev/null 2>&1; then
  metadata_token_json="$(curl -fsS --connect-timeout 2 --max-time 10 \
    -H "Metadata-Flavor: Google" \
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" 2>/dev/null || true)"
  registry_token="$(printf '%s' "${metadata_token_json}" |
    sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
fi

if [[ -z "${registry_token}" ]]; then
  echo "Could not obtain a registry access token on the worker VM" >&2
  exit 1
fi

printf '%s\n' "${registry_token}" |
  "${PODMAN_BIN}" login \
    --username oauth2accesstoken \
    --password-stdin \
    "https://${registry_host}"
unset registry_token metadata_token_json

"${PODMAN_BIN}" pull "${IMAGE}"

cat >"${UNIT_PATH}" <<UNIT
[Unit]
Description=Wedding Snap Temporal Worker ${BUILD_ID}
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=${ENV_FILE}
ExecStartPre=-${PODMAN_BIN} rm -f ${CONTAINER_NAME}
ExecStart=${PODMAN_BIN} run --rm \\
  --name ${CONTAINER_NAME} \\
  --env-file ${ENV_FILE} \\
  --env APP_BUILD_ID=${BUILD_ID} \\
  --env TEMPORAL_WORKER_VERSIONING=required \\
  --env TEMPORAL_WORKER_DEPLOYMENT_NAME=${DEPLOYMENT_NAME} \\
  ${IMAGE}
ExecStop=${PODMAN_BIN} stop -t 420 ${CONTAINER_NAME}
Restart=always
RestartSec=5
TimeoutStopSec=450
KillSignal=SIGTERM

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now "${UNIT_NAME}"

for _ in {1..30}; do
  if systemctl is-active --quiet "${UNIT_NAME}"; then
    break
  fi
  sleep 2
done

if ! systemctl is-active --quiet "${UNIT_NAME}"; then
  systemctl status "${UNIT_NAME}" --no-pager >&2 || true
  journalctl -u "${UNIT_NAME}" -n 120 --no-pager >&2 || true
  exit 1
fi

temporal_args=()
if [[ -n "${TEMPORAL_ADDRESS:-}" ]]; then
  temporal_args+=(--address "${TEMPORAL_ADDRESS}")
fi
if [[ -n "${TEMPORAL_NAMESPACE:-}" ]]; then
  temporal_args+=(--namespace "${TEMPORAL_NAMESPACE}")
fi
if [[ -n "${TEMPORAL_API_KEY:-}" ]]; then
  temporal_args+=(--tls)
fi

deployment_visible=false
for _ in {1..60}; do
  if "${TEMPORAL_BIN}" "${temporal_args[@]}" worker deployment describe-version \
    --deployment-name "${DEPLOYMENT_NAME}" \
    --build-id "${BUILD_ID}" >/dev/null 2>&1; then
    deployment_visible=true
    break
  fi
  sleep 5
done

if [[ "${deployment_visible}" != "true" ]]; then
  journalctl -u "${UNIT_NAME}" -n 120 --no-pager >&2 || true
  echo "Worker deployment version did not become visible: ${DEPLOYMENT_NAME}:${BUILD_ID}" >&2
  exit 1
fi

"${TEMPORAL_BIN}" "${temporal_args[@]}" worker deployment set-current-version \
  --deployment-name "${DEPLOYMENT_NAME}" \
  --build-id "${BUILD_ID}" \
  --yes

mapfile -t unit_paths < <(ls -1t /etc/systemd/system/wedding-snap-worker-*.service 2>/dev/null || true)
index=0
for unit_path in "${unit_paths[@]}"; do
  unit="$(basename "${unit_path}")"
  index=$((index + 1))
  if (( index > KEEP_VERSIONS )); then
    systemctl disable --now "${unit}" || true
    rm -f "${unit_path}"
  fi
done

systemctl daemon-reload
systemctl status "${UNIT_NAME}" --no-pager
