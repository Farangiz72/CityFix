import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import type { Role } from './api/types';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { AdminPage } from './pages/admin/AdminPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import { AdminDirectoriesPage } from './pages/admin/AdminDirectoriesPage';
import { AdminRequestsPage } from './pages/admin/AdminRequestsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { ExecutorTasksPage } from './pages/executor/ExecutorTasksPage';
import { LandingPage } from './pages/landing/LandingPage';
import { OperatorQueuePage } from './pages/operator/OperatorQueuePage';
import { MyRequestsPage } from './pages/resident/MyRequestsPage';
import { NewRequestPage } from './pages/resident/NewRequestPage';
import { RequestDetailsPage } from './pages/shared/RequestDetailsPage';

function Protected({ roles, children }: { roles?: Role[]; children: ReactElement }) {
  return (
    <ProtectedRoute roles={roles}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* BL-T4: главная открыта всем — гостю показывает лендинг, вошедшему кнопку «в кабинет» */}
      <Route path="/" element={<LandingPage />} />

      <Route
        path="/my"
        element={
          <Protected roles={['RESIDENT']}>
            <MyRequestsPage />
          </Protected>
        }
      />
      <Route
        path="/my/new"
        element={
          <Protected roles={['RESIDENT']}>
            <NewRequestPage />
          </Protected>
        }
      />
      <Route
        path="/queue"
        element={
          <Protected roles={['OPERATOR']}>
            <OperatorQueuePage />
          </Protected>
        }
      />
      <Route
        path="/tasks"
        element={
          <Protected roles={['EXECUTOR']}>
            <ExecutorTasksPage />
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={
          <Protected roles={['ADMIN']}>
            <AdminPage />
          </Protected>
        }
      />
      <Route
        path="/admin/requests"
        element={
          <Protected roles={['ADMIN']}>
            <AdminRequestsPage />
          </Protected>
        }
      />
      <Route
        path="/admin/users"
        element={
          <Protected roles={['ADMIN']}>
            <AdminUsersPage />
          </Protected>
        }
      />
      <Route
        path="/admin/directories"
        element={
          <Protected roles={['ADMIN']}>
            <AdminDirectoriesPage />
          </Protected>
        }
      />
      <Route
        path="/admin/audit"
        element={
          <Protected roles={['ADMIN']}>
            <AdminAuditPage />
          </Protected>
        }
      />

      <Route
        path="/requests/:id"
        element={
          <Protected>
            <RequestDetailsPage />
          </Protected>
        }
      />

      <Route
        path="*"
        element={
          <Protected>
            <section className="page">
              <h1>Страница не найдена</h1>
              <p className="page__subtitle">Проверьте адрес — такой страницы в CityFix нет.</p>
            </section>
          </Protected>
        }
      />
    </Routes>
  );
}
