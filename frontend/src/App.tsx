import { RenewalPlannerPage } from './pages/RenewalPlannerPage';
import React, { useState } from 'react';
import { PolicyPage } from './pages/PolicyPage';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BackgroundTaskProvider } from './context/BackgroundTaskContext';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { OverviewPage } from './pages/OverviewPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { AskPage } from './pages/AskPage';
import { ComparePage } from './pages/ComparePage';
import { SearchLabPage } from './pages/SearchLabPage';
import { FindingsPage } from './pages/FindingsPage';
import { KnowledgeGraphPage } from './pages/KnowledgeGraphPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { NegotiatePage } from './pages/NegotiatePage';
import { CompliancePage } from './pages/CompliancePage';
import { ObligationsPage } from './pages/ObligationsPage';
import { CritiquePage } from './pages/CritiquePage';
import { ClauseLibraryPage } from './pages/ClauseLibraryPage';
import { BriefsPage } from './pages/BriefsPage';
import { PolicyCheckerPage } from './pages/PolicyCheckerPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30,
    },
  },
});

export const RootIndexRoute: React.FC = () => {
  const [shouldRedirect] = useState(() => {
    try {
      return !sessionStorage.getItem('clario_workspace_entered');
    } catch {
      return false;
    }
  });

  if (shouldRedirect) {
    return <Navigate to="/home" replace />;
  }

  return <OverviewPage />;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BackgroundTaskProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Website Routes (Styled like /home) */}
            <Route path="/home" element={<HomePage />} />
            <Route path="/terms" element={<PolicyPage policy="terms" />} />
            <Route path="/privacy" element={<PolicyPage policy="privacy" />} />
            <Route path="/cookies" element={<PolicyPage policy="cookies" />} />

            {/* Workspace Routes */}
            <Route path="/" element={<Layout />}>
              <Route index element={<RootIndexRoute />} />
              <Route path="renewal-planner" element={<RenewalPlannerPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="docs" element={<Navigate to="/documents" replace />} />
              <Route path="ask" element={<AskPage />} />
              <Route path="compare" element={<ComparePage />} />
              <Route path="graph" element={<KnowledgeGraphPage />} />
              <Route path="search-lab" element={<SearchLabPage />} />
              <Route path="findings" element={<FindingsPage />} />
              <Route path="negotiate" element={<NegotiatePage />} />
              <Route path="compliance" element={<CompliancePage />} />
              <Route path="policy-checker" element={<PolicyCheckerPage />} />
              <Route path="policy-audit" element={<Navigate to="/policy-checker" replace />} />
              <Route path="obligations" element={<ObligationsPage />} />
              <Route path="critique" element={<CritiquePage />} />
              <Route path="clauses" element={<ClauseLibraryPage />} />
              <Route path="briefs" element={<BriefsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </BackgroundTaskProvider>
    </QueryClientProvider>
  );
};

export default App;
