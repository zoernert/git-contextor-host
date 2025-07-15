import React from 'react';
import { Outlet } from 'react-router-dom';
import UserNavigation from './UserNavigation';

export default function UserLayout() {
  return (
    <div className="min-h-screen bg-gray-100">
      <UserNavigation />
      <div className="py-10">
        <Outlet />
      </div>
    </div>
  );
}
