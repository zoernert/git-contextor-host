import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const fetchUser = async () => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No token found');
  const { data } = await axios.get('/api/auth/me', {
    headers: { 'x-auth-token': token },
  });
  return data;
};

export default function UserDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState(false);

  const { data: user, isLoading, isError } = useQuery(['currentUser'], fetchUser, {
    retry: (failureCount, error) => {
        if (error.response?.status === 401) return false;
        return failureCount < 2;
    }
  });

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

  if (isLoading) {
    return <div className="p-8 text-center">Loading dashboard...</div>;
  }

  if (isError) {
    // This will trigger a re-render, and on next render will redirect
    // because token is gone.
    localStorage.removeItem('token');
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold">My Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleLogout}
                className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <span className="sr-only">Log out</span>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="py-10">
        <header>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold leading-tight text-gray-900">Welcome, {user.email}</h1>
          </div>
        </header>
        <main>
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div className="px-4 py-8 sm:px-0 grid grid-cols-1 lg:grid-cols-3 gap-8">
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
          </div>
        </main>
      </div>
    </div>
  );
}
