#!/bin/bash
set -euo pipefail

echo "Upgrading BetweenNetwork chaincode (channel and ledger data preserved)..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_SAMPLES_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEST_NETWORK_DIR="${TEST_NETWORK_DIR:-${FABRIC_SAMPLES_DIR}/test-network}"
CHAINCODE_DIR="${CHAINCODE_DIR:-${SCRIPT_DIR}/chaincode/participant-chaincode}"
IN_CONTAINER_SAMPLES_DIR="/workspace/fabric-samples"
IN_CONTAINER_TEST_NETWORK_DIR="${IN_CONTAINER_SAMPLES_DIR}/test-network"

cd "${TEST_NETWORK_DIR}"

export PATH="${PWD}/../bin:${PWD}:$PATH"
export FABRIC_CFG_PATH="${PWD}/../config/"
export CORE_PEER_TLS_ENABLED=true
export IMAGE_TAG="${IMAGE_TAG:-2.5.14}"
export FABRIC_TOOLS_IMAGE="${FABRIC_TOOLS_IMAGE:-hyperledger/fabric-tools:${IMAGE_TAG}}"

CC_NAME="${CC_NAME:-participant}"
CC_LABEL="${CC_LABEL:-participant_chaincode_upgrade}"
CC_VERSION="${CC_VERSION:-2.0}"
CC_SEQUENCE="${CC_SEQUENCE:-}"
CC_LANG="${CC_LANG:-golang}"
CHANNEL_NAME="${CHANNEL_NAME:-betweennetwork}"
PKG_FILE="${PKG_FILE:-${CC_LABEL}.tar.gz}"

ORDERER_TLS_CA_IN_NETWORK="${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt"

BETWEEN_PEER_LOCAL="localhost:7051"
BANK1_PEER_LOCAL="localhost:9051"
BANK2_PEER_LOCAL="localhost:11051"

BETWEEN_PEER_NETWORK="peer0.betweenorganization.example.com:7051"
BANK1_PEER_NETWORK="peer0.bank1organization.example.com:9051"
BANK2_PEER_NETWORK="peer0.bank2.example.com:11051"

BETWEEN_TLS="${PWD}/organizations/peerOrganizations/betweenorganization.example.com/peers/peer0.betweenorganization.example.com/tls/ca.crt"
BANK1_TLS="${PWD}/organizations/peerOrganizations/bank1organization.example.com/peers/peer0.bank1organization.example.com/tls/ca.crt"
BANK2_TLS="${PWD}/organizations/peerOrganizations/bank2.example.com/peers/peer0.bank2.example.com/tls/ca.crt"

BETWEEN_ADMIN="${PWD}/organizations/peerOrganizations/betweenorganization.example.com/users/Admin@betweenorganization.example.com/msp"
BANK1_ADMIN="${PWD}/organizations/peerOrganizations/bank1organization.example.com/users/Admin@bank1organization.example.com/msp"
BANK2_ADMIN="${PWD}/organizations/peerOrganizations/bank2.example.com/users/Admin@bank2.example.com/msp"

set_peer_globals() {
  local org="$1"

  case "${org}" in
    between)
      export CORE_PEER_LOCALMSPID="BetweenMSP"
      export CORE_PEER_TLS_ROOTCERT_FILE="${BETWEEN_TLS}"
      export CORE_PEER_MSPCONFIGPATH="${BETWEEN_ADMIN}"
      export CORE_PEER_ADDRESS="${BETWEEN_PEER_LOCAL}"
      ;;
    bank1)
      export CORE_PEER_LOCALMSPID="Bank1MSP"
      export CORE_PEER_TLS_ROOTCERT_FILE="${BANK1_TLS}"
      export CORE_PEER_MSPCONFIGPATH="${BANK1_ADMIN}"
      export CORE_PEER_ADDRESS="${BANK1_PEER_LOCAL}"
      ;;
    bank2)
      export CORE_PEER_LOCALMSPID="Bank2MSP"
      export CORE_PEER_TLS_ROOTCERT_FILE="${BANK2_TLS}"
      export CORE_PEER_MSPCONFIGPATH="${BANK2_ADMIN}"
      export CORE_PEER_ADDRESS="${BANK2_PEER_LOCAL}"
      ;;
    *)
      echo "Unknown org key: ${org}"
      exit 1
      ;;
  esac
}

