import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { BrowseRounds } from './pages/BrowseRounds';
import { RoundDetail } from './pages/RoundDetail';
import { CreateRound } from './pages/CreateRound';
import { ApplyToRound } from './pages/ApplyToRound';
import { RoundResults } from './pages/RoundResults';
import { ProjectDetail } from './pages/ProjectDetail';
import { Dashboard } from './pages/Dashboard';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/rounds" element={<BrowseRounds />} />
        <Route path="/rounds/:id" element={<RoundDetail />} />
        <Route path="/rounds/:id/apply" element={<ApplyToRound />} />
        <Route path="/rounds/:id/results" element={<RoundResults />} />
        <Route path="/create-round" element={<CreateRound />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}
