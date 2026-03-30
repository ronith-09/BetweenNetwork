const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { Gateway, Wallets } = require('fabric-network');

class BlockchainService {
  static isRecoverableDiscoveryError(error) {
    const message = String(error?.message || error || '');
    return (
      (
        message.includes('DiscoveryService') &&
        message.includes('access denied')
      ) ||
      (
        message.includes('DiscoveryService') &&
        message.includes('failed constructing descriptor')
      ) ||
      message.includes('no peer combination can satisfy the endorsement policy')
    );
  }

  static getDefaultFabricChannelName() {
    return process.env.FABRIC_CHANNEL_NAME || 'betweennetwork';
  }

  static getDefaultFabricChaincodeName() {
    return process.env.FABRIC_CHAINCODE_NAME || 'participant';
  }

  static getBackendRoot() {
    return path.resolve(__dirname, '..', '..');
  }

  static getFabricSamplesRoot() {
    return path.resolve(this.getBackendRoot(), '..', '..');
  }

  static getTestNetworkRoot() {
    return process.env.TEST_NETWORK_DIR || path.join(this.getFabricSamplesRoot(), 'test-network');
  }

  static getDefaultAdminName() {
    return (
      process.env.BETWEENNETWORK_DEFAULT_ADMIN_NAME ||
      process.env.FABRIC_ADMIN_USER ||
      'admin'
    );
  }

  static async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  static buildIdentityForWallet(identity, label = 'admin') {
    if (!identity || !identity.mspId || !identity.certificate || !identity.privateKey) {
      throw new Error('Wallet identity is missing certificate, private key, or MSP ID');
    }

    return {
      label,
      identity: {
        credentials: {
          certificate: identity.certificate,
          privateKey: identity.privateKey
        },
        mspId: identity.mspId,
        type: identity.type || 'X.509'
      }
    };
  }

  static async resolveAdminIdentity(context = {}) {
    if (context.adminIdentity) {
      return context.adminIdentity;
    }

    const WalletService = require('../wallet/wallet.service');
    return WalletService.getBetweenNetworkAdminIdentity(
      context.adminName || this.getDefaultAdminName()
    );
  }

  static async resolveSignerIdentity(context = {}) {
    if (context.participantIdentity) {
      return context.participantIdentity;
    }

    return this.resolveAdminIdentity(context);
  }

