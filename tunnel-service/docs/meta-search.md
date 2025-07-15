# Meta Search Feature Documentation

## Overview

The Meta Search feature allows users to perform semantic search across multiple Qdrant collections simultaneously, including both hosted collections and tunneled instances. This feature is specifically designed for AI agents to perform deep research across distributed vector stores.

## Key Features

- **Multi-source search**: Search across hosted collections and tunneled Qdrant instances
- **Relevance-based aggregation**: Results are aggregated and sorted by weighted relevance scores
- **Token-aware results**: Automatically limits results based on token count for AI consumption
- **Search templates**: Save and reuse search configurations for common use cases
- **Search history**: Track and analyze search patterns
- **Flexible configuration**: Customize search parameters like score thresholds and result limits

## API Endpoints

### Search Operations

#### POST /api/meta-search/search
Perform a meta search across multiple collections and tunnels.

**Request Body:**
```json
{
  "query": "search query string",
  "collections": ["collection_id_1", "collection_id_2"],
  "tunnels": ["tunnel_id_1", "tunnel_id_2"],
  "maxResults": 50,
  "scoreThreshold": 0.7,
  "maxTokens": 4000,
  "includeMetadata": true,
  "searchTemplateId": "template_id", // optional
  "model": "gpt-4" // for token counting
}
```

**Response:**
```json
{
  "totalResults": 150,
  "processedResults": 25,
  "results": [
    {
      "id": "result_id",
      "score": 0.95,
      "originalScore": 0.90,
      "sourceCollection": "My Collection",
      "sourceType": "hosted",
      "content": "extracted text content",
      "tokens": 45,
      "payload": { /* original payload */ }
    }
  ],
  "tokenUsage": {
    "used": 3850,
    "limit": 4000,
    "percentage": "96.3"
  },
  "executionTime": 1250
}
```

#### GET /api/meta-search/sources
Get available search sources (collections and tunnels) for the authenticated user.

**Response:**
```json
{
  "hostedCollections": [
    {
      "_id": "col_id",
      "name": "Collection Name",
      "collectionName": "collection_name",
      "usage": {
        "vectorCount": 1000
      }
    }
  ],
  "tunnelCollections": [
    {
      "_id": "tunnel_id",
      "tunnelPath": "my-tunnel",
      "url": "https://tunnel.example.com/tunnel/my-tunnel",
      "localPort": 6333
    }
  ],
  "totalSources": 2
}
```

### Template Management

#### POST /api/meta-search/templates
Create a new search template.

**Request Body:**
```json
{
  "name": "Research Template",
  "description": "Template for research queries",
  "collections": [
    {
      "collectionId": "col_id",
      "weight": 1.0,
      "enabled": true
    },
    {
      "tunnelId": "tunnel_id",
      "weight": 1.5,
      "enabled": true
    }
  ],
  "searchConfig": {
    "maxResults": 50,
    "scoreThreshold": 0.7,
    "maxTokens": 4000,
    "includeMetadata": true
  }
}
```

#### GET /api/meta-search/templates
Get all search templates for the authenticated user.

#### PUT /api/meta-search/templates/:id
Update a search template.

#### DELETE /api/meta-search/templates/:id
Delete a search template.

### History Management

#### GET /api/meta-search/history
Get paginated search history.

**Query Parameters:**
- `limit`: Number of results per page (default: 50)
- `page`: Page number (default: 1)

#### DELETE /api/meta-search/history/:id
Delete a specific search history item.

#### POST /api/meta-search/history/clear
Clear all search history for the authenticated user.

### Similar Queries

#### GET /api/meta-search/similar-queries
Get similar queries for search suggestions.

**Query Parameters:**
- `query`: The query to find similar queries for
- `limit`: Number of similar queries to return (default: 5)

## Configuration

### Environment Variables

```bash
# Maximum concurrent searches
MAX_META_SEARCH_SOURCES=20

# Cache TTL in seconds
META_SEARCH_CACHE_TTL=300
```

### Search Parameters

- **maxResults**: Maximum number of results to return per search (1-200)
- **scoreThreshold**: Minimum similarity score for results (0.0-1.0)
- **maxTokens**: Maximum tokens for AI consumption (100-50000)
- **includeMetadata**: Whether to include metadata in results
- **model**: AI model for token counting (gpt-4, gpt-4-turbo, claude, claude-3)

