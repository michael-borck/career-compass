import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Settings from './pages/Settings';
import About from './pages/About';
import Pitch from './pages/Pitch';
import CoverLetter from './pages/CoverLetter';
import GapAnalysis from './pages/GapAnalysis';
import LearningPath from './pages/LearningPath';
import Values from './pages/Values';
import Board from './pages/Board';
import Industry from './pages/Industry';
import SkillsMapping from './pages/SkillsMapping';
import Compare from './pages/Compare';
import NotMigrated from './pages/NotMigrated';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/about" element={<About />} />
      <Route path="/pitch" element={<Pitch />} />
      <Route path="/cover-letter" element={<CoverLetter />} />
      <Route path="/gap-analysis" element={<GapAnalysis />} />
      <Route path="/learning-path" element={<LearningPath />} />
      <Route path="/values" element={<Values />} />
      <Route path="/board" element={<Board />} />
      <Route path="/industry" element={<Industry />} />
      <Route path="/skills-mapping" element={<SkillsMapping />} />
      <Route path="/compare" element={<Compare />} />
      <Route path="*" element={<NotMigrated />} />
    </Routes>
  );
}
