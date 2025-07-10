import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { CheckIcon } from '@heroicons/react/24/outline';

const fetchPlans = async () => {
    const token = localStorage.getItem('token');
    const { data } = await axios.get('/api/subscriptions/plans', {
        headers: { 'x-auth-token': token },
    });
    return data;
};

const fetchCurrentUser = async () => {
    const token = localStorage.getItem('token');
    const { data } = await axios.get('/api/auth/me', {
        headers: { 'x-auth-token': token },
    });
    return data;
};

const changePlan = async (planId) => {
    const token = localStorage.getItem('token');
    const { data } = await axios.post('/api/subscriptions/change', { planId }, {
        headers: { 'x-auth-token': token },
    });
    return data;
};

export default function Subscription() {
    const queryClient = useQueryClient();
    const { data: plans, isLoading: isLoadingPlans } = useQuery(['plans'], fetchPlans);
    const { data: user, isLoading: isLoadingUser } = useQuery(['currentUser'], fetchCurrentUser);

    const mutation = useMutation(changePlan, {
        onSuccess: () => {
            queryClient.invalidateQueries(['currentUser']);
            alert('Plan changed successfully!');
        },
        onError: (error) => {
            alert('Failed to change plan: ' + (error.response?.data?.msg || 'Server error'));
        }
    });

    const handleChoosePlan = (planId) => {
        // In a real app, this would redirect to a Stripe checkout page
        mutation.mutate(planId);
    };

    if (isLoadingPlans || isLoadingUser) {
        return <div className="p-8 text-center">Loading subscription options...</div>;
    }

    return (
        <div className="bg-gray-100 min-h-screen">
             <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link to="/dashboard" className="text-xl font-bold">My Dashboard</Link>
                        </div>
                    </div>
                </div>
            </nav>
            <div className="pt-12 sm:pt-16 lg:pt-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl lg:text-5xl">Subscription Plans</h2>
                        <p className="mt-4 text-xl text-gray-600">
                            Choose the plan that's right for you.
                        </p>
                    </div>
                </div>
            </div>
            <div className="mt-8 bg-white pb-16 sm:mt-12 sm:pb-20 lg:pb-28">
                <div className="relative">
                    <div className="absolute inset-0 h-1/2 bg-gray-100" />
                    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="max-w-lg mx-auto rounded-lg shadow-lg overflow-hidden lg:max-w-none lg:flex">
                            {plans?.map((plan, index) => (
                                <div key={plan.id} className={`flex-1 bg-white px-6 py-8 lg:p-12 ${index > 0 ? 'lg:border-l lg:border-gray-200' : ''}`}>
                                    <h3 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">{plan.name}</h3>
                                    <p className="mt-6 text-base text-gray-500">{plan.description || `The perfect plan for starting out.`}</p>
                                    <div className="mt-8">
                                        <div className="flex items-center">
                                            <h4 className="flex-shrink-0 pr-4 bg-white text-sm tracking-wider font-semibold uppercase text-indigo-600">
                                                What's included
                                            </h4>
                                            <div className="flex-1 border-t-2 border-gray-200" />
                                        </div>
                                        <ul role="list" className="mt-8 space-y-5 lg:space-y-4">
                                            {plan.features.map((feature) => (
                                                <li key={feature} className="flex items-start lg:col-span-1">
                                                    <div className="flex-shrink-0">
                                                        <CheckIcon className="h-5 w-5 text-green-400" aria-hidden="true" />
                                                    </div>
                                                    <p className="ml-3 text-sm text-gray-700">{feature}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="mt-8">
                                        <button
                                            onClick={() => handleChoosePlan(plan.id)}
                                            disabled={user?.plan === plan.id || mutation.isLoading}
                                            className={`w-full px-6 py-3 border border-transparent rounded-md shadow-sm text-center font-medium ${user?.plan === plan.id ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'}`}
                                        >
                                            {user?.plan === plan.id ? 'Current Plan' : `Choose ${plan.name}`}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
