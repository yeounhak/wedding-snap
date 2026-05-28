#!/usr/bin/env bash
set -euo pipefail

: "${IMAGE:?IMAGE is required}"
: "${BUILD_ID:?BUILD_ID is required}"

DEPLOYMENT_NAME="${TEMPORAL_WORKER_DEPLOYMENT_NAME:-wedding-snap-worker}"
ENV_FILE="${WEDDING_SNAP_WORKER_ENV_FILE:-/etc/wedding-snap/worker.env}"
STOP_TIMEOUT_SECONDS="${WEDDING_SNAP_WORKER_STOP_TIMEOUT_SECONDS:-30}"
SHORT_BUILD_ID="${BUILD_ID:0:12}"
CONTAINER_NAME="wedding-snap-worker-${SHORT_BUILD_ID}"
UNIT_NAME="${CONTAINER_NAME}.service"
UNIT_PATH="/etc/systemd/system/${UNIT_NAME}"

if ! [[ "${STOP_TIMEOUT_SECONDS}" =~ ^[0-9]+$ ]]; then
  echo "WEDDING_SNAP_WORKER_STOP_TIMEOUT_SECONDS must be a non-negative integer" >&2
  exit 1
fi

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

stop_systemd_unit() {
  local unit="$1"
  local stop_deadline=$((STOP_TIMEOUT_SECONDS + 15))

  if ! systemctl list-unit-files --no-legend --no-pager "${unit}" 2>/dev/null | grep -q . &&
    ! systemctl list-units --all --no-legend --no-pager "${unit}" 2>/dev/null | grep -q .; then
    return 0
  fi

  echo "Stopping previous worker unit: ${unit}"
  if ! timeout "${stop_deadline}s" systemctl stop "${unit}" >/dev/null 2>&1; then
    echo "Worker unit did not stop within ${stop_deadline}s; killing: ${unit}" >&2
    systemctl kill --kill-who=all "${unit}" >/dev/null 2>&1 || true
    timeout 10s systemctl stop "${unit}" >/dev/null 2>&1 || true
  fi

  systemctl disable "${unit}" >/dev/null 2>&1 || true
}

remove_worker_container() {
  local container="$1"

  if [[ "${container}" == "${CONTAINER_NAME}" ]]; then
    return 0
  fi

  "${PODMAN_BIN}" rm -f "${container}" >/dev/null 2>&1 || true
}

cleanup_previous_workers() {
  local unit unit_path container

  # Clean up the pre-versioning service/container name used by early VM deploys.
  stop_systemd_unit "wedding-snap-temporal-worker.service"
  rm -f /etc/systemd/system/wedding-snap-temporal-worker.service
  "${PODMAN_BIN}" rm -f wedding-snap-temporal-worker >/dev/null 2>&1 || true

  while IFS= read -r unit; do
    [[ -n "${unit}" ]] || continue
    [[ "${unit}" == "${UNIT_NAME}" ]] && continue
    stop_systemd_unit "${unit}"
  done < <(systemctl list-unit-files --no-legend --no-pager 'wedding-snap-worker-*.service' 2>/dev/null | awk '{print $1}' || true)

  for unit_path in /etc/systemd/system/wedding-snap-worker-*.service; do
    [[ -e "${unit_path}" ]] || continue
    unit="$(basename "${unit_path}")"
    [[ "${unit}" == "${UNIT_NAME}" ]] && continue
    rm -f "${unit_path}"
  done

  while IFS= read -r container; do
    [[ "${container}" == wedding-snap-worker-* ]] || continue
    remove_worker_container "${container}"
  done < <("${PODMAN_BIN}" ps -a --format '{{.Names}}' 2>/dev/null || true)
}

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
ExecStop=${PODMAN_BIN} stop -t ${STOP_TIMEOUT_SECONDS} ${CONTAINER_NAME}
Restart=always
RestartSec=5
TimeoutStopSec=$((STOP_TIMEOUT_SECONDS + 30))
KillSignal=SIGTERM

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
cleanup_previous_workers
systemctl daemon-reload
systemctl enable "${UNIT_NAME}"
systemctl restart "${UNIT_NAME}"

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
  if "${TEMPORAL_BIN}" worker deployment describe-version \
    --deployment-name "${DEPLOYMENT_NAME}" \
    --build-id "${BUILD_ID}" \
    "${temporal_args[@]}" >/dev/null 2>&1; then
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

"${TEMPORAL_BIN}" worker deployment set-current-version \
  --deployment-name "${DEPLOYMENT_NAME}" \
  --build-id "${BUILD_ID}" \
  --yes \
  "${temporal_args[@]}"

cleanup_previous_workers
systemctl daemon-reload
systemctl status "${UNIT_NAME}" --no-pager