  static async buildEmbeddedConnectionProfile() {
    const testNetworkRoot = this.getTestNetworkRoot();
    const ordererTlsPath = path.join(
      testNetworkRoot,
      'organizations',
      'ordererOrganizations',
      'example.com',
      'orderers',
      'orderer.example.com',
      'tls',
      'ca.crt'
    );

    const peerConfigs = [
      {
        orgName: 'BetweenOrganization',
        mspId: 'BetweenMSP',
        peerName: 'peer0.betweenorganization.example.com',
        url: 'grpcs://localhost:7051',
        tlsPath: path.join(
          testNetworkRoot,
          'organizations',
          'peerOrganizations',
          'betweenorganization.example.com',
          'peers',
          'peer0.betweenorganization.example.com',
          'tls',
          'ca.crt'
        )
      },
      {
        orgName: 'Bank1Organization',
        mspId: 'Bank1MSP',
        peerName: 'peer0.bank1organization.example.com',
        url: 'grpcs://localhost:9051',
        tlsPath: path.join(
          testNetworkRoot,
          'organizations',
          'peerOrganizations',
          'bank1organization.example.com',
          'peers',
          'peer0.bank1organization.example.com',
          'tls',
          'ca.crt'
        )
      },
      {
        orgName: 'Bank2Organization',
        mspId: 'Bank2MSP',
        peerName: 'peer0.bank2.example.com',
        url: 'grpcs://localhost:11051',
        tlsPath: path.join(
          testNetworkRoot,
          'organizations',
          'peerOrganizations',
          'bank2.example.com',
          'peers',
          'peer0.bank2.example.com',
          'tls',
          'ca.crt'
        )
      },
      {
        orgName: 'BankDOrganization',
        mspId: 'BankDMSP',
        peerName: 'peer0.bankd.example.com',
        url: 'grpcs://localhost:12051',
        tlsPath: path.join(
          testNetworkRoot,
          'organizations',
          'peerOrganizations',
          'bankd.example.com',
          'peers',
          'peer0.bankd.example.com',
          'tls',
          'ca.crt'
        )
      }
    ];

    const availablePeerConfigs = [];
    for (const peerConfig of peerConfigs) {
      if (await this.fileExists(peerConfig.tlsPath)) {
        availablePeerConfigs.push(peerConfig);
      }
    }

    if (availablePeerConfigs.length === 0 || !(await this.fileExists(ordererTlsPath))) {
      return null;
    }

    const peerTlsEntries = await Promise.all(
      availablePeerConfigs.map(async (peerConfig) => ({
        ...peerConfig,
        tlsPem: await fs.readFile(peerConfig.tlsPath, 'utf8')
      }))
    );
    const ordererTlsPem = await fs.readFile(ordererTlsPath, 'utf8');

    const organizations = {};
    const peers = {};
    const channelPeers = {};

    for (const peerConfig of peerTlsEntries) {
      organizations[peerConfig.orgName] = {
        mspid: peerConfig.mspId,
        peers: [peerConfig.peerName]
      };

      peers[peerConfig.peerName] = {
        url: peerConfig.url,
        tlsCACerts: {
          pem: peerConfig.tlsPem
        },
        grpcOptions: {
          'ssl-target-name-override': peerConfig.peerName,
          hostnameOverride: peerConfig.peerName
        }
      };

      channelPeers[peerConfig.peerName] = {
        endorsingPeer: true,
        chaincodeQuery: true,
        ledgerQuery: true,
        eventSource: true
      };
    }

    return {
      name: 'betweennetwork',
      version: '1.0.0',
      client: {
        organization: 'BetweenOrganization',
        connection: {
          timeout: {
            peer: {
              endorser: '300'
            }
          }
        }
      },
      organizations,
      orderers: {
        'orderer.example.com': {
          url: 'grpcs://localhost:7050',
          tlsCACerts: {
            pem: ordererTlsPem
          },
          grpcOptions: {
            'ssl-target-name-override': 'orderer.example.com',
            hostnameOverride: 'orderer.example.com'
          }
        }
      },
      channels: {
        [this.getDefaultFabricChannelName()]: {
          orderers: ['orderer.example.com'],
          peers: channelPeers
        }
      },
      peers
    };
  }

  static async resolveGatewaySettings(context = {}) {
    if (context.connectionProfile && typeof context.connectionProfile === 'object') {
      return {
        connectionProfile: context.connectionProfile,
        profileSource: context.gatewayProfile || 'context-connection-profile',
        channelName: context.channelName || this.getDefaultFabricChannelName(),
        chaincodeName: context.chaincodeName || this.getDefaultFabricChaincodeName()
      };
    }

    const envProfilePath = context.gatewayProfile || process.env.FABRIC_CONNECTION_PROFILE;
    if (envProfilePath) {
      if (await this.fileExists(envProfilePath)) {
        const profileRaw = await fs.readFile(envProfilePath, 'utf8');
        return {
          connectionProfile: JSON.parse(profileRaw),
          profileSource: envProfilePath,
          channelName: context.channelName || this.getDefaultFabricChannelName(),
          chaincodeName: context.chaincodeName || this.getDefaultFabricChaincodeName()
        };
      }
    }

    const connectionProfile = await this.buildEmbeddedConnectionProfile();
    if (!connectionProfile) {
      return null;
    }

    return {
      connectionProfile,
      profileSource: 'embedded-test-network',
      channelName: context.channelName || this.getDefaultFabricChannelName(),
      chaincodeName: context.chaincodeName || this.getDefaultFabricChaincodeName()
    };
  }