## Frontend Integration

### Meta Search Page

The Meta Search page (`/meta-search`) provides a comprehensive interface for:

1. **Query Input**: Multi-line text area for search queries
2. **Source Selection**: Checkboxes for hosted collections and tunnels
3. **Template Management**: Create, select, and manage search templates
4. **Advanced Configuration**: Fine-tune search parameters
5. **Results Display**: Token-aware results with metadata toggle
6. **Search History**: Recent searches with quick access

### Navigation

The Meta Search feature is integrated into the main user navigation:

```jsx
// UserNavigation.jsx
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Meta Search', href: '/meta-search', icon: MagnifyingGlassIcon },
  { name: 'Qdrant', href: '/qdrant', icon: CircleStackIcon },
  { name: 'Subscription', href: '/subscription', icon: CreditCardIcon },
];
```

## Data Models

### SearchTemplate
```javascript
{
  userId: ObjectId,
  name: String,
  description: String,
  collections: [{
    collectionId: ObjectId,
    tunnelId: ObjectId,
    weight: Number,
    enabled: Boolean
  }],
  searchConfig: {
    maxResults: Number,
    scoreThreshold: Number,
    maxTokens: Number,
    includeMetadata: Boolean
  },
  createdAt: Date,
  lastUsed: Date
}
```

### SearchHistory
```javascript
{
  userId: ObjectId,
  query: String,
  collections: [ObjectId],
  tunnels: [ObjectId],
  results: {
    totalResults: Number,
    processedResults: Number,
    finalTokenCount: Number,
    executionTime: Number
  },
  searchConfig: {
    maxResults: Number,
    scoreThreshold: Number,
    maxTokens: Number
  },
  createdAt: Date
}
```

## Security and Rate Limiting

- **Authentication**: All endpoints require valid JWT token
- **Rate Limiting**: Search endpoint is rate-limited to 100 requests per 15-minute window
- **Input Validation**: Query length, parameter ranges, and required fields are validated
- **User Isolation**: Users can only access their own collections, tunnels, and search history

## Error Handling

Common error responses:

```json
{
  "msg": "Query is required"
}
```

```json
{
  "msg": "At least one collection, tunnel, or search template must be selected"
}
```

```json
{
  "msg": "Max results cannot exceed 200"
}
```

## Performance Considerations

- **Connection Pooling**: Qdrant clients use connection pooling for efficiency
- **Concurrent Searches**: Limited to prevent system overload
- **Token Counting**: Efficient token estimation for result limiting
- **Caching**: Optional caching for frequent searches (configurable TTL)

## Testing

The implementation includes comprehensive test coverage:

- **Unit Tests**: Service-level testing for core functionality
- **Integration Tests**: API endpoint testing with authentication
- **Mock Data**: Proper mocking of external dependencies

Run tests with:
```bash
npm test
npm run test:coverage
```

## Deployment

1. **Environment Setup**: Configure required environment variables
2. **Database Migration**: New collections will be created automatically
3. **Frontend Build**: Rebuild admin-ui to include new components

## Usage Examples

### Basic Search
```javascript
// Search across specific collections
const searchParams = {
  query: "How to implement authentication in Node.js",
  collections: ["nodejs_docs", "auth_examples"],
  maxResults: 25,
  scoreThreshold: 0.8
};

const results = await api.post('/meta-search/search', searchParams);
```

### Template-Based Search
```javascript
// Use a saved template
const searchParams = {
  query: "database connection patterns",
  searchTemplateId: "research_template_id",
  maxTokens: 6000
};

const results = await api.post('/meta-search/search', searchParams);
```

### AI Agent Integration
```javascript
// Optimized for AI consumption
const searchParams = {
  query: "user authentication best practices",
  collections: ["security_docs", "code_examples"],
  maxTokens: 8000,
  includeMetadata: true,
  model: "gpt-4"
};

const results = await api.post('/meta-search/search', searchParams);
// Use results.results for AI context
```

This documentation provides a complete guide for implementing, configuring, and using the Meta Search feature in your Git Contextor Host application.
