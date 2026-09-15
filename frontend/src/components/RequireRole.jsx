import { CircularProgress } from '@mui/material';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { homeForRole } from '../utils/roles.js';

/** Route guard: requires login + one of `allow` roles, else bounces to the role home. */
export default function RequireRole({ allow, children }) {
  const { user, loading } = useAuth();
  if (loading) return <CircularProgress />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />;
  return children;
}
