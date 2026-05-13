import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import NotMigrated from './pages/NotMigrated';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotMigrated />} />
    </Routes>
  );
}
