# Git Contextor Host - Deployment Guide

## Quick Start

### 1. Server Prerequisites
First, run the server setup script on your production server:

```bash
# On the production server (10.0.0.14)
wget https://raw.githubusercontent.com/your-repo/git-contextor-host/main/server-setup.sh
chmod +x server-setup.sh
sudo ./server-setup.sh
```

### 2. Clone Repository
```bash
# On the production server
cd /opt
git clone https://github.com/your-repo/git-contextor-host.git
```

### 3. Deploy from Local Machine
```bash
# From your local development machine
./deploy.sh
```

## Deployment Commands

### Basic Operations
```bash
# Full deployment with frontend build
./deploy.sh

# Build frontend only (local)
./deploy.sh build

# Upload built frontend to server
./deploy.sh upload

# Check service status
./deploy.sh status

# View logs
./deploy.sh logs

# Restart service
./deploy.sh restart

# Health check
./deploy.sh health

# Rollback to previous version
./deploy.sh rollback
```

## Configuration

### Environment Variables
Update `/opt/git-contextor-host/tunnel-service/.env` with your production values:

```bash
# Essential configurations
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://localhost:27017/tunnel-service-prod
STRIPE_SECRET_KEY=sk_live_your_key_here
JWT_SECRET=your_secure_jwt_secret
TUNNEL_DOMAIN=tunnels.yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
```

### Domain Configuration
Update Nginx configuration:
```bash
# Edit domain names
sudo nano /etc/nginx/sites-available/git-contextor-host

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### SSL Certificates
```bash
# Install SSL certificates
sudo certbot --nginx -d yourdomain.com -d *.tunnels.yourdomain.com
```

## Monitoring

### Service Health
```bash
# Check PM2 status
pm2 list

# Monitor in real-time
pm2 monit

# View logs
pm2 logs git-contextor-host
```

### System Health
```bash
# Check system resources
htop

# Check disk usage
df -h

# Check service status
systemctl status mongod
systemctl status nginx
```

## Troubleshooting

### Common Issues

1. **Service won't start**
   ```bash
   # Check logs
   ./deploy.sh logs
   
   # Check environment
   cat /opt/git-contextor-host/tunnel-service/.env
   
   # Restart service
   ./deploy.sh restart
   ```

2. **Database connection errors**
   ```bash
   # Check MongoDB
   sudo systemctl status mongod
   sudo systemctl restart mongod
   
   # Check connection string
   mongo --eval "db.runCommand('ping')"
   ```

3. **Permission issues**
   ```bash
   # Fix permissions
   sudo chown -R root:root /opt/git-contextor-host
   sudo chmod -R 755 /opt/git-contextor-host
   ```

### Emergency Procedures

1. **Quick rollback**
   ```bash
   ./deploy.sh rollback
   ```

2. **Manual service restart**
   ```bash
   ssh root@10.0.0.14 "pm2 restart git-contextor-host"
   ```

3. **Service logs**
   ```bash
   ssh root@10.0.0.14 "pm2 logs git-contextor-host --lines 100"
   ```

## File Structure

```
/opt/git-contextor-host/
├── deploy.sh                 # Main deployment script
├── server-setup.sh           # Server prerequisites setup
├── DEPLOYMENT_CHECKLIST.md   # Pre-deployment checklist
├── tunnel-service/
│   ├── .env                  # Production environment
│   ├── .env.production       # Environment template
│   ├── ecosystem.config.js   # PM2 configuration
│   ├── package.json
│   ├── src/
│   └── logs/
└── /opt/backups/git-contextor-host/  # Automatic backups
```

## Security Considerations

1. **Firewall**: Only ports 22, 80, 443, 5000 are open
2. **SSL**: HTTPS enforced with Let's Encrypt certificates
3. **Secrets**: Environment variables are protected
4. **Access**: SSH key-based authentication recommended
5. **Updates**: Regular security updates via deployment script

## Performance Optimization

1. **PM2 Clustering**: Automatic load balancing across CPU cores
2. **Memory Management**: Automatic restart on memory limits
3. **Log Rotation**: Automatic log cleanup
4. **Health Monitoring**: Automatic service recovery

## Backup Strategy

1. **Automatic Backups**: Created before each deployment
2. **Database Backups**: Configure MongoDB backups separately
3. **Configuration Backups**: Environment and config files included
4. **Retention**: Backups stored in `/opt/backups/git-contextor-host/`

## Support

For issues or questions:
1. Check the deployment logs: `./deploy.sh logs`
2. Review the health check: `./deploy.sh health`
3. Consult the troubleshooting guide above
4. Check the service status: `./deploy.sh status`
