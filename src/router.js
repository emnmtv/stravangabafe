import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './LandingPage';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import Home from './components/Home';
import ProfilePage from './components/ProfilePage';
import ActivitiesPage from './components/ActivitiesPage';
import MyRoutesPage from './components/MyRoutesPage';
import UserDashboard from './components/UserDashboard';
import AdminRoutesPage from './components/admin/AdminRoutesPage';
import AdminLoginPage from './adminLognPage';
import AdminChallenges from './components/admin/AdminChallenges';
import ArchivedActivities from './components/ArchivedActivities';
// Redirect authenticated users away from login/register pages
const RedirectIfLoggedIn = ({ children }) => {
  const isLoggedIn = !!localStorage.getItem('token');
  
  if (isLoggedIn) {
    return <Navigate to="/home" />;
  }
  
  return children;
};

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const isLoggedIn = !!localStorage.getItem('token');
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;
  const location = useLocation();
  
  // Not logged in, redirect to login
  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} />;
  }
  
  // If role is required, check if user has that role
  if (requiredRole && (!user || user.role !== requiredRole)) {
    return <Navigate to="/home" />;
  }
  
  return children;
};

const AppRouter = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={
        <RedirectIfLoggedIn>
          <LoginPage />
        </RedirectIfLoggedIn>
      } />
      <Route path="/register" element={
        <RedirectIfLoggedIn>
          <RegisterPage />
        </RedirectIfLoggedIn>
      } />
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* Protected routes */}
      <Route path="/home" element={
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      } />
      <Route path="/routes" element={
        <ProtectedRoute>
          <MyRoutesPage />
        </ProtectedRoute>
      } />
      <Route path="/activities" element={
        <ProtectedRoute>
          <ActivitiesPage />
        </ProtectedRoute>
      } />
      <Route path="/archived-activities" element={
        <ProtectedRoute>
          <ArchivedActivities />
        </ProtectedRoute>
      } />
      <Route path="/user-dashboard" element={
        <ProtectedRoute>
          <UserDashboard />
        </ProtectedRoute>
      } />
     
      <Route path="/profile" element={
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      } />
      
      {/* Admin routes */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="ADMIN">
          <Home />
        </ProtectedRoute>
      } />
      <Route path="/admin/routes" element={
        <ProtectedRoute requiredRole="ADMIN">
          <AdminRoutesPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/challenges" element={
        <ProtectedRoute requiredRole="ADMIN">
          <AdminChallenges />
        </ProtectedRoute>
      } />

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default AppRouter;
