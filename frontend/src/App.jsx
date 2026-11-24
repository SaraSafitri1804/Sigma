import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import SignDocument from './pages/SignDocument';
import Profile from './pages/Profile';
import Verify from './pages/Verify';

function Splash() {
  return <div className="min-h-screen flex items-center justify-center font-body text-body-md text-light-on-surface-variant" role="status">Memuat…</div>;
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  return user ? children : <Navigate to="/login" replace />;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/verify/:token" element={<Verify />} />
      <Route path="/login" element={<GuestOnly><AuthPage initialMode="login" /></GuestOnly>} />
      <Route path="/daftar" element={<GuestOnly><AuthPage initialMode="register" /></GuestOnly>} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="dokumen" element={<Documents />} />
        <Route path="tanda-tangani" element={<SignDocument />} />
        <Route path="profil" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
