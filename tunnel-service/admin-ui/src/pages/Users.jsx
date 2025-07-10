import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

const fetchUsers = async () => {
  const token = localStorage.getItem('token');
  const { data } = await axios.get('/api/admin/users', {
    headers: { 'x-auth-token': token },
  });
  return data;
};

export default function Users() {
  const { data: users, isLoading, isError } = useQuery(['users'], fetchUsers);

  if (isLoading) return <div>Loading users...</div>;
  if (isError) return <div className="text-red-500">Error fetching users. You may not have permission to view this page.</div>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Users</h1>

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table className="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">Email</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Plan</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.email}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">{user.email}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{user.plan}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {user.isActive ? 
                        <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Active</span> :
                        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">Inactive</span>
                      }
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                      <a href="#" className="text-indigo-600 hover:text-indigo-900">Edit</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
                <div className="text-center py-8">
                    <p className="text-gray-500">No users found.</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
