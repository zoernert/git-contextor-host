import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  Cog6ToothIcon,
  ClockIcon,
  BookmarkIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import api from '../services/api';

export default function MetaSearch() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [selectedTunnels, setSelectedTunnels] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [searchConfig, setSearchConfig] = useState({
    maxResults: 50,
    scoreThreshold: 0.7,
    maxTokens: 4000,
    includeMetadata: true,
    model: 'gpt-4'
  });
  const [searchResults, setSearchResults] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    collections: [],
    searchConfig: { ...searchConfig }
  });

  // Fetch available sources
  const { data: sources, isLoading: sourcesLoading } = useQuery({
    queryKey: ['metaSearchSources'],
    queryFn: async () => {
      const response = await api.get('/meta-search/sources');
      return response.data;
    }
  });

  // Fetch search templates
  const { data: templates } = useQuery({
    queryKey: ['searchTemplates'],
    queryFn: async () => {
      const response = await api.get('/meta-search/templates');
      return response.data;
    }
  });

  // Fetch search history
  const { data: historyData } = useQuery({
    queryKey: ['searchHistory'],
    queryFn: async () => {
      const response = await api.get('/meta-search/history?limit=10');
      return response.data;
    }
  });

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: async (searchParams) => {
      const response = await api.post('/meta-search/search', searchParams);
      return response.data;
    },
    onSuccess: (data) => {
      setSearchResults(data);
      queryClient.invalidateQueries(['searchHistory']);
    }
  });

  // Template mutations
  const createTemplateMutation = useMutation({
    mutationFn: async (templateData) => {
      const response = await api.post('/meta-search/templates', templateData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['searchTemplates']);
      setShowTemplateForm(false);
      setNewTemplate({
        name: '',
        description: '',
        collections: [],
        searchConfig: { ...searchConfig }
      });
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId) => {
      await api.delete(`/meta-search/templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['searchTemplates']);
      setSelectedTemplate('');
    }
  });

  const handleSearch = () => {
    if (!query.trim()) return;

    const searchParams = {
      query,
      ...searchConfig
    };

    if (selectedTemplate) {
      searchParams.searchTemplateId = selectedTemplate;
    } else {
      searchParams.collections = selectedCollections;
      searchParams.tunnels = selectedTunnels;
    }

    searchMutation.mutate(searchParams);
  };

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    if (templateId) {
      // Clear individual selections when template is selected
      setSelectedCollections([]);
      setSelectedTunnels([]);
    }
  };

  const handleSaveTemplate = () => {
    if (!newTemplate.name.trim()) return;

    const templateCollections = [
      ...selectedCollections.map(id => ({ collectionId: id, enabled: true })),
      ...selectedTunnels.map(id => ({ tunnelId: id, enabled: true }))
    ];

    createTemplateMutation.mutate({
      ...newTemplate,
      collections: templateCollections,
      searchConfig
    });
  };

  const toggleCollectionSelection = (collectionId) => {
    setSelectedCollections(prev => 
      prev.includes(collectionId)
        ? prev.filter(id => id !== collectionId)
        : [...prev, collectionId]
    );
  };

  const toggleTunnelSelection = (tunnelId) => {
    setSelectedTunnels(prev => 
      prev.includes(tunnelId)
        ? prev.filter(id => id !== tunnelId)
        : [...prev, tunnelId]
    );
  };

  const ResultItem = ({ result, index }) => {
    const [showMetadata, setShowMetadata] = useState(false);

    return (
      <div className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
        <div className="flex justify-between items-start mb-2">
          <div className="text-sm text-gray-600">
            <span className="font-medium text-blue-600">{result.sourceCollection}</span>
            <span className="mx-2">•</span>
            <span className="capitalize bg-gray-100 px-2 py-1 rounded text-xs">
              {result.sourceType}
            </span>
            <span className="mx-2">•</span>
            <span className="font-mono text-xs">
              Score: {result.score.toFixed(3)}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {result.tokens} tokens
          </div>
        </div>
        
        <div className="text-sm bg-gray-50 p-3 rounded mb-2 whitespace-pre-wrap">
          {result.content}
        </div>

        {searchConfig.includeMetadata && result.payload && (
          <div className="mt-2">
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className="flex items-center text-xs text-gray-500 hover:text-gray-700"
            >
              {showMetadata ? <ChevronUpIcon className="w-3 h-3 mr-1" /> : <ChevronDownIcon className="w-3 h-3 mr-1" />}
              Metadata
            </button>
            {showMetadata && (
              <pre className="text-xs bg-gray-100 p-2 mt-1 rounded overflow-x-auto">
                {JSON.stringify(result.payload, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    );
  };

  if (sourcesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Meta Search</h1>
        <p className="text-gray-600 text-sm">
          Search across multiple collections and tunnels simultaneously
        </p>
      </div>

      {/* Search Interface */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Search Query</label>
          <div className="relative">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your search query for AI-powered research..."
              className="w-full p-3 border rounded-lg pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
            <MagnifyingGlassIcon className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
          </div>
        </div>

        {/* Template Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Search Template</label>
          <div className="flex gap-2">
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a template or choose sources manually</option>
              {templates?.map(template => (
                <option key={template._id} value={template._id}>
                  {template.name} ({template.collections.length} sources)
                </option>
              ))}
            </select>
            {selectedTemplate && (
              <button
                onClick={() => deleteTemplateMutation.mutate(selectedTemplate)}
                className="px-3 py-2 text-red-600 hover:text-red-800"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Source Selection (only if no template selected) */}
        {!selectedTemplate && (
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-medium mb-2 flex items-center">
                <DocumentTextIcon className="w-4 h-4 mr-1" />
                Hosted Collections ({sources?.hostedCollections?.length || 0})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {sources?.hostedCollections?.length === 0 ? (
                  <p className="text-gray-500 text-sm">No hosted collections available</p>
                ) : (
                  sources?.hostedCollections?.map(collection => (
                    <label key={collection._id} className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedCollections.includes(collection._id)}
                        onChange={() => toggleCollectionSelection(collection._id)}
                        className="mr-2"
                      />
                      <span className="text-sm flex-1">{collection.name}</span>
                      <span className="text-xs text-gray-500">
                        {collection.usage?.vectorCount || 0} vectors
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2 flex items-center">
                <Cog6ToothIcon className="w-4 h-4 mr-1" />
                Tunnel Collections ({sources?.tunnelCollections?.length || 0})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {sources?.tunnelCollections?.length === 0 ? (
                  <p className="text-gray-500 text-sm">No tunnel collections available</p>
                ) : (
                  sources?.tunnelCollections?.map(tunnel => (
                    <label key={tunnel._id} className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedTunnels.includes(tunnel._id)}
                        onChange={() => toggleTunnelSelection(tunnel._id)}
                        className="mr-2"
                      />
                      <span className="text-sm flex-1">{tunnel.tunnelPath}</span>
                      <span className="text-xs text-gray-500">
                        :{tunnel.localPort}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Advanced Configuration */}
        <div className="mb-6">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-sm text-gray-600 hover:text-gray-800"
          >
            {showAdvanced ? <ChevronUpIcon className="w-4 h-4 mr-1" /> : <ChevronDownIcon className="w-4 h-4 mr-1" />}
            Advanced Configuration
          </button>
          
          {showAdvanced && (
            <div className="mt-4 grid md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-xs font-medium mb-1">Max Results</label>
                <input
                  type="number"
                  value={searchConfig.maxResults}
                  onChange={(e) => setSearchConfig({...searchConfig, maxResults: parseInt(e.target.value) || 50})}
                  className="w-full p-2 text-sm border rounded"
                  min="1"
                  max="200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Score Threshold</label>
                <input
                  type="number"
                  value={searchConfig.scoreThreshold}
                  onChange={(e) => setSearchConfig({...searchConfig, scoreThreshold: parseFloat(e.target.value) || 0.7})}
                  className="w-full p-2 text-sm border rounded"
                  min="0"
                  max="1"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Max Tokens</label>
                <input
                  type="number"
                  value={searchConfig.maxTokens}
                  onChange={(e) => setSearchConfig({...searchConfig, maxTokens: parseInt(e.target.value) || 4000})}
                  className="w-full p-2 text-sm border rounded"
                  min="100"
                  max="50000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  AI Model
                  <span className="text-gray-500 ml-1">(for token counting)</span>
                </label>
                <select
                  value={searchConfig.model}
                  onChange={(e) => setSearchConfig({...searchConfig, model: e.target.value})}
                  className="w-full p-2 text-sm border rounded"
                >
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="claude">Claude</option>
                  <option value="claude-3">Claude 3</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Used for accurate token counting and content sizing. Does not affect search results.
                </p>
              </div>
              <div className="flex items-end">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={searchConfig.includeMetadata}
                    onChange={(e) => setSearchConfig({...searchConfig, includeMetadata: e.target.checked})}
                    className="mr-2"
                  />
                  Include Metadata
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              disabled={searchMutation.isPending || !query.trim() || (!selectedTemplate && selectedCollections.length === 0 && selectedTunnels.length === 0)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 flex items-center"
            >
              <MagnifyingGlassIcon className="w-4 h-4 mr-2" />
              {searchMutation.isPending ? 'Searching...' : 'Search'}
            </button>

            {!selectedTemplate && (selectedCollections.length > 0 || selectedTunnels.length > 0) && (
              <button
                onClick={() => setShowTemplateForm(true)}
                className="bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 flex items-center"
              >
                <BookmarkIcon className="w-4 h-4 mr-2" />
                Save Template
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Template Creation Form */}
      {showTemplateForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-4">Save Search Template</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Template Name</label>
              <input
                type="text"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                className="w-full p-2 border rounded-lg"
                placeholder="Enter template name..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description (optional)</label>
              <textarea
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
                className="w-full p-2 border rounded-lg"
                rows={2}
                placeholder="Describe this search template..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveTemplate}
                disabled={!newTemplate.name.trim() || createTemplateMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {createTemplateMutation.isPending ? 'Saving...' : 'Save Template'}
              </button>
              <button
                onClick={() => setShowTemplateForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold">Search Results</h2>
            <div className="text-sm text-gray-600 mt-1 flex items-center justify-between">
              <span>
                Found {searchResults.totalResults} results, showing {searchResults.processedResults}
              </span>
              <div className="flex items-center gap-4">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  Token usage: {searchResults.tokenUsage.used}/{searchResults.tokenUsage.limit} ({searchResults.tokenUsage.percentage}%)
                </span>
                {searchResults.executionTime && (
                  <span className="text-xs text-gray-500">
                    <ClockIcon className="w-3 h-3 inline mr-1" />
                    {searchResults.executionTime}ms
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {searchResults.results.map((result, index) => (
              <ResultItem key={index} result={result} index={index} />
            ))}
          </div>
        </div>
      )}

      {/* Recent Searches */}
      {historyData?.history?.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <ClockIcon className="w-5 h-5 mr-2" />
            Recent Searches
          </h3>
          <div className="space-y-2">
            {historyData.history.slice(0, 5).map((historyItem) => (
              <div key={historyItem._id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex-1">
                  <p className="text-sm font-medium">{historyItem.query}</p>
                  <p className="text-xs text-gray-500">
                    {historyItem.results.totalResults} results • {historyItem.results.finalTokenCount} tokens
                  </p>
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(historyItem.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
