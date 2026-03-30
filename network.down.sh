#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_SAMPLES_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEST_NETWORK_DIR="${TEST_NETWORK_DIR:-${FABRIC_SAMPLES_DIR}/test-network}"

export IMAGE_TAG="${IMAGE_TAG:-2.5.14}"
export CA_IMAGE_TAG="${CA_IMAGE_TAG:-1.5.15}"
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-net}"

CHANNEL_NAME="${CHANNEL_NAME:-betweennetwork}"
CC_LABEL="${CC_LABEL:-participant_chaincode_1}"
PKG_FILE="${PKG_FILE:-${CC_LABEL}.tar.gz}"

cleanup_networks() {
  local networks=("fabric_test" "${COMPOSE_PROJECT_NAME}_test")

  for network_name in "${networks[@]}"; do
    if docker network inspect "${network_name}" >/dev/null 2>&1; then
      echo "Removing docker network: ${network_name}"
      docker network rm "${network_name}" >/dev/null 2>&1 || true
    fi
  done
}

cleanup_volumes() {
  local volumes=(
    "${COMPOSE_PROJECT_NAME}_orderer.example.com"
    "${COMPOSE_PROJECT_NAME}_peer0.betweenorganization.example.com"
    "${COMPOSE_PROJECT_NAME}_peer0.bank1organization.example.com"
    "${COMPOSE_PROJECT_NAME}_peer0.bank2.example.com"
  )

  for volume_name in "${volumes[@]}"; do
    if docker volume inspect "${volume_name}" >/dev/null 2>&1; then
      echo "Removing docker volume: ${volume_name}"
      docker volume rm "${volume_name}" >/dev/null 2>&1 || true
    fi
  done
}

cleanup_local_artifacts() {
  if [[ -f "${TEST_NETWORK_DIR}/${PKG_FILE}" ]]; then
    echo "Removing packaged chaincode artifact: ${TEST_NETWORK_DIR}/${PKG_FILE}"
    rm -f "${TEST_NETWORK_DIR}/${PKG_FILE}"
  fi
}

echo "Stopping BetweenNetwork Fabric network..."
cd "${TEST_NETWORK_DIR}"

./network.sh down || true

cleanup_networks
cleanup_volumes
cleanup_local_artifacts

echo "BetweenNetwork Fabric network cleanup completed."
