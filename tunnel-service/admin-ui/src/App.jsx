import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import UserLayout from './components/UserLayout';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import MetaSearch from './pages/MetaSearch';
import Subscription from './pages/Subscription';
import PrivateRoute from './components/PrivateRoute';
import UserEdit from './pages/UserEdit';
import AdminTunnels from './pages/AdminTunnels';
import Qdrant from './pages/Qdrant';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* User Routes */}
      <Route path="/" element={<PrivateRoute><UserLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<UserDashboard />} />
        <Route path="meta-search" element={<MetaSearch />} />
        <Route path="subscription" element={<Subscription />} />
        <Route path="qdrant" element={<Qdrant />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="users/:id/edit" element={<UserEdit />} />
        <Route path="tunnels" element={<AdminTunnels />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>
    </Routes>
  );
}

export default App;
