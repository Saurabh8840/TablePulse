import { useCallback, useEffect, useState } from 'react';
import { fetchMe, getToken, login as apiLogin, logout as apiLogout, registerOwner } from '../services/auth.js';
import { AuthContext } from './auth-context.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!getToken());

  useEffect(() => {
    if (!getToken()) return;
    let alive = true;
    fetchMe()
      .then((res) => {
        if (alive) setUser(res.data);
      })
      .catch(() => {
        if (alive) setUser(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (payload) => {
    const res = await apiLogin(payload);
    setUser(res.data.user);
    return res;
  }, []);

  const register = useCallback(async (payload) => {
    return registerOwner(payload);
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
