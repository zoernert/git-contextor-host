import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Link } from 'react-router-dom';

const fetchCollections = async () => {
    const token = localStorage.getItem('token');
    const { data } = await axios.get('/api/qdrant/collections', {
        headers: { 'x-auth-token': token },
    });
    return data;
};

const createCollection = async (collectionData) => {
    const token = localStorage.getItem('token');
    const { data } = await axios.post('/api/qdrant/collections', collectionData, {
        headers: { 'x-auth-token': token },
    });
    return data;
};

const deleteCollection = async (collectionId) => {
    const token = localStorage.getItem('token');
    await axios.delete(`/api/qdrant/collections/${collectionId}`, {
        headers: { 'x-auth-token': token },
    });
};

const getConnectionInfo = async (collectionId) => {
    const token = localStorage.getItem('token');
    const { data } = await axios.get(`/api/qdrant/collections/${collectionId}/connection`, {
        headers: { 'x-auth-token': token },
    });
    return data;
};

const testConnection = async (collectionId) => {
    const token = localStorage.getItem('token');
    const { data } = await axios.post(`/api/qdrant/collections/${collectionId}/test-connection`, {}, {
        headers: { 'x-auth-token': token },
    });
    return data;
};

export default function Qdrant() {
    const queryClient = useQueryClient();
    const [newCollection, setNewCollection] = useState({
        name: '',
        description: '',
        vectorSize: 1536,
        distance: 'Cosine'
    });
    const [selectedCollection, setSelectedCollection] = useState(null);
    const [showConnectionInfo, setShowConnectionInfo] = useState(false);
    const [connectionInfo, setConnectionInfo] = useState(null);
    const [testResult, setTestResult] = useState(null);

    const { data: collections, isLoading } = useQuery(['qdrantCollections'], fetchCollections);

    const createMutation = useMutation(createCollection, {
        onSuccess: () => {
            queryClient.invalidateQueries(['qdrantCollections']);
            setNewCollection({
                name: '',
                description: '',
                vectorSize: 1536,
                distance: 'Cosine'
            });
            alert('Collection created successfully.');
        },
        onError: (error) => {
            alert('Failed to create collection: ' + (error.response?.data?.msg || 'Server error'));
        }
    });

    const deleteMutation = useMutation(deleteCollection, {
        onSuccess: () => {
            queryClient.invalidateQueries(['qdrantCollections']);
            setSelectedCollection(null);
            setShowConnectionInfo(false);
        },
        onError: (error) => {
            alert('Failed to delete collection: ' + (error.response?.data?.msg || 'Server error'));
        }
    });

    const handleCreate = (e) => {
        e.preventDefault();
        if (!newCollection.name) return;
        createMutation.mutate(newCollection);
    };

    const handleDelete = (collectionId) => {
        if (window.confirm('Are you sure you want to delete this collection? This action is permanent.')) {
            deleteMutation.mutate(collectionId);
        }
    };

    const handleGetConnectionInfo = async (collection) => {
        try {
            const info = await getConnectionInfo(collection._id);
            setConnectionInfo(info);
            setSelectedCollection(collection);
            setShowConnectionInfo(true);
        } catch (error) {
            alert('Failed to get connection info: ' + (error.response?.data?.msg || 'Server error'));
        }
    };

    const handleTestConnection = async (collectionId) => {
        try {
            const result = await testConnection(collectionId);
            setTestResult(result);
        } catch (error) {
            setTestResult({
                success: false,
                message: 'Test failed: ' + (error.response?.data?.msg || 'Server error')
            });
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link to="/dashboard" className="text-xl font-bold">My Dashboard</Link>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="py-10">
                <header>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h1 className="text-3xl font-bold leading-tight text-gray-900">Qdrant Collections</h1>
                    </div>
                </header>

                <main>
                    <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                        <div className="px-4 py-8 sm:px-0">
                            {/* Create Collection Form */}
                            <div className="bg-white shadow sm:rounded-lg mb-8">
                                <form onSubmit={handleCreate} className="px-4 py-5 sm:p-6">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900">Create New Collection</h3>
                                    <div className="mt-4 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                                        <div className="sm:col-span-3">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Collection Name
                                            </label>
                                            <input
                                                type="text"
                                                value={newCollection.name}
                                                onChange={(e) => setNewCollection({...newCollection, name: e.target.value})}
                                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                placeholder="my-collection"
                                            />
                                        </div>
                                        <div className="sm:col-span-3">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Description
                                            </label>
                                            <input
                                                type="text"
                                                value={newCollection.description}
                                                onChange={(e) => setNewCollection({...newCollection, description: e.target.value})}
                                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                placeholder="Collection description"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Vector Size
                                            </label>
                                            <input
                                                type="number"
                                                value={newCollection.vectorSize}
                                                onChange={(e) => setNewCollection({...newCollection, vectorSize: parseInt(e.target.value)})}
                                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                min="1"
                                                max="65536"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Distance Metric
                                            </label>
                                            <select
                                                value={newCollection.distance}
                                                onChange={(e) => setNewCollection({...newCollection, distance: e.target.value})}
                                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            >
                                                <option value="Cosine">Cosine</option>
                                                <option value="Euclidean">Euclidean</option>
                                                <option value="Dot">Dot Product</option>
                                            </select>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <button
                                                type="submit"
                                                disabled={createMutation.isLoading}
                                                className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                            >
                                                {createMutation.isLoading ? 'Creating...' : 'Create Collection'}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>

                            {/* Collections List */}
                            <div className="bg-white shadow sm:rounded-lg">
                                <div className="px-4 py-5 sm:p-6">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900">Your Collections</h3>
                                    <div className="mt-4">
                                        {isLoading ? (
                                            <p>Loading collections...</p>
                                        ) : collections && collections.length > 0 ? (
                                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                                {collections.map(col => (
                                                    <div key={col._id} className="bg-gray-50 rounded-lg p-4">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-lg font-medium text-gray-900">{col.name}</h4>
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                Active
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 text-sm text-gray-500">{col.config?.description || 'No description'}</p>
                                                        <div className="mt-2 text-xs text-gray-400">
                                                            <p>Vector Size: {col.config?.vectorSize || 1536}</p>
                                                            <p>Distance: {col.config?.distance || 'Cosine'}</p>
                                                            <p>Vectors: {col.usage?.vectorCount || 0}</p>
                                                        </div>
                                                        <div className="mt-4 flex space-x-3">
                                                            <button
                                                                onClick={() => handleGetConnectionInfo(col)}
                                                                className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                                                            >
                                                                Connect
                                                            </button>
                                                            <button
                                                                onClick={() => handleTestConnection(col._id)}
                                                                className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                                                            >
                                                                Test
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(col._id)}
                                                                disabled={deleteMutation.isLoading}
                                                                className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                        {testResult && testResult.timestamp && (
                                                            <div className={`mt-2 p-2 rounded text-xs ${testResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                                {testResult.message}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500">You have no Qdrant collections.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Connection Info Modal */}
                            {showConnectionInfo && connectionInfo && (
                                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
                                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                                        <div className="px-6 py-4 border-b border-gray-200">
                                            <h3 className="text-lg font-medium text-gray-900">
                                                Connection Information: {selectedCollection?.name}
                                            </h3>
                                        </div>
                                        <div className="px-6 py-4">
                                            <div className="mb-6">
                                                <h4 className="text-md font-medium text-gray-900 mb-2">Connection Details</h4>
                                                <div className="bg-gray-50 rounded-lg p-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700">URL</label>
                                                            <div className="mt-1 flex">
                                                                <code className="block w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-sm">
                                                                    {connectionInfo.connectionInfo?.url}
                                                                </code>
                                                                <button
                                                                    onClick={() => copyToClipboard(connectionInfo.connectionInfo?.url)}
                                                                    className="ml-2 text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
                                                                >
                                                                    Copy
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700">API Key</label>
                                                            <div className="mt-1 flex">
                                                                <code className="block w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-sm">
                                                                    {connectionInfo.connectionInfo?.apiKey}
                                                                </code>
                                                                <button
                                                                    onClick={() => copyToClipboard(connectionInfo.connectionInfo?.apiKey)}
                                                                    className="ml-2 text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
                                                                >
                                                                    Copy
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Code Examples */}
                                            <div className="space-y-6">
                                                <div>
                                                    <h4 className="text-md font-medium text-gray-900 mb-2">Node.js Example</h4>
                                                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                                                        <code>{connectionInfo.examples?.nodeJs?.code}</code>
                                                    </pre>
                                                </div>

                                                <div>
                                                    <h4 className="text-md font-medium text-gray-900 mb-2">Python Example</h4>
                                                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                                                        <code>{connectionInfo.examples?.python?.code}</code>
                                                    </pre>
                                                </div>

                                                <div>
                                                    <h4 className="text-md font-medium text-gray-900 mb-2">cURL Example</h4>
                                                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                                                        <code>{connectionInfo.examples?.curl?.code}</code>
                                                    </pre>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                                            <button
                                                onClick={() => setShowConnectionInfo(false)}
                                                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                                            >
                                                Close
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
