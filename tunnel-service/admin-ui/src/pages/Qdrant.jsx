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

const createCollection = async (name) => {
    const token = localStorage.getItem('token');
    const { data } = await axios.post('/api/qdrant/collections', { name }, {
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

export default function Qdrant() {
    const queryClient = useQueryClient();
    const [newCollectionName, setNewCollectionName] = useState('');
    const { data: collections, isLoading } = useQuery(['qdrantCollections'], fetchCollections);

    const createMutation = useMutation(createCollection, {
        onSuccess: () => {
            queryClient.invalidateQueries(['qdrantCollections']);
            setNewCollectionName('');
            alert('Collection created successfully.');
        },
        onError: (error) => {
            alert('Failed to create collection: ' + (error.response?.data?.msg || 'Server error'));
        }
    });

    const deleteMutation = useMutation(deleteCollection, {
        onSuccess: () => {
            queryClient.invalidateQueries(['qdrantCollections']);
        },
        onError: (error) => {
            alert('Failed to delete collection: ' + (error.response?.data?.msg || 'Server error'));
        }
    });

    const handleCreate = (e) => {
        e.preventDefault();
        if (!newCollectionName) return;
        createMutation.mutate(newCollectionName);
    };

    const handleDelete = (collectionId) => {
        if (window.confirm('Are you sure you want to delete this collection? This action is permanent.')) {
            deleteMutation.mutate(collectionId);
        }
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
                            <div className="bg-white shadow sm:rounded-lg mb-8">
                                <form onSubmit={handleCreate} className="px-4 py-5 sm:p-6">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900">Create New Collection</h3>
                                    <div className="mt-4 sm:flex sm:items-center">
                                        <div className="w-full sm:max-w-xs">
                                            <label htmlFor="collection-name" className="sr-only">Collection name</label>
                                            <input
                                                type="text"
                                                name="collection-name"
                                                id="collection-name"
                                                value={newCollectionName}
                                                onChange={(e) => setNewCollectionName(e.target.value)}
                                                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                                placeholder="my-new-collection"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={createMutation.isLoading}
                                            className="mt-3 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                                        >
                                            {createMutation.isLoading ? 'Creating...' : 'Create'}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <div className="bg-white shadow sm:rounded-lg">
                                <div className="px-4 py-5 sm:p-6">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900">Your Collections</h3>
                                    <div className="mt-4">
                                        {isLoading ? (
                                            <p>Loading collections...</p>
                                        ) : collections && collections.length > 0 ? (
                                            <ul className="divide-y divide-gray-200">
                                                {collections.map(col => (
                                                    <li key={col._id} className="py-4 flex items-center justify-between">
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">{col.name}</p>
                                                            <p className="text-sm text-gray-500">Host: {col.credentials.host}:{col.credentials.port}</p>
                                                            <p className="text-xs text-gray-400">Internal Name: {col.collectionName}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDelete(col._id)}
                                                            disabled={deleteMutation.isLoading}
                                                            className="text-red-600 hover:text-red-900 text-sm font-medium disabled:opacity-50"
                                                        >
                                                            Delete
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-gray-500">You have no Qdrant collections.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
