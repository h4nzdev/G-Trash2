import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:4000';
const TOKEN_KEY = 'gtrash_token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [official, setOfficial] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.get(`${API}/api/auth/me`)
        .then(({ data }) => setOfficial(data.official))
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          delete axios.defaults.headers.common['Authorization'];
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const { data } = await axios.post(`${API}/api/auth/login`, { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setOfficial(data.official);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    delete axios.defaults.headers.common['Authorization'];
    setOfficial(null);
  };

  return (
    <AuthContext.Provider value={{ official, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
