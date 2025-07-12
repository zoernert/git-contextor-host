#!/bin/bash

# =============================================================================
# Git Contextor Host - Production Server Setup Script
# =============================================================================
# Run this script on the production server to install prerequisites
# Usage: Run as root on the target server (10.0.0.14)
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
    exit 1
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
    fi
}

# Update system packages
update_system() {
    log "Updating system packages..."
    apt-get update -y
    apt-get upgrade -y
    success "System packages updated"
}

# Install Node.js 18
install_nodejs() {
    log "Installing Node.js 18..."
    
    # Check if Node.js is already installed
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log "Node.js is already installed: $NODE_VERSION"
        
        # Check if it's version 18 or higher
        if [[ ${NODE_VERSION:1:2} -ge 18 ]]; then
            success "Node.js version is compatible"
            return
        else
            warning "Node.js version is too old, upgrading..."
        fi
    fi
    
    # Install Node.js 18
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    
    success "Node.js installed: $(node --version)"
}

# Install PM2
install_pm2() {
    log "Installing PM2..."
    
    if command -v pm2 &> /dev/null; then
        success "PM2 is already installed: $(pm2 --version)"
        return
    fi
    
    npm install -g pm2
    
    # Setup PM2 startup script
    pm2 startup systemd -u root --hp /root
    
    success "PM2 installed and configured"
}

# Install MongoDB
install_mongodb() {
    log "Installing MongoDB..."
    
    if command -v mongod &> /dev/null; then
        success "MongoDB is already installed"
        return
    fi
    
    # Import MongoDB public key
    wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
    
    # Create MongoDB repository
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
    
    # Update package list
    apt-get update
    
    # Install MongoDB
    apt-get install -y mongodb-org
    
    # Start and enable MongoDB
    systemctl start mongod
    systemctl enable mongod
    
    success "MongoDB installed and started"
}

# Install essential packages
install_packages() {
    log "Installing essential packages..."
    
    apt-get install -y \
        curl \
        wget \
        git \
        build-essential \
        nginx \
        certbot \
        python3-certbot-nginx \
        htop \
        ufw \
        logrotate \
        fail2ban
    
    success "Essential packages installed"
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."
    
    # Reset UFW to default
    ufw --force reset
    
    # Set default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH
    ufw allow ssh
    
    # Allow HTTP and HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Allow application port
    ufw allow 5000/tcp
    
    # Enable firewall
    ufw --force enable
    
    success "Firewall configured"
}

# Setup application directory
setup_app_directory() {
    log "Setting up application directory..."
    
    # Create application directory
    mkdir -p /opt/git-contextor-host
    
    # Create backup directory
    mkdir -p /opt/backups/git-contextor-host
    
    # Set permissions
    chmod 755 /opt/git-contextor-host
    chmod 755 /opt/backups/git-contextor-host
    
    success "Application directory setup complete"
}

# Clone repository
clone_repository() {
    log "Cloning repository..."
    
    if [ -d "/opt/git-contextor-host/.git" ]; then
        success "Repository already exists"
        return
    fi
    
    # You'll need to replace this with your actual repository URL
    echo "Please clone your repository manually to /opt/git-contextor-host"
    echo "Example: git clone https://github.com/yourusername/git-contextor-host.git /opt/git-contextor-host"
    
    warning "Repository cloning skipped - please clone manually"
}

# Configure Nginx
configure_nginx() {
    log "Configuring Nginx..."
    
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    # Create basic configuration
    cat > /etc/nginx/sites-available/git-contextor-host << 'EOF'
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Wildcard subdomain for tunnels
server {
    listen 80;
    server_name *.tunnels.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/git-contextor-host /etc/nginx/sites-enabled/
    
    # Test configuration
    nginx -t
    
    # Restart Nginx
    systemctl restart nginx
    systemctl enable nginx
    
    success "Nginx configured"
    warning "Please update server_name in /etc/nginx/sites-available/git-contextor-host with your actual domain"
}

# Setup system monitoring
setup_monitoring() {
    log "Setting up system monitoring..."
    
    # Create monitoring script
    cat > /usr/local/bin/system-monitor.sh << 'EOF'
#!/bin/bash
# Simple system monitoring script

LOG_FILE="/var/log/system-monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Check disk usage
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "$DATE - WARNING: Disk usage is ${DISK_USAGE}%" >> $LOG_FILE
fi

# Check memory usage
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.2f", $3*100/$2}')
if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
    echo "$DATE - WARNING: Memory usage is ${MEMORY_USAGE}%" >> $LOG_FILE
fi

# Check if service is running
if ! pm2 list | grep -q "git-contextor-host.*online"; then
    echo "$DATE - ERROR: Git Contextor Host service is not running" >> $LOG_FILE
fi
EOF
    
    chmod +x /usr/local/bin/system-monitor.sh
    
    # Add to crontab
    echo "*/5 * * * * /usr/local/bin/system-monitor.sh" | crontab -
    
    success "System monitoring configured"
}

# Main setup function
main() {
    echo "
    ╔═══════════════════════════════════════════════════════════════╗
    ║           Git Contextor Host - Server Setup                  ║
    ║                  Production Environment                       ║
    ╚═══════════════════════════════════════════════════════════════╝
    "
    
    check_root
    update_system
    install_packages
    install_nodejs
    install_pm2
    install_mongodb
    configure_firewall
    setup_app_directory
    configure_nginx
    setup_monitoring
    clone_repository
    
    success "Server setup completed!"
    
    echo "
    ╔═══════════════════════════════════════════════════════════════╗
    ║                     Setup Complete                            ║
    ╠═══════════════════════════════════════════════════════════════╣
    ║ Node.js: $(node --version)                                  ║
    ║ PM2: Installed and configured                                 ║
    ║ MongoDB: Running                                              ║
    ║ Nginx: Configured                                             ║
    ║ Firewall: Enabled                                             ║
    ║                                                               ║
    ║ Next Steps:                                                   ║
    ║ 1. Clone your repository to /opt/git-contextor-host          ║
    ║ 2. Update Nginx configuration with your domain               ║
    ║ 3. Obtain SSL certificates with certbot                      ║
    ║ 4. Run the deployment script from your local machine         ║
    ╚═══════════════════════════════════════════════════════════════╝
    "
}

main "$@"
