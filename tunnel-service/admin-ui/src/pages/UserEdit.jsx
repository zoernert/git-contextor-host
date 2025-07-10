import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const fetchUser = async (id) => {
    const token = localStorage.getItem('token');
    const { data } = await axios.get(`/api/admin/users/${id}`, {
        headers: { 'x-auth-token': token },
    });
    return data;
};

const updateUser = async ({ id, userData }) => {
    const token = localStorage.getItem('token');
    const { data } = await axios.put(`/api/admin/users/${id}`, userData, {
        headers: { 'x-auth-token': token },
    });
    return data;
};

const plans = ['free', 'basic', 'pro', 'enterprise'];

export default function UserEdit() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: user, isLoading, isError } = useQuery(['user', id], () => fetchUser(id));

    const [plan, setPlan] = useState('');
    const [isActive, setIsActive] = useState(true);

    useEffect(() => {
        if (user) {
            setPlan(user.plan);
            setIsActive(user.isActive);
        }
    }, [user]);

    const mutation = useMutation(updateUser, {
        onSuccess: (data) => {
            queryClient.invalidateQueries(['users']); // Invalidate the users list
            queryClient.setQueryData(['user', id], data); // Update the cache for this user
            alert('User updated successfully!');
            navigate('/admin/users');
        },
        onError: (error) => {
            alert('Failed to update user: ' + (error.response?.data?.msg || 'Server error'));
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        mutation.mutate({ id, userData: { plan, isActive } });
    };

    if (isLoading) return <div>Loading user...</div>;
    if (isError) return <div className="text-red-500">Error loading user data.</div>;

    return (
        <div>
            <div className="mb-4">
                <Link to="/admin/users" className="text-indigo-600 hover:text-indigo-900">&larr; Back to Users</Link>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">Edit User: {user?.email}</h1>

            <form onSubmit={handleSubmit} className="mt-8 max-w-lg">
                <div className="space-y-6">
                    <div>
                        <label htmlFor="plan" className="block text-sm font-medium text-gray-700">
                            Subscription Plan
                        </label>
                        <select
                            id="plan"
                            name="plan"
                            value={plan}
                            onChange={(e) => setPlan(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        >
                            {plans.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
                        </select>
                    </div>

                    <div className="relative flex items-start">
                        <div className="flex items-center h-5">
                            <input
                                id="isActive"
                                name="isActive"
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                            />
                        </div>
                        <div className="ml-3 text-sm">
                            <label htmlFor="isActive" className="font-medium text-gray-700">
                                Active
                            </label>
                            <p className="text-gray-500">Inactive users cannot log in or use the service.</p>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={mutation.isLoading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {mutation.isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
