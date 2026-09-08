import { useEffect, useRef, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import LockScreen from './components/LockScreen';
import Dashboard from './pages/Dashboard';
import RecordInput from './pages/RecordInput';
import SearchView from './pages/SearchView';
import RecordDetail from './pages/RecordDetail';
import StudentsView from './pages/StudentsView';
import StudentDetail from './pages/StudentDetail';
import Statistics from './pages/Statistics';
import RelationGraphView from './pages/RelationGraphView';
import ReportExport from './pages/ReportExport';
import Settings from './pages/Settings';

const LOCK_TIMEOUT_KEY = 'lock_timeout_minutes';

export default function App() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  // DB 자체가 비밀번호로 잠겨 있는지(기록 암호화 모드). 이 경우 잠금 화면은
  // DB를 여는 '진입 비밀번호' 화면이 된다.
  const [dbLocked, setDbLocked] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockMinutes, setLockMinutes] = useState<number>(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    window.api.bootState().then((boot) => {
      if (boot.encryptionEnabled && !boot.dbOpen) {
        // 기록 암호화 모드: DB를 열기 전까지 잠금 화면
        setDbLocked(true);
        setHasPassword(true);
        setLocked(true);
        return;
      }
      setHasPassword(boot.hasPassword);
      setLocked(boot.hasPassword);
      if (boot.hasPassword) {
        window.api.getSetting(LOCK_TIMEOUT_KEY).then((v) => setLockMinutes(v ? Number(v) || 0 : 0));
      }
    });
  }, []);

  // 자동 잠금: 비밀번호가 설정되어 있고 잠금 시간이 0이 아니면,
  // 마지막 조작(키·마우스) 후 lockMinutes가 지나면 잠금 화면으로 돌아간다.
  useEffect(() => {
    if (!hasPassword || locked || lockMinutes <= 0) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }
    function reset() {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setLocked(true), lockMinutes * 60 * 1000);
    }
    const events: (keyof WindowEventMap)[] = ['keydown', 'mousedown', 'mousemove', 'wheel'];
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, reset));
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [hasPassword, locked, lockMinutes]);

  // 설정 화면에서 잠금 시간을 바꾸면 반영
  function reloadLockTimeout() {
    window.api.getSetting(LOCK_TIMEOUT_KEY).then((v) => setLockMinutes(v ? Number(v) || 0 : 0));
  }

  if (hasPassword === null) {
    return <div style={{ height: '100vh', background: 'var(--bg)' }} />;
  }

  if (locked) {
    return (
      <LockScreen
        dbLock={dbLocked}
        onUnlock={() => {
          setLocked(false);
          setDbLocked(false);
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar onLockNow={hasPassword ? () => setLocked(true) : undefined} />
      <div className="main-area">
        <div className="top-banner">
          <span className="top-banner-title">학생 상담·생활지도 기록</span>
          <span className="top-banner-sub">모든 기록은 이 PC에만 암호화 저장됩니다 · 외부 전송 없음</span>
        </div>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/input" element={<RecordInput />} />
            <Route path="/search" element={<SearchView />} />
            <Route path="/search/:id" element={<RecordDetail />} />
            <Route path="/students" element={<StudentsView />} />
            <Route path="/students/:id" element={<StudentDetail />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/relations" element={<RelationGraphView />} />
            <Route path="/report" element={<ReportExport />} />
            <Route path="/settings" element={<Settings onSettingsChanged={reloadLockTimeout} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
