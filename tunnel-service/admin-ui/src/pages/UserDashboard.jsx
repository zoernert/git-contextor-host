import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

const fetchUser = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

const fetchTunnels = async () => {
  const response = await api.get('/tunnels');
  return response.data;
};

const fetchCollections = async () => {
  const response = await api.get('/qdrant/collections');
  return response.data;
};

export default function UserDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState(false);

  const { data: user, isLoading: isLoadingUser, isError: isErrorUser } = useQuery(['currentUser'], fetchUser, {
    retry: (failureCount, error) => {
        if (error.response?.status === 401) return false;
        return failureCount < 2;
    }
  });

  const { data: tunnels, isLoading: isLoadingTunnels } = useQuery(['tunnels'], fetchTunnels, {
    enabled: !!user, // only fetch tunnels if user is loaded
  });

  const { data: collections, isLoading: isLoadingCollections } = useQuery(['collections'], fetchCollections, {
    enabled: !!user, // only fetch collections if user is loaded
  });

  const destroyTunnelMutation = useMutation({
    mutationFn: (tunnelId) => api.delete(`/tunnels/${tunnelId}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['tunnels']);
    },
    onError: (error) => {
      alert('Failed to destroy tunnel: ' + (error.response?.data?.msg || 'Server error'));
    }
  });

  const handleDestroyTunnel = (tunnelId) => {
    if (window.confirm('Are you sure you want to destroy this tunnel?')) {
        destroyTunnelMutation.mutate(tunnelId);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    queryClient.clear();
    navigate('/login');
  };

  const copyToClipboard = () => {
    if (user?.apiKey) {
      navigator.clipboard.writeText(user.apiKey);
      alert('API Key copied to clipboard!');
    }
  };

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isErrorUser) {
    localStorage.removeItem('token');
    navigate('/login');
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
      <div className="px-4 sm:px-0">
        <header className="mb-8">
          <h1 className="text-3xl font-bold leading-tight text-gray-900">Welcome, {user.email}</h1>
        </header>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <div className="bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Your API Key</h3>
                            <div className="mt-2 max-w-xl text-sm text-gray-500">
                            <p>Use this key to authenticate with the tunneling service from your tools like Git Contextor.</p>
                            </div>
                            <div className="mt-5">
                                <div className="flex rounded-md shadow-sm">
                                    <input 
                                    type={showKey ? 'text' : 'password'}
                                    readOnly
                                    value={user.apiKey}
                                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 bg-gray-50" 
                                    />
                                    <button
                                    onClick={() => setShowKey(!showKey)}
                                    type="button"
                                    className="inline-flex items-center px-3 rounded-none border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm"
                                    >
                                    {showKey ? 'Hide' : 'Show'}
                                    </button>
                                    <button
                                    onClick={copyToClipboard}
                                    type="button"
                                    className="-ml-px relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                    <span>Copy</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>

                    <div className="lg:col-span-1">
                        <div className="bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Subscription</h3>
                            <div className="mt-2 max-w-xl text-sm text-gray-500">
                            <p>You are currently on the <span className="font-semibold capitalize">{user.plan}</span> plan.</p>
                            </div>
                            <div className="mt-5">
                            <Link
                                to="/subscription"
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Manage Subscription
                            </Link>
                            </div>
                        </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 bg-white shadow sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Data Usage</h3>
                        <div className="mt-2 max-w-xl text-sm text-gray-500">
                           <p>
                             You have used { (user.usage.dataTransferred / (1024*1024*1024)).toFixed(4) } GB of data this cycle.
                           </p>
                        </div>
                        <div className="mt-3">
                           <p className="text-xs text-gray-400">
                             Usage resets monthly on { new Date(user.usage.resetDate).toLocaleDateString() }.
                           </p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 bg-white shadow sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Qdrant Collections</h3>
                            <Link
                                to="/qdrant"
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Manage Collections
                            </Link>
                        </div>
                        <div className="mt-4">
                            {isLoadingCollections ? (
                                <p>Loading collections...</p>
                            ) : collections && collections.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {collections.map(collection => (
                                        <div key={collection._id} className="border border-gray-200 rounded-lg p-4">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-medium text-gray-900">{collection.name}</h4>
                                                    <p className="text-xs text-gray-500 mt-1">{collection.config.description || 'No description'}</p>
                                                </div>
                                                <div className="flex items-center">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        Active
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                                                <div>
                                                    <span className="text-gray-500">Vectors:</span>
                                                    <span className="ml-1 font-medium">{collection.usage.vectorCount}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Size:</span>
                                                    <span className="ml-1 font-medium">{collection.config.vectorSize}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Distance:</span>
                                                    <span className="ml-1 font-medium">{collection.config.distance}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Last Used:</span>
                                                    <span className="ml-1 font-medium">
                                                        {new Date(collection.usage.lastAccessed).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex items-center">
                                                <svg className="h-4 w-4 text-gray-400 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                </svg>
                                                <code className="text-xs text-gray-600 break-all">
                                                    {collection.tunnelInfo?.url || 'No tunnel URL'}
                                                </code>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    <p className="mt-2 text-sm text-gray-500">No collections yet</p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Create your first Qdrant collection to start storing vectors for Git Contextor
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8 bg-white shadow sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Active Tunnels</h3>
                        <div className="mt-4">
                            {isLoadingTunnels ? (
                                <p>Loading tunnels...</p>
                            ) : tunnels && tunnels.length > 0 ? (
                                <ul className="divide-y divide-gray-200">
                                    {tunnels.map(tunnel => (
                                        <li key={tunnel._id} className="py-4 flex justify-between items-center">
                                            <div>
                                                <p className="text-sm font-medium text-indigo-600">{tunnel.url}</p>
                                                <p className="text-sm text-gray-500">Forwarding to localhost:{tunnel.localPort}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleDestroyTunnel(tunnel._id)}
                                                disabled={destroyTunnelMutation.isLoading}
                                                className="text-red-600 hover:text-red-900 text-sm font-medium disabled:opacity-50"
                                            >
                                                Destroy
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-500">You have no active tunnels. Create one from your client.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8 bg-white shadow sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Git Contextor Integration</h3>
                        <div className="mt-2 max-w-xl text-sm text-gray-500">
                            <p>Configure your Git Contextor client to use this service for managed tunnels.</p>
                        </div>
                        <div className="mt-5">
                            <p className="text-sm font-medium text-gray-700">Add the following to your Git Contextor configuration file:</p>
                            <pre className="mt-2 p-3 bg-gray-100 rounded-md text-sm overflow-x-auto">
                                <code>
{`"tunneling": {
    "provider": "managed",
    "managed": {
        "apiUrl": "${window.location.origin}",
        "apiKey": "${user.apiKey}"
    }
}`}
                                </code>
                            </pre>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
}
