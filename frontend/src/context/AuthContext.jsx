import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth, getToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    auth.me().then(setUser).catch(() => auth.logout()).finally(() => setLoading(false));
  }, []);

  // Token kedaluwarsa / tidak valid -> keluar otomatis
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('sigma:unauthorized', onUnauthorized);
    return () => window.removeEventListener('sigma:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (email, password) => setUser(await auth.login(email, password)), []);
  const register = useCallback(async (formData) => setUser(await auth.register(formData)), []);
  const logout = useCallback(() => { auth.logout(); setUser(null); }, []);
  const refresh = useCallback(async () => setUser(await auth.me()), []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
