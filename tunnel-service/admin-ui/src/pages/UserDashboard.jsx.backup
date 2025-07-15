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
    enabled: !!user,
  });

  const { data: collections, isLoading: isLoadingCollections } = useQuery(['collections'], fetchCollections, {
    enabled: !!user,
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

  const configurationExample = '"tunneling": {\n    "provider": "managed",\n    "managed": {\n        "apiUrl": "' + window.location.origin + '",\n        "apiKey": "' + (user?.apiKey || '') + '"\n    }\n}';

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
            <h3 className="text-lg leading-6 font-medium text-gray-900">Git Contextor Integration</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>Configure your Git Contextor client to use this service for managed tunnels.</p>
            </div>
            <div className="mt-5">
              <p className="text-sm font-medium text-gray-700">Add the following to your Git Contextor configuration file:</p>
              <pre className="mt-2 p-3 bg-gray-100 rounded-md text-sm overflow-x-auto">
                <code>{configurationExample}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
