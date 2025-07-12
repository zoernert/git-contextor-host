#!/bin/bash

# =============================================================================
# Git Contextor Host - Production Deployment Script
# =============================================================================
# This script deploys the tunnel service to the production server
# Server: 10.0.0.14
# Repository: /opt/git-contextor-host
# Process Manager: PM2
# =============================================================================

set -e  # Exit on any error

# Configuration
SERVER_HOST="10.0.0.14"
SERVER_USER="root"
REMOTE_PATH="/opt/git-contextor-host"
APP_NAME="git-contextor-host"
SERVICE_PATH="$REMOTE_PATH/tunnel-service"
BACKUP_PATH="/opt/backups/git-contextor-host"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
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

# Check if local Node.js and npm are available for building
check_local_dependencies() {
    log "Checking local build dependencies..."
    
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed locally. Please install Node.js to build the frontend."
    fi
    
    if ! command -v npm &> /dev/null; then
        error "npm is not installed locally. Please install npm to build the frontend."
    fi
    
    success "Local build dependencies available"
}

# Build frontend locally
build_frontend() {
    log "Building frontend application..."
    
    # Check if admin-ui directory exists
    if [ ! -d "tunnel-service/admin-ui" ]; then
        error "Frontend directory 'tunnel-service/admin-ui' not found!"
    fi
    
    # Navigate to frontend directory
    cd tunnel-service/admin-ui
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        log "Installing frontend dependencies..."
        npm install
    fi
    
    # Build the frontend
    log "Building React application..."
    npm run build
    
    # Verify build was successful
    if [ ! -d "dist" ]; then
        error "Frontend build failed - dist directory not created!"
    fi
    
    # Return to original directory
    cd ../..
    success "Frontend build completed"
}

# Check if SSH connection is available
check_ssh_connection() {
    log "Checking SSH connection to $SERVER_USER@$SERVER_HOST..."
    if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$SERVER_USER@$SERVER_HOST" exit 2>/dev/null; then
        error "Cannot connect to $SERVER_HOST. Please check your SSH configuration."
    fi
    success "SSH connection established"
}

# Check if the remote repository exists
check_remote_repository() {
    log "Checking remote repository at $REMOTE_PATH..."
    if ! ssh "$SERVER_USER@$SERVER_HOST" "[ -d '$REMOTE_PATH' ]"; then
        error "Repository not found at $REMOTE_PATH on remote server"
    fi
    success "Remote repository found"
}

# Create backup of current deployment
create_backup() {
    log "Creating backup of current deployment..."
    
    BACKUP_DIR="$BACKUP_PATH/$(date +%Y%m%d_%H%M%S)"
    
    ssh "$SERVER_USER@$SERVER_HOST" "
        mkdir -p '$BACKUP_DIR'
        if [ -d '$SERVICE_PATH' ]; then
            cp -r '$SERVICE_PATH' '$BACKUP_DIR/'
            echo 'Backup created at: $BACKUP_DIR'
        else
            echo 'No existing service to backup'
        fi
    "
    
    success "Backup completed"
}

# Pull latest code from repository
pull_latest_code() {
    log "Pulling latest code from repository..."
    
    ssh "$SERVER_USER@$SERVER_HOST" "
        cd '$REMOTE_PATH'
        git fetch --all
        git reset --hard origin/main
        git pull origin main
    "
    
    success "Latest code pulled"
}

# Install dependencies and build frontend
install_dependencies() {
    log "Installing Node.js dependencies..."
    
    ssh "$SERVER_USER@$SERVER_HOST" "
        cd '$SERVICE_PATH'
        npm ci --production
    "
    
    success "Dependencies installed"
}

# Upload built frontend to server
upload_frontend() {
    log "Uploading built frontend to server..."
    
    # Upload the built dist directory
    scp -r tunnel-service/admin-ui/dist "$SERVER_USER@$SERVER_HOST:$SERVICE_PATH/admin-ui/"
    
    success "Frontend uploaded to server"
}

