# Tunneling Service Implementation Plan for GitHub Copilot Agent

## Project Overview
Create a monetized tunneling service similar to localtunnel/ngrok with Stripe subscription integration, MongoDB database, and seamless Git Contextor integration. The service will later expand to offer hosted Qdrant collections.

## Architecture Overview

```
[Client] -> [Nginx Proxy Manager] -> [Tunneling Service] -> [Target Local Service]
                                          |
                                    [MongoDB] + [Stripe]
```

## Core Components to Implement

### 1. Main Tunneling Service (`tunnel-service/`)

#### 1.1 Project Structure
```
tunnel-service/
├── package.json
├── src/
│   ├── index.js                 # Main entry point
│   ├── config/
│   │   ├── database.js          # MongoDB connection
│   │   ├── stripe.js            # Stripe configuration
│   │   └── nginx.js             # Nginx API integration
│   ├── models/
│   │   ├── User.js              # User schema
│   │   ├── Subscription.js      # Subscription schema
│   │   ├── Tunnel.js            # Active tunnel schema
│   │   └── Usage.js             # Usage tracking schema
│   ├── routes/
│   │   ├── auth.js              # Authentication routes
│   │   ├── tunnels.js           # Tunnel management
│   │   ├── subscriptions.js     # Stripe integration
│   │   └── admin.js             # Admin interface API
│   ├── services/
│   │   ├── TunnelManager.js     # Core tunneling logic
│   │   ├── NginxManager.js      # Nginx Proxy Manager API
│   │   ├── StripeService.js     # Stripe operations
│   │   └── UsageTracker.js      # Usage monitoring
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication
│   │   ├── subscription.js      # Subscription validation
│   │   └── rateLimit.js         # Rate limiting
│   └── utils/
│       ├── subdomain.js         # Subdomain generation
│       ├── proxy.js             # HTTP proxy utilities
│       └── validation.js        # Input validation
├── admin-ui/                    # Admin interface (React/Vue)
└── docker-compose.yml           # Development setup
```

#### 1.2 Core Dependencies
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.2",
    "http-proxy-middleware": "^2.0.6",
    "mongoose": "^7.5.0",
    "stripe": "^13.0.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "helmet": "^7.0.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^6.9.0",
    "dotenv": "^16.3.1",
    "axios": "^1.5.0",
    "uuid": "^9.0.0",
    "ws": "^8.13.0"
  }
}
```

### 2. Database Schema Design

#### 2.1 User Model
```javascript
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  apiKey: { type: String, required: true, unique: true },
  stripeCustomerId: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  plan: { type: String, enum: ['free', 'basic', 'pro', 'enterprise'], default: 'free' },
  usage: {
    tunnelsUsed: { type: Number, default: 0 },
    dataTransferred: { type: Number, default: 0 },
    resetDate: { type: Date, default: Date.now }
  },
  gitContextorIntegration: {
    enabled: { type: Boolean, default: false },
    qdrantCollections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'QdrantCollection' }]
  },
  createdAt: { type: Date, default: Date.now }
});
```

#### 2.2 Tunnel Model
```javascript
const TunnelSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subdomain: { type: String, required: true, unique: true },
  localPort: { type: Number, required: true },
  targetHost: { type: String, default: 'localhost' },
  isActive: { type: Boolean, default: true },
  protocol: { type: String, enum: ['http', 'https'], default: 'https' },
  customDomain: { type: String, default: null },
  connectionId: { type: String, required: true },
  metadata: {
    userAgent: String,
    clientIp: String,
    gitContextorShare: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
});
```

#### 2.3 Subscription Model
```javascript
const SubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  stripeSubscriptionId: { type: String, required: true },
  status: { type: String, required: true },
  plan: { type: String, required: true },
  limits: {
    maxTunnels: { type: Number, required: true },
    maxDataTransfer: { type: Number, required: true }, // in GB
    maxQdrantCollections: { type: Number, default: 0 }
  },
  currentPeriodStart: { type: Date, required: true },
  currentPeriodEnd: { type: Date, required: true }
});
```

### 3. Core Service Implementation

#### 3.1 TunnelManager Service
```javascript
class TunnelManager {
  async createTunnel(userId, localPort, options = {}) {
    // 1. Validate user subscription and limits
    // 2. Generate unique subdomain
    // 3. Create Nginx proxy configuration
    // 4. Establish WebSocket connection for tunnel
    // 5. Store tunnel in database
    // 6. Return tunnel details
  }

  async destroyTunnel(tunnelId, userId) {
    // 1. Validate ownership
    // 2. Remove Nginx configuration
    // 3. Close WebSocket connections
    // 4. Update database
  }

  async handleConnection(socket, authToken) {
    // WebSocket connection handler for tunnel data
  }
}
```

#### 3.2 NginxManager Service
```javascript
class NginxManager {
  constructor(nginxApiUrl, apiKey) {
    this.apiUrl = nginxApiUrl;
    this.apiKey = apiKey;
  }

  async createProxyHost(subdomain, targetPort) {
    // Create proxy host in Nginx Proxy Manager
    // Configure SSL certificate (Let's Encrypt)
    // Return proxy host configuration
  }

  async deleteProxyHost(proxyHostId) {
    // Remove proxy host from Nginx Proxy Manager
  }

  async updateProxyHost(proxyHostId, config) {
    // Update existing proxy host configuration
  }
}
```

#### 3.3 StripeService
```javascript
class StripeService {
  async createCustomer(email, metadata = {}) {
    // Create Stripe customer
  }

