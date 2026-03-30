# BetweenNetwork Frontend

Placeholder for frontend application.

## Purpose

This folder will contain the frontend application for the BetweenNetwork Bank Onboarding System.

## Recommended Architecture

### Option 1: React + TypeScript
- Modern, component-based UI
- Extensive ecosystem for state management (Redux, Zustand)
- Strong TypeScript support
- Great developer experience

### Option 2: Vue 3
- Progressive framework
- Smaller bundle size
- Excellent documentation
- Good for rapid development

### Option 3: Next.js
- Full-stack framework built on React
- Server-side rendering capabilities
- Built-in API route support
- Great for SEO

## Features to Implement

### User-Facing
- [ ] Bank application form (create, edit, submit)
- [ ] Application status tracking
- [ ] Document upload interface
- [ ] Contact information management
- [ ] Real-time status updates via WebSocket

### Admin Dashboard
- [ ] Applications review list with filters
- [ ] Participant management interface
- [ ] Approval/Rejection workflows
- [ ] Suspension/Revocation controls
- [ ] Audit logs viewer
- [ ] Analytics and reporting

### Common Components
- [ ] Authentication/Login
- [ ] Navigation menu
- [ ] Error/Success notifications
- [ ] Loading states
- [ ] Forms with validation
- [ ] Data tables with pagination

## API Integration

The frontend will communicate with the backend via HTTP and WebSocket:

```javascript
// API Base URL (from environment)
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000'

// Example: Create Bank Application
const createApplication = async (data) => {
  const response = await fetch(`${API_BASE}/banks/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return response.json()
}

// Example: Admin Approve (with API key)
const approveApplication = async (id, data, adminKey) => {
  const response = await fetch(`${API_BASE}/banks/applications/${id}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-api-key': adminKey
    },
    body: JSON.stringify(data)
  })
  return response.json()
}
```

## Development Setup (Template)

```bash
# Create React app
npx create-react-app frontend
cd frontend

# Install dependencies
npm install axios react-router-dom zustand

# Start development server
npm start
```

## Environment Variables

```env
REACT_APP_API_URL=http://localhost:3000
REACT_APP_ADMIN_MODE=false
REACT_APP_ENABLE_WEBSOCKET=true
```

## Admin Mode

The frontend should detect admin access via:
1. Query parameter: `?admin=true`
2. Admin API key in localStorage
3. User role from backend

Depending on admin status, show/hide sensitive admin panels.

## Web Sockets (Optional Enhancement)

For real-time updates, implement WebSocket connection:

```javascript
const socket = io('http://localhost:3000')

// Subscribe to application updates
socket.on('application:updated', (data) => {
  // Update UI with new status
})

// Subscribe to participant status changes
socket.on('participant:status-changed', (data) => {
  // Update UI
})
```

## State Management (Zustand Example)

```javascript
import create from 'zustand'

const useApplicationStore = create((set) => ({
  applications: [],
  loading: false,
  
  fetchApplications: async () => {
    set({ loading: true })
    const data = await fetch('/banks/applications').then(r => r.json())
    set({ applications: data.data, loading: false })
  },
  
  createApplication: async (appData) => {
    const data = await fetch('/banks/applications', {
      method: 'POST',
      body: JSON.stringify(appData)
    }).then(r => r.json())
    set((state) => ({
      applications: [...state.applications, data.data]
    }))
  }
}))
```

## Testing

```bash
# Unit tests
npm test

# E2E tests (Cypress or Playwright)
npm run test:e2e

# Build for production
npm run build
```

## Deployment

The frontend should be built and served:
- **Development:** `npm start` (Hot reload via React DevServer)
- **Production:** `npm run build` + deploy `build/` folder to static hosting (S3, Vercel, etc.)

## CORS Configuration

Ensure backend `.env` includes:
```env
CORS_ORIGINS=http://localhost:3000,https://app.betweennetwork.com
```

Or configure in Express:
```javascript
const cors = require('cors')
app.use(cors({
  origin: process.env.CORS_ORIGINS.split(','),
  credentials: true
}))
```

---

Next Steps: Initialize the frontend framework and begin implementing the user interface!
