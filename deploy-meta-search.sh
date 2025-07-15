#!/bin/bash

# Meta Search Deployment Script
# This script deploys the Meta Search feature to your Git Contextor Host

echo "🚀 Starting Meta Search deployment..."

# Check if we're in the right directory
if [ ! -f "tunnel-service/package.json" ]; then
    echo "❌ Error: Please run this script from the git-contextor-host root directory"
    exit 1
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd tunnel-service
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd admin-ui
npm install

# Build frontend
echo "🔨 Building frontend..."
npm run build

# Go back to tunnel-service directory
cd ..

# Run database migrations (if any)
echo "🗄️ Running database migrations..."
# Add any migration commands here if needed

# Check environment variables
echo "🔍 Checking environment configuration..."
if [ -z "$QDRANT_URL" ]; then
    echo "⚠️  Warning: QDRANT_URL not set. Using default: http://localhost:6333"
fi

# Start the application
echo "🏃 Starting application..."
if [ "$1" = "production" ]; then
    echo "🌐 Starting in production mode..."
    npm start
else
    echo "🛠️  Starting in development mode..."
    npm run dev
fi

echo "✅ Meta Search deployment completed!"
echo ""
echo "📖 Documentation available at: tunnel-service/docs/meta-search.md"
echo "🌐 Admin UI available at: http://localhost:5000"
echo "🔍 Meta Search available at: http://localhost:5000/meta-search"
echo ""
echo "🔧 Configuration:"
echo "   - Set EMBEDDING_PROVIDER=gemini (recommended) or openai"
echo "   - Set GEMINI_API_KEY for Gemini or OPENAI_API_KEY for OpenAI"
echo "   - Configure QDRANT_URL for your Qdrant instance"
echo "   - Adjust MAX_META_SEARCH_SOURCES if needed (default: 20)"
echo ""
echo "🧪 Run tests with: npm test"
echo "📊 Run with coverage: npm run test:coverage"