  static async createGatewayContext(context = {}) {
    const gatewaySettings = await this.resolveGatewaySettings(context);
    if (!gatewaySettings) {
      throw new Error('Real Fabric gateway settings are not configured');
    }

    const wallet = await Wallets.newInMemoryWallet();
    const resolvedSignerIdentity = await this.resolveSignerIdentity(context);
    const signerIdentity = this.buildIdentityForWallet(
      resolvedSignerIdentity,
      resolvedSignerIdentity?.label || this.getDefaultAdminName()
    );
    await wallet.put(signerIdentity.label, signerIdentity.identity);

    const gateway = new Gateway();
    const discoveryAsLocalhost = String(process.env.FABRIC_DISCOVERY_AS_LOCALHOST || 'true') === 'true';
    const discoveryEnabled = context.forceDiscoveryDisabled
      ? false
      : String(process.env.FABRIC_DISCOVERY_ENABLED || 'true') === 'true';

    const connectGateway = async (enabled) => {
      await gateway.connect(gatewaySettings.connectionProfile, {
        wallet,
        identity: signerIdentity.label,
        discovery: {
          enabled,
          asLocalhost: discoveryAsLocalhost
        }
      });

      return {
        gateway,
        network: await gateway.getNetwork(gatewaySettings.channelName),
        chaincodeName: gatewaySettings.chaincodeName,
        profileSource: gatewaySettings.profileSource
      };
    };

    try {
      return await connectGateway(discoveryEnabled);
    } catch (error) {
      gateway.disconnect();

      if (!discoveryEnabled || !this.isRecoverableDiscoveryError(error)) {
        throw error;
      }

      const fallbackGateway = new Gateway();
      await fallbackGateway.connect(gatewaySettings.connectionProfile, {
        wallet,
        identity: signerIdentity.label,
        discovery: {
          enabled: false,
          asLocalhost: discoveryAsLocalhost
        }
      });

      return {
        gateway: fallbackGateway,
        network: await fallbackGateway.getNetwork(gatewaySettings.channelName),
        chaincodeName: gatewaySettings.chaincodeName,
        profileSource: `${gatewaySettings.profileSource}:discovery-disabled`
      };
    }
  }

  static async initializeConnection(options = {}) {
    const gatewaySettings = await this.resolveGatewaySettings(options);
    return {
      success: true,
      message: 'Blockchain connection initialized',
      gatewayProfile: gatewaySettings?.profileSource || null,
      channelName: gatewaySettings?.channelName || null,
      chaincodeName: gatewaySettings?.chaincodeName || null
    };
  }