# Configure backend to serve static files
configure_static_serving() {
    log "Configuring backend to serve static files..."
    
    ssh "$SERVER_USER@$SERVER_HOST" "
        cd '$SERVICE_PATH'
        
        # Check if static file serving is already configured
        if ! grep -q 'express.static' src/index.js; then
            # Create backup of index.js
            cp src/index.js src/index.js.backup
            
            # Add path require if not present
            if ! grep -q \"const path = require('path')\" src/index.js; then
                sed -i '1a const path = require(\"path\");' src/index.js
            fi
            
            # Add static serving configuration before app.listen
            sed -i '/app\.listen/i\\
// Serve static files from admin-ui/dist\
app.use(express.static(path.join(__dirname, \"../admin-ui/dist\")));\
\
// Handle React Router - serve index.html for non-API routes\
app.get(\"*\", (req, res, next) => {\
  // Skip API routes\
  if (req.path.startsWith(\"/api/\")) {\
    return next();\
  }\
  \
  // Serve index.html for all other routes\
  res.sendFile(path.join(__dirname, \"../admin-ui/dist/index.html\"));\
});\
' src/index.js
            
            echo 'Static file serving configured'
        else
            echo 'Static file serving already configured'
        fi
    "
    
    success "Static file serving configured"
}

# Setup environment configuration
setup_environment() {
    log "Setting up environment configuration..."
    
    # Check if .env exists, if not create from example
    ssh "$SERVER_USER@$SERVER_HOST" "
        cd '$SERVICE_PATH'
        if [ ! -f '.env' ]; then
            cp '.env.example' '.env'
            echo 'Created .env from .env.example'
            echo 'Please update .env with production values!'
        else
            echo '.env already exists'
        fi
    "
    
    success "Environment configuration ready"
}

# Create PM2 ecosystem configuration
create_pm2_config() {
    log "Creating PM2 ecosystem configuration..."
    
    ssh "$SERVER_USER@$SERVER_HOST" "
        cd '$SERVICE_PATH'
        cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'git-contextor-host',
    script: 'src/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    log_file: 'logs/combined.log',
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=2048',
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,
    merge_logs: true,
    kill_timeout: 1600,
    listen_timeout: 8000,
    instance_var: 'INSTANCE_ID'
  }]
};
EOF
    "
    
    success "PM2 configuration created"
}

# Setup log directories
setup_logging() {
    log "Setting up logging directories..."
    
    ssh "$SERVER_USER@$SERVER_HOST" "
        cd '$SERVICE_PATH'
        mkdir -p logs
        chmod 755 logs
    "
    
    success "Logging directories ready"
}

# Stop existing PM2 process
stop_service() {
    log "Stopping existing service..."
    
    ssh "$SERVER_USER@$SERVER_HOST" "
        cd '$SERVICE_PATH'
        pm2 stop '$APP_NAME' 2>/dev/null || echo 'Service not running'
        pm2 delete '$APP_NAME' 2>/dev/null || echo 'Service not registered'
    "
    
    success "Service stopped"
}

# Start service with PM2
start_service() {
    log "Starting service with PM2..."
    
    ssh "$SERVER_USER@$SERVER_HOST" "
        cd '$SERVICE_PATH'
        pm2 start ecosystem.config.js --env production
        pm2 save
    "
    
    success "Service started"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Wait for service to start
    sleep 10
    
    ssh "$SERVER_USER@$SERVER_HOST" "
        cd '$SERVICE_PATH'
        
        # Check if process is running
        if pm2 list | grep -q '$APP_NAME.*online'; then
            echo 'PM2 process is running'
        else
            echo 'PM2 process failed to start'
            exit 1
        fi
        
        # Check if API responds
        if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
            echo 'API health check passed'
        else
            echo 'API health check failed - service not responding'
            exit 1
        fi
        
        # Check if frontend is served
        if curl -f http://localhost:5000/ > /dev/null 2>&1; then
            echo 'Frontend serving check passed'
        else
            echo 'Frontend serving check failed'
            exit 1
        fi
    "
    
    success "Health check passed"
}

# Display service status
show_status() {
    log "Service status:"
    
    ssh "$SERVER_USER@$SERVER_HOST" "
        cd '$SERVICE_PATH'
        echo '=== PM2 Status ==='
        pm2 list
        echo
        echo '=== Service Logs (last 10 lines) ==='
        pm2 logs '$APP_NAME' --lines 10 --nostream
    "
}

