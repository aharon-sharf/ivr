import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthInitializer } from './components/auth/AuthInitializer';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { SignUpPage } from './pages/auth/SignUpPage';
import { ConfirmSignUpPage } from './pages/auth/ConfirmSignUpPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { UnauthorizedPage } from './pages/auth/UnauthorizedPage';
import { DashboardPage } from './pages/DashboardPage';
import { CampaignListPage } from './pages/CampaignListPage';
import { CampaignCreatePage } from './pages/CampaignCreatePage';
import { CampaignDetailPage } from './pages/CampaignDetailPage';
import { CampaignEditPage } from './pages/CampaignEditPage';
import { ContactUploadPage } from './pages/ContactUploadPage';
import { IVRFlowBuilderDemo } from './pages/IVRFlowBuilderDemo';
import { RealTimeDashboardPage } from './pages/RealTimeDashboardPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { CampaignComparisonPage } from './pages/CampaignComparisonPage';
import { BlacklistManagementPage } from './pages/BlacklistManagementPage';

function App() {
  return (
    <Router>
      <AuthInitializer>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/confirm-signup" element={<ConfirmSignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns"
          element={
            <ProtectedRoute>
              <CampaignListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/create"
          element={
            <ProtectedRoute>
              <CampaignCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/:id"
          element={
            <ProtectedRoute>
              <CampaignDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/:id/edit"
          element={
            <ProtectedRoute>
              <CampaignEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/:campaignId/contacts/upload"
          element={
            <ProtectedRoute>
              <ContactUploadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics/realtime"
          element={
            <ProtectedRoute>
              <RealTimeDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics/comparison"
          element={
            <ProtectedRoute>
              <CampaignComparisonPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/blacklist"
          element={
            <ProtectedRoute>
              <BlacklistManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Demo/Testing routes */}
        <Route path="/demo/ivr-flow-builder" element={<IVRFlowBuilderDemo />} />
        <Route path="/demo/campaign-create" element={<CampaignCreatePage />} />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/campaigns" replace />} />
        <Route path="*" element={<Navigate to="/campaigns" replace />} />
      </Routes>
      </AuthInitializer>
    </Router>
  );
}

export default App;
