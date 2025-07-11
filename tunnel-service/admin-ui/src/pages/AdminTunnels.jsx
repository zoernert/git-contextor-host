import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

const fetchTunnels = async () => {
  const token = localStorage.getItem('token');
  const { data } = await axios.get('/api/admin/tunnels', {
    headers: { 'x-auth-token': token },
  });
  return data;
};

export default function AdminTunnels() {
  const { data: tunnels, isLoading, isError } = useQuery(['adminTunnels'], fetchTunnels);

  if (isLoading) return <div>Loading tunnels...</div>;
  if (isError) return <div className="text-red-500">Error fetching tunnels. You may not have permission to view this page.</div>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">All Active Tunnels</h1>

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table className="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">URL</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">User</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Created At</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Expires At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tunnels.map((tunnel) => (
                  <tr key={tunnel._id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-indigo-600">
                      <a href={tunnel.url} target="_blank" rel="noopener noreferrer">{tunnel.url}</a>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {tunnel.userId ? (
                        <Link to={`/admin/users/${tunnel.userId._id}/edit`} className="text-indigo-600 hover:text-indigo-900">{tunnel.userId.email}</Link>
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{new Date(tunnel.createdAt).toLocaleString()}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{new Date(tunnel.expiresAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tunnels.length === 0 && (
                <div className="text-center py-8">
                    <p className="text-gray-500">No active tunnels found.</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
