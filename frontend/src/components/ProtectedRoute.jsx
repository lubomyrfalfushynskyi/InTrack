import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '../store/authStore';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, fetchUser } = useAuthStore();
  const location = useLocation();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    // Токен є — перевіряємо сесію (короткий спіннер). Токена нема — одразу редирект на /login.
    if (token && !isAuthenticated) {
      setChecking(true);
      fetchUser().finally(() => setChecking(false));
    }
  }, [isAuthenticated, fetchUser]);

  if (checking) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="Перевірка авторизації..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
};

export default ProtectedRoute;
