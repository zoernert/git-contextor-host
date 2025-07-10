import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import Subscription from './pages/Subscription';
import PrivateRoute from './components/PrivateRoute';
import UserEdit from './pages/UserEdit';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* User Routes */}
      <Route path="/dashboard" element={<PrivateRoute><UserDashboard /></PrivateRoute>} />
      <Route path="/subscription" element={<PrivateRoute><Subscription /></PrivateRoute>} />

      {/* Admin Routes */}
      <Route path="/admin" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="users/:id/edit" element={<UserEdit />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>

      {/* Redirect root to user dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

    </Routes>
  );
}

export default App;
