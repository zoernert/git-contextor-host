const MetaSearchService = require('../../src/services/MetaSearchService');
const QdrantCollection = require('../../src/models/QdrantCollection');
const Tunnel = require('../../src/models/Tunnel');
const User = require('../../src/models/User');
const SearchTemplate = require('../../src/models/SearchTemplate');
const SearchHistory = require('../../src/models/SearchHistory');

// Mock the dependencies
jest.mock('../../src/services/QdrantService');

describe('MetaSearchService', () => {
  let service;
  let mockUser;

  beforeEach(() => {
    service = new MetaSearchService();
    mockUser = {
      _id: 'user123',
      email: 'test@example.com'
    };
  });

  describe('getSearchTargets', () => {
    test('should return hosted collections', async () => {
      const mockCollection = {
        _id: 'col123',
        name: 'Test Collection',
        collectionName: 'test_collection',
        userId: 'user123',
        isActive: true
      };

      jest.spyOn(QdrantCollection, 'findOne').mockResolvedValue(mockCollection);

      const targets = await service.getSearchTargets('user123', ['col123'], []);
      
      expect(targets).toHaveLength(1);
      expect(targets[0]).toMatchObject({
        type: 'hosted',
        id: 'col123',
        name: 'Test Collection',
        weight: 1.0
      });
    });

    test('should return tunnel collections', async () => {
      const mockTunnel = {
        _id: 'tunnel123',
        tunnelPath: 'test-tunnel',
        url: 'https://tunnel.example.com/tunnel/test-tunnel',
        userId: 'user123',
        isActive: true
      };

      jest.spyOn(Tunnel, 'findOne').mockResolvedValue(mockTunnel);

      const targets = await service.getSearchTargets('user123', [], ['tunnel123']);
      
      expect(targets).toHaveLength(1);
      expect(targets[0]).toMatchObject({
        type: 'tunnel',
        id: 'tunnel123',
        name: 'test-tunnel',
        weight: 1.0
      });
    });

    test('should handle search templates', async () => {
      const mockTemplate = {
        _id: 'template123',
        userId: 'user123',
        collections: [{
          collectionId: 'col123',
          enabled: true,
          weight: 1.5
        }]
      };

      const mockCollection = {
        _id: 'col123',
        name: 'Template Collection',
        collectionName: 'template_collection',
        userId: 'user123',
        isActive: true
      };

      jest.spyOn(SearchTemplate, 'findOne').mockResolvedValue(mockTemplate);
      jest.spyOn(QdrantCollection, 'findOne').mockResolvedValue(mockCollection);

      const targets = await service.getSearchTargets('user123', [], [], 'template123');
      
      expect(targets).toHaveLength(1);
      expect(targets[0]).toMatchObject({
        type: 'hosted',
        id: 'col123',
        name: 'Template Collection',
        weight: 1.5
      });
    });
  });

  describe('extractContent', () => {
    test('should extract content from result payload', () => {
      const result = {
        payload: {
          text: 'This is some text content',
          filepath: '/path/to/file.js',
          filename: 'file.js'
        }
      };

      const content = service.extractContent(result, false);
      
      expect(content).toBe('This is some text content [File: /path/to/file.js] [file.js]');
    });

    test('should include metadata when requested', () => {
      const result = {
        payload: {
          text: 'Content',
          metadata: { type: 'function', language: 'javascript' }
        }
      };

      const content = service.extractContent(result, true);
      
      expect(content).toContain('Content');
      expect(content).toContain('[Metadata:');
      expect(content).toContain('function');
    });
  });

  describe('aggregateResults', () => {
    test('should aggregate and sort results by weighted score', async () => {
      const searchResults = [
        {
          targetName: 'Collection A',
          targetType: 'hosted',
          weight: 1.0,
          results: [
            { id: '1', score: 0.9 },
            { id: '2', score: 0.8 }
          ]
        },
        {
          targetName: 'Collection B',
          targetType: 'tunnel',
          weight: 1.5,
          results: [
            { id: '3', score: 0.7 }
          ]
        }
      ];

      const aggregated = await service.aggregateResults(searchResults, []);
      
      expect(aggregated).toHaveLength(3);
      expect(aggregated[0]).toMatchObject({
        id: '3',
        weightedScore: expect.closeTo(1.05, 5), // 0.7 * 1.5
        originalScore: 0.7,
        sourceCollection: 'Collection B',
        sourceType: 'tunnel'
      });
      expect(aggregated[1]).toMatchObject({
        id: '1',
        weightedScore: 0.9,
        originalScore: 0.9
      });
    });
  });
});
