const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes');
const { 
  errorHandler, 
  requestLoggerMiddleware 
} = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const API_ROUTES = {
  public: [
    'GET /',
    'GET /health',
    'GET /routes',
    'POST /banks/auth/signup',
    'POST /banks/auth/login',
    'GET /banks/me',
    'POST /banks/signup',
    'POST /banks/login',
    'POST /banks/applications',
    'GET /banks/applications',
    'GET /banks/applications/:id',
    'PATCH /banks/applications/:id',
    'POST /banks/applications/:id/submit',
    'GET /participants',
    'GET /participants/msp/:mspId',
    'GET /participants/:bankId',
    'GET /participants/:bankId/wallet-eligibility',
    'GET /participants/:bankId/active',
    'POST /participants/:bankId/require-active',
    'POST /mint-requests',
    'GET /banks/:bankId/mint-requests',
    'GET /banks/:bankId/mint-requests/:requestId',
    'GET /wallets/:bankId',
    'POST /wallets/:bankId/check-balance',
    'POST /settlements/validate',
    'POST /settlements/check-duplicate',
    'POST /settlements',
    'GET /banks/:bankId/settlements',
    'GET /banks/:bankId/settlements/:settlementId',
    'GET /banks/:bankId/settlements/:settlementId/status',
    'GET /banks/:bankId/settlements/:settlementId/investigation'
  ],
  admin: [
    'POST /admin/signup',
    'POST /admin/login',
    'POST /admin/chaincode/participants/activate',
    'POST /admin/applications/:id/review',
    'POST /admin/applications/:id/approve',
    'POST /admin/applications/:id/onboard-blockchain-org',
    'POST /admin/applications/:id/reject',
    'POST /admin/participants/:bankId/suspend',
    'POST /admin/participants/:bankId/revoke',
    'POST /admin/participants/:bankId/reactivate',
    'GET /admin/chaincode/participants',
    'GET /admin/chaincode/participants/bank/:bankId',
    'GET /admin/chaincode/participants/msp/:mspId',
    'GET /admin/mint-requests',
    'GET /admin/mint-requests/pending',
    'GET /admin/mint-requests/approved',
    'GET /admin/mint-requests/:requestId',
    'POST /admin/mint-requests/:requestId/approve',
    'POST /admin/mint-requests/:requestId/reject',
    'GET /admin/settlements',
    'GET /admin/settlements/:settlementId',
    'GET /admin/settlements/:settlementId/status',
    'POST /admin/settlements/:settlementId/approve',
    'POST /admin/settlements/:settlementId/reject',
    'POST /admin/settlements/:settlementId/execute',
    'GET /admin/audit-logs'
  ]
};

// ==================== Middleware ====================

app.use((req, res, next) => {
  const origin = process.env.CORS_ORIGIN || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-api-key, x-betweennetwork-admin-key, x-admin-id, x-betweennetwork-admin-id, x-bank-id');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// Body parser
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Request logging
app.use(requestLoggerMiddleware);

// ==================== Routes ====================

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'BetweenNetwork Backend is running',
    health: '/health',
    routes: '/routes',
    timestamp: new Date().toISOString()
  });
});

app.get('/routes', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'BetweenNetwork API routes',
    data: API_ROUTES,
    timestamp: new Date().toISOString()
  });
});

app.use('/', routes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'BetweenNetwork Backend is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found: ' + req.path
  });
});

// Error handling middleware
app.use(errorHandler);

// ==================== Server Startup ====================

app.listen(PORT, () => {
  console.log(`BetweenNetwork Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.DB_NAME} on ${process.env.DB_HOST}:${process.env.DB_PORT}`);
});

module.exports = app;