  static buildTransactionId(prefix) {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  static async submitTransaction(functionName, args, context = {}) {
    const gatewaySettings = await this.resolveGatewaySettings(context);
    if (gatewaySettings) {
      const executeSubmit = async (runtimeContext) => {
        const { gateway, network, chaincodeName } = await this.createGatewayContext(runtimeContext);

        try {
          const contract = network.getContract(chaincodeName);
          const transaction = contract.createTransaction(functionName);
          const payloadBuffer = await transaction.submit(...args.map((value) => String(value)));
          const payload = payloadBuffer && payloadBuffer.length > 0
            ? payloadBuffer.toString('utf8')
            : null;

          return {
            success: true,
            txId: transaction.getTransactionId(),
            functionName,
            args,
            payload,
            signer: runtimeContext.participantIdentity
              ? runtimeContext.participantIdentity.label
              : runtimeContext.adminIdentity
                ? runtimeContext.adminIdentity.label
                : (runtimeContext.adminName || this.getDefaultAdminName()),
            channelName: gatewaySettings.channelName,
            chaincodeName
          };
        } finally {
          gateway.disconnect();
        }
      };

      try {
        return await executeSubmit(context);
      } catch (error) {
        if (
          String(context.forceDiscoveryDisabled || 'false') === 'true' ||
          !this.isRecoverableDiscoveryError(error)
        ) {
          throw error;
        }

        return executeSubmit({
          ...context,
          forceDiscoveryDisabled: true
        });
      }
    }

    await this.initializeConnection(context);

    return {
      success: true,
      txId: this.buildTransactionId(functionName),
      functionName,
      args,
      signer: context.participantIdentity
        ? context.participantIdentity.label
        : context.adminIdentity
          ? context.adminIdentity.label
          : (context.adminName || this.getDefaultAdminName()),
      channelName: gatewaySettings?.channelName || null,
      chaincodeName: gatewaySettings?.chaincodeName || null
    };
  }

  static async evaluateTransaction(functionName, args, context = {}) {
    const gatewaySettings = await this.resolveGatewaySettings(context);
    if (gatewaySettings) {
      const executeEvaluate = async (runtimeContext) => {
        const { gateway, network, chaincodeName } = await this.createGatewayContext(runtimeContext);

        try {
          const contract = network.getContract(chaincodeName);
          const payloadBuffer = await contract.evaluateTransaction(
            functionName,
            ...args.map((value) => String(value))
          );
          const payload = payloadBuffer && payloadBuffer.length > 0
            ? payloadBuffer.toString('utf8')
            : null;

          return {
            success: true,
            txId: null,
            functionName,
            args,
            payload,
            signer: runtimeContext.participantIdentity
              ? runtimeContext.participantIdentity.label
              : runtimeContext.adminIdentity
                ? runtimeContext.adminIdentity.label
                : (runtimeContext.adminName || this.getDefaultAdminName()),
            channelName: gatewaySettings.channelName,
            chaincodeName
          };
        } finally {
          gateway.disconnect();
        }
      };

      try {
        return await executeEvaluate(context);
      } catch (error) {
        if (
          String(context.forceDiscoveryDisabled || 'false') === 'true' ||
          !this.isRecoverableDiscoveryError(error)
        ) {
          throw error;
        }

        return executeEvaluate({
          ...context,
          forceDiscoveryDisabled: true
        });
      }
    }

    await this.initializeConnection(context);

    return {
      success: true,
      txId: null,
      functionName,
      args,
      payload: null,
      signer: context.participantIdentity
        ? context.participantIdentity.label
        : context.adminIdentity
          ? context.adminIdentity.label
          : (context.adminName || this.getDefaultAdminName()),
      channelName: gatewaySettings?.channelName || null,
      chaincodeName: gatewaySettings?.chaincodeName || null
    };
  }

  static async activateParticipant({ participant, adminIdentity, participantIdentity }) {
    const supportedCurrencies = Array.isArray(participant.supported_currencies)
      ? participant.supported_currencies.join(',')
      : (participant.supported_currencies || '');
    const joinedDate = participant.joined_date || new Date().toISOString();

    return this.submitTransaction(
      'ActivateParticipant',
      [
        participant.bank_id,
        participant.bank_display_name,
        participant.bic_swift_code,
        participant.country_code,
        participant.msp_id,
        supportedCurrencies,
        participant.settlement_model || '',
        participant.public_key_hash,
        participant.certificate_thumbprint_hash,
        joinedDate
      ],
      { adminIdentity, participantIdentity }
    );
  }

  static async getParticipant(bankId, context = {}) {
    const result = await this.evaluateTransaction('GetParticipant', [bankId], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : null
    };
  }

  static async isParticipantActive(bankId, context = {}) {
    const result = await this.evaluateTransaction('IsParticipantActive', [bankId], context);
    const active = result.payload ? JSON.parse(result.payload) : false;

    return {
      ...result,
      data: {
        bankId,
        active
      }
    };
  }

  static async requireActiveParticipant(bankId, context = {}) {
    return this.submitTransaction('RequireActiveParticipant', [bankId], context);
  }

  static async getParticipantByMSP(mspId, context = {}) {
    const result = await this.evaluateTransaction('GetParticipantByMSP', [mspId], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : null
    };
  }

  static async getAllParticipants(context = {}) {
    const result = await this.evaluateTransaction('GetAllParticipants', [], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : []
    };
  }

  static async getWallet(bankId, context = {}) {
    const result = await this.evaluateTransaction('GetWallet', [bankId], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : null
    };
  }

  static async createMintRequest({ bankId, currency, amount, reason }, context = {}) {
    const result = await this.submitTransaction(
      'CreateMintRequest',
      [bankId, currency, amount, reason || ''],
      context
    );

    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : null
    };
  }

  static async getOwnMintRequests(bankId, context = {}) {
    const result = await this.evaluateTransaction('GetOwnMintRequests', [bankId], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : []
    };
  }

