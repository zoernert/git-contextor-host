# Tunneling Service

A comprehensive, monetized tunneling service with Stripe integration, MongoDB database, and seamless Git Contextor integration. Similar to localtunnel/ngrok but with built-in subscription management and usage tracking.

## Features

- 🚀 **HTTP/HTTPS Tunneling**: Secure tunneling with automatic SSL certificates
- 💳 **Stripe Integration**: Subscription-based billing with multiple plans
- 📊 **Usage Tracking**: Real-time monitoring of data transfer and usage
- 🔐 **Authentication**: JWT-based authentication with API key support
- 👥 **Admin Interface**: Complete admin dashboard for user and tunnel management
- 🎯 **Git Contextor Integration**: Native support for Git Contextor sharing
- 📈 **Analytics**: Comprehensive analytics and reporting
- 🔄 **Qdrant Collections**: Future support for hosted Qdrant collections
- 🛡️ **Security**: Rate limiting, input validation, and security headers
- 📱 **WebSocket Support**: Real-time tunnel connections
- 🐳 **Docker Support**: Container-ready with Docker Compose

## Architecture

```
[Client] -> [Nginx Proxy Manager] -> [Tunneling Service] -> [Local Service]
                                          |
                                    [MongoDB + Stripe]
```

## Quick Start

### Prerequisites

- Node.js 16+ 
- MongoDB 4.4+
- Stripe account
- Nginx Proxy Manager (optional, can run in mock mode)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tunnel-service
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the services**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   
   # With Docker
   docker-compose up -d
   ```

### Environment Variables

```bash
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/tunnel-service

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BASIC_PLAN_PRICE_ID=price_...
STRIPE_PRO_PLAN_PRICE_ID=price_...

# Nginx Proxy Manager
NGINX_PROXY_MANAGER_API_URL=http://localhost:81/api
NGINX_PROXY_MANAGER_API_KEY=your-api-key

# Security
JWT_SECRET=your-jwt-secret

# Admin Configuration
ADMIN_EMAIL=admin@example.com

# Tunneling
TUNNEL_DOMAIN=tunnels.yourservice.com
FRONTEND_URL=http://localhost:5173

# Qdrant (Optional)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-qdrant-api-key
```

## API Documentation

### Authentication

All API endpoints require authentication via JWT token in the `x-auth-token` header.

```bash
# Register
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

# Login
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com", 
  "password": "password123"
}
```

### Tunnels

```bash
# Create tunnel
POST /api/tunnels
x-auth-token: your-jwt-token
Content-Type: application/json

{
  "localPort": 3000,
  "subdomain": "my-app",
  "gitContextorShare": true
}

# List tunnels
GET /api/tunnels
x-auth-token: your-jwt-token

# Delete tunnel
DELETE /api/tunnels/:id
x-auth-token: your-jwt-token

# Get tunnel statistics
GET /api/tunnels/:id/stats
x-auth-token: your-jwt-token
```

### Subscriptions

```bash
# Get available plans
GET /api/subscriptions/plans

# Create subscription
POST /api/subscriptions/create
x-auth-token: your-jwt-token
Content-Type: application/json

{
  "priceId": "price_1234567890"
}

# Get current subscription
GET /api/subscriptions/current
x-auth-token: your-jwt-token

# Cancel subscription
POST /api/subscriptions/cancel
x-auth-token: your-jwt-token
```

### Admin APIs

```bash
# Get all users (admin only)
GET /api/admin/users
x-auth-token: admin-jwt-token

# Get user details (admin only)
GET /api/admin/users/:id
x-auth-token: admin-jwt-token

# Update user (admin only)
PUT /api/admin/users/:id
x-auth-token: admin-jwt-token
Content-Type: application/json

{
  "plan": "pro",
  "isActive": true
}

# Get platform analytics (admin only)
GET /api/admin/analytics
x-auth-token: admin-jwt-token
```

## Subscription Plans

| Plan | Price | Tunnels | Bandwidth | Qdrant Collections |
|------|-------|---------|-----------|-------------------|
| Free | $0/mo | 1 | 1 GB | 0 |
| Basic | $5/mo | 5 | 10 GB | 1 |
| Pro | $15/mo | 50 | 50 GB | 5 |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited |

## Git Contextor Integration

The tunneling service provides native support for Git Contextor sharing:

```javascript
// Git Contextor configuration
{
  "tunneling": {
    "provider": "managed",
    "managed": {
      "apiUrl": "https://your-tunnel-service.com",
      "apiKey": "your-api-key",
      "subdomain": "my-project"
    }
  }
}
```

See [Git Contextor Integration Guide](./docs/git-contextor-integration.md) for detailed setup instructions.

## Admin Interface

The admin interface provides:

- **User Management**: View, edit, and manage user accounts
- **Tunnel Monitoring**: Real-time tunnel status and statistics
- **Analytics Dashboard**: Revenue, usage, and performance metrics
- **Subscription Management**: Plan upgrades and billing oversight
- **System Health**: Service monitoring and health checks

Access the admin interface at `http://localhost:5173/admin`

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tunnels.test.js
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Database Migrations

```bash
# Create admin user
node scripts/create-admin.js

# Reset database
node scripts/reset-database.js

# Seed test data
node scripts/seed-data.js
```

## Production Deployment

### Docker Deployment

```bash
# Build image
docker build -t tunnel-service .

# Run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment

```bash
# Apply configurations
kubectl apply -f k8s/

# Check deployment
kubectl get pods
kubectl logs -f deployment/tunnel-service
```

### Health Checks

The service provides health check endpoints:

```bash
# Basic health check
GET /api/health

# Detailed health check
GET /api/health/detailed
```

## Monitoring and Logging

### Logging

Logs are written to:
- Console (development)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)
- `logs/access.log` (HTTP requests)

### Metrics

Key metrics tracked:
- Active tunnels
- Data transfer rates
- API response times
- Error rates
- User activity

### Alerting

Configure alerts for:
- High error rates
- Service downtime
- Resource usage
- Payment failures

## Security

### Best Practices

- JWT tokens with expiration
- Rate limiting per user/IP
- Input validation and sanitization
- HTTPS enforcement
- Security headers (Helmet.js)
- API key authentication
- Database connection security

### Vulnerability Scanning

```bash
# Run security audit
npm audit

# Fix vulnerabilities
npm audit fix

# Check for outdated packages
npm outdated
```

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Check MongoDB is running
   - Verify connection string
   - Check firewall settings

2. **Stripe Webhooks Not Working**
   - Verify webhook secret
   - Check endpoint URL
   - Review webhook logs in Stripe dashboard

3. **Tunnel Connection Timeouts**
   - Check WebSocket support
   - Verify proxy configuration
   - Test with different ports

4. **High Memory Usage**
   - Monitor active connections
   - Check for memory leaks
   - Scale horizontally if needed

### Debug Mode

Enable debug logging:

```bash
DEBUG=tunnel-service:* npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit a pull request

### Code Style

- Use ESLint and Prettier
- Follow conventional commits
- Write comprehensive tests
- Document new features

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Support

- 📧 Email: support@yourservice.com
- 📖 Documentation: [docs/](./docs/)
- 🐛 Bug Reports: [GitHub Issues](https://github.com/your-org/tunnel-service/issues)
- 💬 Community: [Discord](https://discord.gg/your-server)

## Roadmap

- [ ] WebSocket tunneling support
- [ ] Custom domain support
- [ ] Advanced analytics
- [ ] Mobile app
- [ ] API rate limiting per plan
- [ ] Geographic load balancing
- [ ] Terraform infrastructure
- [ ] Grafana dashboards