# Setup logrotate
setup_logrotate() {
    log "Setting up log rotation..."
    
    ssh "$SERVER_USER@$SERVER_HOST" "
        cat > /etc/logrotate.d/git-contextor-host << 'EOF'
$SERVICE_PATH/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        pm2 reload git-contextor-host
    endscript
}
EOF
    "
    
    success "Log rotation configured"
}

# Main deployment function
deploy() {
    echo "
    ╔═══════════════════════════════════════════════════════════════╗
    ║                Git Contextor Host Deployment                  ║
    ║                  Full-Stack Production Server                 ║
    ╚═══════════════════════════════════════════════════════════════╝
    "
    
    log "Starting full-stack deployment to $SERVER_HOST..."
    
    # Pre-deployment checks
    check_local_dependencies
    check_ssh_connection
    check_remote_repository
    
    # Build frontend locally
    build_frontend
    
    # Deployment steps
    create_backup
    pull_latest_code
    install_dependencies
    upload_frontend
    configure_static_serving
    setup_environment
    create_pm2_config
    setup_logging
    setup_logrotate
    
    # Service management
    stop_service
    start_service
    health_check
    
    # Post-deployment
    show_status
    
    success "Full-stack deployment completed successfully!"
    
    echo "
    ╔═══════════════════════════════════════════════════════════════╗
    ║                    Deployment Summary                         ║
    ╠═══════════════════════════════════════════════════════════════╣
    ║ Server: $SERVER_HOST                                   ║
    ║ Frontend: Available at http://$SERVER_HOST:5000        ║
    ║ API: Available at http://$SERVER_HOST:5000/api         ║
    ║ Process Manager: PM2                                          ║
    ║ Health Check: ✅ Passed                                       ║
    ║                                                               ║
    ║ Next Steps:                                                   ║
    ║ 1. Update .env with production values                         ║
    ║ 2. Configure domain and SSL certificates                      ║
    ║ 3. Access the application at http://$SERVER_HOST:5000  ║
    ╚═══════════════════════════════════════════════════════════════╝
    "
}

# Rollback function
rollback() {
    log "Rolling back to previous version..."
    
    LATEST_BACKUP=$(ssh "$SERVER_USER@$SERVER_HOST" "ls -t '$BACKUP_PATH' | head -1")
    
    if [ -z "$LATEST_BACKUP" ]; then
        error "No backup found for rollback"
    fi
    
    ssh "$SERVER_USER@$SERVER_HOST" "
        pm2 stop '$APP_NAME' 2>/dev/null || true
        rm -rf '$SERVICE_PATH'
        cp -r '$BACKUP_PATH/$LATEST_BACKUP/tunnel-service' '$SERVICE_PATH'
        cd '$SERVICE_PATH'
        npm ci --production
        pm2 start ecosystem.config.js --env production
        pm2 save
    "
    
    success "Rollback completed to backup: $LATEST_BACKUP"
}

# Show logs
show_logs() {
    log "Showing service logs..."
    ssh "$SERVER_USER@$SERVER_HOST" "cd '$SERVICE_PATH' && pm2 logs '$APP_NAME'"
}

# Restart service
restart_service() {
    log "Restarting service..."
    ssh "$SERVER_USER@$SERVER_HOST" "cd '$SERVICE_PATH' && pm2 restart '$APP_NAME'"
    success "Service restarted"
}

# Command line interface
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    build)
        log "Building frontend only..."
        check_local_dependencies
        build_frontend
        success "Frontend build completed"
        ;;
    upload)
        log "Uploading frontend only..."
        check_ssh_connection
        upload_frontend
        success "Frontend upload completed"
        ;;
    rollback)
        rollback
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    restart)
        restart_service
        ;;
    health)
        health_check
        ;;
    *)
        echo "Usage: $0 {deploy|build|upload|rollback|status|logs|restart|health}"
        echo ""
        echo "Commands:"
        echo "  deploy   - Full deployment with frontend build"
        echo "  build    - Build frontend only (local)"
        echo "  upload   - Upload built frontend to server"
        echo "  rollback - Rollback to previous deployment"
        echo "  status   - Show service status"
        echo "  logs     - Show service logs"
        echo "  restart  - Restart the service"
        echo "  health   - Perform health check"
        exit 1
        ;;
esac
