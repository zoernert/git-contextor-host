import { NavLink } from 'react-router-dom';
import {
  ChartBarIcon,
  UsersIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Users', href: '/users', icon: UsersIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
];

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function Sidebar() {
  return (
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
      <div className="flex-1 flex flex-col min-h-0 bg-gray-800">
        <div className="flex items-center h-16 flex-shrink-0 px-4 bg-gray-900">
          <h1 className="text-white text-2xl font-semibold">Tunnel Service</h1>
        </div>
        <div className="flex-1 flex flex-col overflow-y-auto">
          <nav className="flex-1 px-2 py-4 space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.href === '/'}
                className={({ isActive }) =>
                  classNames(
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                    'group flex items-center px-2 py-2 text-sm font-medium rounded-md'
                  )
                }
              >
                <item.icon
                  className='mr-3 flex-shrink-0 h-6 w-6 text-gray-400 group-hover:text-gray-300'
                  aria-hidden="true"
                />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
