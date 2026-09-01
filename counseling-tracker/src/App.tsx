import { Route, Routes } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import RecordInput from './pages/RecordInput';
import SearchView from './pages/SearchView';
import Statistics from './pages/Statistics';
import ReportExport from './pages/ReportExport';
import Settings from './pages/Settings';

export default function App() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/input" element={<RecordInput />} />
          <Route path="/search" element={<SearchView />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/report" element={<ReportExport />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
