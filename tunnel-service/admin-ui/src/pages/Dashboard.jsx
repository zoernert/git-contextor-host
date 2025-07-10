import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const fetchAnalytics = async () => {
  const token = localStorage.getItem('token');
  const { data } = await axios.get('/api/admin/analytics', {
    headers: { 'x-auth-token': token },
  });
  return data;
};

export default function Dashboard() {
  const { data: analytics, isLoading, isError } = useQuery(['analytics'], fetchAnalytics);

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div className="text-red-500">Error fetching analytics. You may not have permission to view this page.</div>;

  const chartData = {
    labels: ['Users', 'Active Subscriptions', 'Active Tunnels'],
    datasets: [
      {
        label: 'Platform Stats',
        data: [analytics.users, analytics.subscriptions.active, analytics.tunnels.active],
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
      },
    ],
  };

  return (
    <>
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      <div className="mt-8">
        <div className="max-w-lg">
           <Bar data={chartData} />
        </div>
      </div>
    </>
  );
}