run_lifecycle_in_network() {
  local msp_id="$1"
  local peer_address="$2"
  local peer_tls="$3"
  local msp_path="$4"
  local peer_args="$5"
  local lifecycle_cmd="$6"

  docker run --rm \
    --network fabric_test \
    -v "${FABRIC_SAMPLES_DIR}:${IN_CONTAINER_SAMPLES_DIR}" \
    -w "${IN_CONTAINER_TEST_NETWORK_DIR}" \
    "${FABRIC_TOOLS_IMAGE}" \
    bash -lc "
      export FABRIC_CFG_PATH=\$PWD/../config/ && \
      export CORE_PEER_TLS_ENABLED=true && \
      export CORE_PEER_LOCALMSPID='${msp_id}' && \
      export CORE_PEER_TLS_ROOTCERT_FILE='${peer_tls}' && \
      export CORE_PEER_MSPCONFIGPATH='${msp_path}' && \
      export CORE_PEER_ADDRESS='${peer_address}' && \
      peer lifecycle chaincode ${lifecycle_cmd} ${peer_args}
    "
}

safe_install() {
  local org="$1"
  echo "Installing package on ${org}..."
  set +e
  local out
  out=$(peer lifecycle chaincode install "${PKG_FILE}" 2>&1)
  local rc=$?
  set -e

  if echo "${out}" | grep -qi "already successfully installed"; then
    echo "${org}: package already installed."
    return 0
  fi

  if [[ ${rc} -ne 0 ]]; then
    echo "${out}"
    exit "${rc}"
  fi

  echo "${out}"
}

approve_for_org() {
  local org_key="$1"
  local msp_id="$2"
  local peer_network=""
  local peer_tls=""
  local msp_path=""

  case "${org_key}" in
    between)
      peer_network="${BETWEEN_PEER_NETWORK}"
      peer_tls="${BETWEEN_TLS}"
      msp_path="${BETWEEN_ADMIN}"
      ;;
    bank1)
      peer_network="${BANK1_PEER_NETWORK}"
      peer_tls="${BANK1_TLS}"
      msp_path="${BANK1_ADMIN}"
      ;;
    bank2)
      peer_network="${BANK2_PEER_NETWORK}"
      peer_tls="${BANK2_TLS}"
      msp_path="${BANK2_ADMIN}"
      ;;
    *)
      echo "Unknown org key: ${org_key}"
      exit 1
      ;;
  esac

  echo "Approving definition for ${msp_id}..."
  run_lifecycle_in_network \
    "${msp_id}" \
    "${peer_network}" \
    "${peer_tls/${TEST_NETWORK_DIR}/${IN_CONTAINER_TEST_NETWORK_DIR}}" \
    "${msp_path/${TEST_NETWORK_DIR}/${IN_CONTAINER_TEST_NETWORK_DIR}}" \
    "--peerAddresses ${peer_network} --tlsRootCertFiles ${peer_tls/${TEST_NETWORK_DIR}/${IN_CONTAINER_TEST_NETWORK_DIR}}" \
    "approveformyorg -o orderer.example.com:7050 --ordererTLSHostnameOverride orderer.example.com --channelID ${CHANNEL_NAME} --name ${CC_NAME} --version ${CC_VERSION} --package-id ${CC_PACKAGE_ID} --sequence ${CC_SEQUENCE} --tls --cafile ${ORDERER_TLS_CA_IN_NETWORK/${TEST_NETWORK_DIR}/${IN_CONTAINER_TEST_NETWORK_DIR}}"
}

if [[ ! -d "${CHAINCODE_DIR}" ]]; then
  echo "Chaincode directory not found: ${CHAINCODE_DIR}"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "orderer.example.com"; then
  echo "Fabric network is not running. Start the BetweenNetwork test network first."
  exit 1
fi

echo "Checking committed definition..."
set_peer_globals between
set +e
CURRENT_SEQ=$(peer lifecycle chaincode querycommitted \
  --channelID "${CHANNEL_NAME}" \
  --name "${CC_NAME}" 2>/dev/null \
  | sed -n 's/.*Sequence: \([0-9]\+\).*/\1/p')
set -e

if [[ -n "${CURRENT_SEQ:-}" ]]; then
  NEXT_SEQ=$((CURRENT_SEQ + 1))
  echo "Current committed sequence: ${CURRENT_SEQ}"
  echo "Required next sequence: ${NEXT_SEQ}"
else
  NEXT_SEQ=1
  echo "No committed definition found. Using initial sequence: ${NEXT_SEQ}"
fi

if [[ -z "${CC_SEQUENCE:-}" ]]; then
  CC_SEQUENCE="${NEXT_SEQ}"
  echo "Auto-selected sequence: ${CC_SEQUENCE}"
elif [[ "${CC_SEQUENCE}" -ne "${NEXT_SEQ}" ]]; then
  echo "ERROR: CC_SEQUENCE must be exactly ${NEXT_SEQ}, not ${CC_SEQUENCE}"
  exit 1
fi

