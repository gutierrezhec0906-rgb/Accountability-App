import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PendingApproval from '../pages/PendingApproval';

export default function PrivateRoute({ children }) {
  const { currentUser, userProfile } = useAuth();
  if (!currentUser) return <Navigate to="/login" />;
  if (userProfile && userProfile.status === 'pending') return <PendingApproval />;
  if (userProfile && userProfile.status === 'rejected') return <Navigate to="/login" />;
  return children;
}
