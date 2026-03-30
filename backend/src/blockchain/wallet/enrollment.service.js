const FabricCaEnrollmentService = require('./fabric-ca-enrollment.service');

class EnrollmentService {
  static async ensureParticipantIdentity(payload) {
    return FabricCaEnrollmentService.ensureParticipantIdentity(payload);
  }
}

module.exports = EnrollmentService;