echo "------------------------------------------------------------"
echo "Upgrade target:"
echo "Test network : ${TEST_NETWORK_DIR}"
echo "Chaincode dir: ${CHAINCODE_DIR}"
echo "Channel      : ${CHANNEL_NAME}"
echo "CC Name      : ${CC_NAME}"
echo "Label        : ${CC_LABEL}"
echo "Version      : ${CC_VERSION}"
echo "Sequence     : ${CC_SEQUENCE}"
echo "Organizations: BetweenMSP, Bank1MSP, Bank2MSP"
echo "------------------------------------------------------------"

echo "Packaging chaincode -> ${PKG_FILE}"
rm -f "${PKG_FILE}"

peer lifecycle chaincode package "${PKG_FILE}" \
  --path "${CHAINCODE_DIR}" \
  --lang "${CC_LANG}" \
  --label "${CC_LABEL}"

set_peer_globals between
safe_install "BetweenMSP"

set_peer_globals bank1
safe_install "Bank1MSP"

set_peer_globals bank2
safe_install "Bank2MSP"

echo "Resolving package ID for label: ${CC_LABEL}"
set_peer_globals between
CC_PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | sed -n "s/Package ID: \(.*\), Label: ${CC_LABEL}/\1/p" | head -n 1)

if [[ -z "${CC_PACKAGE_ID:-}" ]]; then
  echo "Could not find package ID for label '${CC_LABEL}'."
  peer lifecycle chaincode queryinstalled
  exit 1
fi

echo "Package ID: ${CC_PACKAGE_ID}"

approve_for_org between BetweenMSP
approve_for_org bank1 Bank1MSP
approve_for_org bank2 Bank2MSP

echo "Checking commit readiness..."
run_lifecycle_in_network \
  "BetweenMSP" \
  "${BETWEEN_PEER_NETWORK}" \
  "${BETWEEN_TLS/${TEST_NETWORK_DIR}/${IN_CONTAINER_TEST_NETWORK_DIR}}" \
  "${BETWEEN_ADMIN/${TEST_NETWORK_DIR}/${IN_CONTAINER_TEST_NETWORK_DIR}}" \
  "" \
  "checkcommitreadiness --channelID ${CHANNEL_NAME} --name ${CC_NAME} --version ${CC_VERSION} --sequence ${CC_SEQUENCE} --output json"

echo "Committing upgraded chaincode definition..."
run_lifecycle_in_network \
  "BetweenMSP" \
  "${BETWEEN_PEER_NETWORK}" \
  "${BETWEEN_TLS/${TEST_NETWORK_DIR}/${IN_CONTAINER_TEST_NETWORK_DIR}}" \
  "${BETWEEN_ADMIN/${TEST_NETWORK_DIR}/${IN_CONTAINER_TEST_NETWORK_DIR}}" \
  "--peerAddresses ${BETWEEN_PEER_NETWORK} --tlsRootCertFiles ${BETWEEN_TLS/${TEST_NETWORK_DIR}/${IN_CONTAINER_TEST_NETWORK_DIR}} --peerAddresses ${BANK1_PEER_NETWORK} --tlsRootCertFiles ${BANK1_TLS/${TEST_NETWORK_DIR}/${IN_CONTAINER_TEST_NETWORK_DIR}} --peerAddresses ${BANK2_PEER_NETWORK} --tlsRootCertFiles ${BANK2_TLS/${TEST_NETWORK_DIR}/${IN_CONTAINER_TEST_NETWORK_DIR}}" \
  "commit -o orderer.example.com:7050 --ordererTLSHostnameOverride orderer.example.com --channelID ${CHANNEL_NAME} --name ${CC_NAME} --version ${CC_VERSION} --sequence ${CC_SEQUENCE} --tls --cafile ${ORDERER_TLS_CA_IN_NETWORK/${TEST_NETWORK_DIR}/${IN_CONTAINER_TEST_NETWORK_DIR}}"

echo "Querying committed definition..."
run_lifecycle_in_network \
  "BetweenMSP" \
  "${BETWEEN_PEER_NETWORK}" \
  "${BETWEEN_TLS/${TEST_NETWORK_DIR}/${IN_CONTAINER_TEST_NETWORK_DIR}}" \
  "${BETWEEN_ADMIN/${TEST_NETWORK_DIR}/${IN_CONTAINER_TEST_NETWORK_DIR}}" \
  "" \
  "querycommitted --channelID ${CHANNEL_NAME} --name ${CC_NAME}"

echo "Test query:"
peer chaincode query -C "${CHANNEL_NAME}" -n "${CC_NAME}" -c '{"Args":["GetAllParticipants"]}'

echo "Upgrade complete."