  static async getOwnMintRequestById(bankId, requestId, context = {}) {
    const result = await this.evaluateTransaction('GetOwnMintRequestById', [bankId, requestId], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : null
    };
  }

  static async getAllMintRequests(context = {}) {
    const result = await this.evaluateTransaction('GetAllMintRequests', [], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : []
    };
  }

  static async getPendingMintRequests(context = {}) {
    const result = await this.evaluateTransaction('GetPendingMintRequests', [], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : []
    };
  }

  static async approveMintRequest(requestId, context = {}) {
    const result = await this.submitTransaction('ApproveMintRequest', [requestId], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : null
    };
  }

  static async rejectMintRequest(requestId, rejectionReason, context = {}) {
    const result = await this.submitTransaction('RejectMintRequest', [requestId, rejectionReason || ''], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : null
    };
  }

  static async getApprovedMintHistory(context = {}) {
    const result = await this.evaluateTransaction('GetApprovedMintHistory', [], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : []
    };
  }

  static async getMintRequestById(requestId, context = {}) {
    const result = await this.evaluateTransaction('GetMintRequestById', [requestId], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : null
    };
  }

  static async createSettlementRequest({ fromBank, toBank, currency, amount, reference, purpose }, context = {}) {
    const result = await this.submitTransaction(
      'CreateSettlementRequest',
      [fromBank, toBank, currency, amount, reference || '', purpose || ''],
      context
    );
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : null
    };
  }

  static async validateSettlement({ fromBank, toBank, currency, amount }, context = {}) {
    const result = await this.evaluateTransaction(
      'ValidateSettlement',
      [fromBank, toBank, currency, amount],
      context
    );
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : false
    };
  }

  static async hasSufficientBalance({ bankId, currency, amount }, context = {}) {
    const result = await this.evaluateTransaction(
      'HasSufficientBalance',
      [bankId, currency, amount],
      context
    );
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : false
    };
  }

  static async checkDuplicateSettlement({ fromBank, toBank, currency, amount, reference }, context = {}) {
    const result = await this.evaluateTransaction(
      'CheckDuplicateSettlement',
      [fromBank, toBank, currency, amount, reference || ''],
      context
    );
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : false
    };
  }

  static async approveSettlement(settlementId, context = {}) {
    const result = await this.submitTransaction('ApproveSettlement', [settlementId], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : null
    };
  }

  static async rejectSettlement(settlementId, rejectionReason, context = {}) {
    const result = await this.submitTransaction('RejectSettlement', [settlementId, rejectionReason || ''], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : null
    };
  }

  static async executeSettlement(settlementId, context = {}) {
    const result = await this.submitTransaction('ExecuteSettlement', [settlementId], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : null
    };
  }

  static async getSettlementById(settlementId, context = {}) {
    const result = await this.evaluateTransaction('GetSettlementById', [settlementId], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : null
    };
  }

  static async getSettlementStatus(settlementId, context = {}) {
    const result = await this.evaluateTransaction('GetSettlementStatus', [settlementId], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : null
    };
  }

  static async getOwnSettlementHistory(bankId, context = {}) {
    const result = await this.evaluateTransaction('GetOwnSettlementHistory', [bankId], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : []
    };
  }

  static async getAllSettlements(context = {}) {
    const result = await this.evaluateTransaction('GetAllSettlements', [], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : []
    };
  }

  static async investigateSettlement(settlementId, context = {}) {
    const result = await this.evaluateTransaction('InvestigateSettlement', [settlementId], context);
    return {
      ...result,
      data: result.payload ? JSON.parse(result.payload) : null
    };
  }

  static async suspendParticipant(bankId, context = {}) {
    return this.submitTransaction('SuspendParticipant', [bankId, context.reason || ''], context);
  }

  static async revokeParticipant(bankId, context = {}) {
    return this.submitTransaction('RevokeParticipant', [bankId, context.reason || ''], context);
  }

  static async reactivateParticipant(bankId, context = {}) {
    return this.submitTransaction('ReactivateParticipant', [bankId, context.reason || ''], context);
  }
}

module.exports = BlockchainService;
