import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { useStore } from './store';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user, fetchUser } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (token && !user) {
        await fetchUser();
      }
      setLoading(false);
    };
    init();
  }, [token, user, fetchUser]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-dark-900 text-primary-500">Loading...</div>;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/" 
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
