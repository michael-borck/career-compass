import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Settings from './pages/Settings';
import About from './pages/About';
import Pitch from './pages/Pitch';
import CoverLetter from './pages/CoverLetter';
import NotMigrated from './pages/NotMigrated';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/about" element={<About />} />
      <Route path="/pitch" element={<Pitch />} />
      <Route path="/cover-letter" element={<CoverLetter />} />
      <Route path="*" element={<NotMigrated />} />
    </Routes>
  );
}
