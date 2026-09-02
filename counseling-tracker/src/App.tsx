import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import LockScreen from './components/LockScreen';
import Dashboard from './pages/Dashboard';
import RecordInput from './pages/RecordInput';
import SearchView from './pages/SearchView';
import StudentsView from './pages/StudentsView';
import Statistics from './pages/Statistics';
import ReportExport from './pages/ReportExport';
import Settings from './pages/Settings';

export default function App() {
  const [locked, setLocked] = useState<boolean | null>(null);

  useEffect(() => {
    window.api.hasPassword().then(setLocked);
  }, []);

  if (locked === null) {
    return <div style={{ height: '100vh', background: 'var(--bg)' }} />;
  }

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/input" element={<RecordInput />} />
          <Route path="/search" element={<SearchView />} />
          <Route path="/students" element={<StudentsView />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/report" element={<ReportExport />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
