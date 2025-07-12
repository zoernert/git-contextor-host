# Production Deployment Checklist

## Pre-Deployment Requirements

### Server Setup
- [ ] SSH access to `root@10.0.0.14` is configured
- [ ] Node.js 18+ is installed on the server
- [ ] PM2 is installed globally (`npm install -g pm2`)
- [ ] MongoDB is installed and running
- [ ] Git repository is cloned to `/opt/git-contextor-host`

### Environment Configuration
- [ ] Copy `.env.production` to `.env` in the tunnel-service directory
- [ ] Update MongoDB connection string in `.env`
- [ ] Configure Stripe live API keys
- [ ] Set up domain name and SSL certificates
- [ ] Configure JWT secret (minimum 32 characters)
- [ ] Set admin email address

### Infrastructure
- [ ] Domain name is configured with DNS records
- [ ] SSL certificates are obtained (Let's Encrypt recommended)
- [ ] Firewall rules allow traffic on ports 80, 443, and 5000
- [ ] Nginx or reverse proxy is configured
- [ ] MongoDB backup strategy is in place

### Stripe Configuration
- [ ] Stripe account is set up and verified
- [ ] Live API keys are obtained
- [ ] Webhook endpoints are configured
- [ ] Subscription plans are created
- [ ] Test payments are working

## Deployment Commands

### Initial Deployment
```bash
# Deploy the service
./deploy.sh

# Check status
./deploy.sh status

# View logs
./deploy.sh logs
```

### Ongoing Operations
```bash
# Restart service
./deploy.sh restart

# Check health
./deploy.sh health

# Rollback if needed
./deploy.sh rollback
```

## Post-Deployment Verification

### Service Health
- [ ] Service starts without errors
- [ ] Health check endpoint responds (`curl http://localhost:5000/api/health`)
- [ ] PM2 shows service as online
- [ ] Database connections are working
- [ ] Stripe webhook endpoints are receiving events

### API Testing
- [ ] Authentication endpoints work
- [ ] User registration and login work
- [ ] Tunnel creation and management work
- [ ] Subscription management works
- [ ] Admin panel is accessible

### Monitoring
- [ ] PM2 logs are being written
- [ ] Log rotation is configured
- [ ] Service automatically restarts on failure
- [ ] Resource usage is within acceptable limits

## Troubleshooting

### Common Issues
1. **Service won't start**
   - Check `.env` file configuration
   - Verify MongoDB connection
   - Check PM2 logs: `pm2 logs git-contextor-host`

2. **Database connection errors**
   - Verify MongoDB is running
   - Check connection string in `.env`
   - Ensure MongoDB accepts connections

3. **Stripe webhook errors**
   - Verify webhook secret in `.env`
   - Check Stripe dashboard for webhook status
   - Ensure webhook endpoint is accessible

### Log Locations
- PM2 logs: `/opt/git-contextor-host/tunnel-service/logs/`
- MongoDB logs: `/var/log/mongodb/`
- Nginx logs: `/var/log/nginx/`

## Maintenance Tasks

### Regular Tasks
- [ ] Monitor service health
- [ ] Review logs for errors
- [ ] Update dependencies
- [ ] Backup database
- [ ] Monitor disk space

### Weekly Tasks
- [ ] Review performance metrics
- [ ] Update SSL certificates if needed
- [ ] Check for security updates
- [ ] Review user activity

### Monthly Tasks
- [ ] Full system backup
- [ ] Security audit
- [ ] Performance optimization
- [ ] Update documentation

## Emergency Procedures

### Service Down
1. Check PM2 status: `pm2 list`
2. Restart service: `./deploy.sh restart`
3. Check logs: `./deploy.sh logs`
4. If needed, rollback: `./deploy.sh rollback`

### Database Issues
1. Check MongoDB status: `systemctl status mongodb`
2. Restart MongoDB: `systemctl restart mongodb`
3. Check database connectivity from application

### High Load
1. Monitor PM2 cluster: `pm2 monit`
2. Check resource usage: `htop`
3. Scale instances if needed: `pm2 scale git-contextor-host +2`

## Security Considerations

### Production Security
- [ ] Use HTTPS everywhere
- [ ] Keep secrets secure and rotate regularly
- [ ] Monitor for suspicious activity
- [ ] Keep all software updated
- [ ] Use firewall rules to restrict access
- [ ] Regular security audits

### Access Control
- [ ] Limit SSH access
- [ ] Use strong passwords
- [ ] Enable fail2ban
- [ ] Monitor login attempts
- [ ] Regular access reviews