  async createSubscription(customerId, priceId) {
    // Create subscription with plan limits
  }

  async handleWebhook(event) {
    // Handle subscription updates, cancellations, etc.
  }

  async getUsage(customerId, period) {
    // Get usage statistics for billing
  }
}
```

### 4. API Routes Implementation

#### 4.1 Tunnel Management Routes (`/api/tunnels`)
```javascript
// POST /api/tunnels - Create new tunnel
// GET /api/tunnels - List user's tunnels
// DELETE /api/tunnels/:id - Destroy tunnel
// GET /api/tunnels/:id/stats - Get tunnel statistics
```

#### 4.2 Subscription Routes (`/api/subscriptions`)
```javascript
// GET /api/subscriptions/plans - List available plans
// POST /api/subscriptions/create - Create new subscription
// GET /api/subscriptions/current - Get current subscription
// POST /api/subscriptions/cancel - Cancel subscription
// POST /api/webhooks/stripe - Stripe webhook handler
```

#### 4.3 Admin Routes (`/api/admin`)
```javascript
// GET /api/admin/users - List all users
// GET /api/admin/users/:id - Get user details
// PUT /api/admin/users/:id - Update user
// GET /api/admin/tunnels - List all tunnels
// GET /api/admin/analytics - Get platform analytics
```

### 5. Git Contextor Integration

#### 5.1 Update Git Contextor Sharing Service
```javascript
// In git-contextor/src/core/SharingService.js
class SharingService {
  async startTunnel(service) {
    if (service === 'managed') {
      return this.startManagedTunnel();
    }
    // existing logic for localtunnel, ngrok
  }

  async startManagedTunnel() {
    const config = this.getManagedTunnelConfig();
    const response = await axios.post(`${config.apiUrl}/api/tunnels`, {
      localPort: this.config.services.port,
      gitContextorShare: true
    }, {
      headers: { 'Authorization': `Bearer ${config.apiKey}` }
    });
    
    this.tunnelUrl = response.data.url;
    this.tunnelStatus = 'running';
    return response.data;
  }
}
```

#### 5.2 Configuration Updates
```javascript
// Add to git-contextor config schema
{
  "tunneling": {
    "provider": "managed", // managed, localtunnel, ngrok
    "managed": {
      "apiUrl": "https://tunnels.yourservice.com",
      "apiKey": "user-api-key"
    }
  }
}
```

### 6. Admin Interface Implementation

#### 6.1 Admin Dashboard Features
- User management (view, edit, suspend users)
- Subscription analytics (revenue, churn, plan distribution)
- Tunnel monitoring (active tunnels, usage statistics)
- System health monitoring
- Usage analytics and billing reports

#### 6.2 Tech Stack for Admin UI
- Frontend: React with Tailwind CSS
- Charts: Chart.js or Recharts
- State Management: Context API or Redux Toolkit
- API Client: Axios with React Query

### 7. Security Implementation

#### 7.1 Authentication & Authorization
```javascript
// JWT-based authentication
// Rate limiting per user/plan
// API key management
// Subscription-based access control
```

#### 7.2 Tunnel Security
```javascript
// SSL termination at Nginx
// WebSocket authentication
// Traffic encryption
// DDoS protection
```

### 8. Deployment & Infrastructure

#### 8.1 Docker Configuration
```dockerfile
# Dockerfile for tunneling service
# docker-compose.yml with MongoDB, Redis
# Nginx configuration templates
```

#### 8.2 Environment Configuration
```bash
# Required environment variables
MONGODB_URI=mongodb://localhost:27017/tunnel-service
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NGINX_PROXY_MANAGER_API_URL=http://nginx-proxy-manager:81/api
NGINX_PROXY_MANAGER_API_KEY=...
JWT_SECRET=...
```

### 9. Future Qdrant Integration Planning

#### 9.1 Qdrant Collection Service
```javascript
class QdrantCollectionService {
  async createCollection(userId, name, config) {
    // Create hosted Qdrant collection
    // Configure access credentials
    // Update user's Git Contextor config
  }

  async getCollectionCredentials(userId, collectionId) {
    // Return connection details for Git Contextor
  }
}
```

#### 9.2 Database Schema for Qdrant Collections
```javascript
const QdrantCollectionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  qdrantInstanceId: { type: String, required: true },
  collectionName: { type: String, required: true },
  credentials: {
    host: String,
    port: Number,
    apiKey: String
  },
  usage: {
    vectorCount: { type: Number, default: 0 },
    storageUsed: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
```

## Implementation Priority

### Phase 1: Core Infrastructure
1. Setup MongoDB schemas and connections
2. Implement basic user management and authentication
3. Create Stripe integration for subscriptions
4. Build basic tunnel creation/destruction

### Phase 2: Tunneling Service
1. Implement WebSocket tunnel connections
2. Integrate with Nginx Proxy Manager
3. Add usage tracking and rate limiting
4. Build admin interface

### Phase 3: Git Contextor Integration
1. Update Git Contextor sharing service
2. Add configuration options for managed tunneling
3. Test integration and user flows

### Phase 4: Qdrant Collections
1. Design Qdrant hosting infrastructure
2. Implement collection management
3. Integrate with Git Contextor configuration
4. Add billing for Qdrant usage

## Testing Strategy
- Unit tests for all service classes
- Integration tests for Stripe webhooks
- End-to-end tests for tunnel creation/destruction
- Load testing for concurrent tunnel handling
- Security testing for authentication and authorization

This implementation plan provides a comprehensive roadmap for building a monetized tunneling service with seamless Git Contextor integration and future Qdrant hosting capabilities.