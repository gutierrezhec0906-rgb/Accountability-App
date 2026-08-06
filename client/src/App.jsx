import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import InstallPrompt from './components/InstallPrompt';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Team from './pages/Team';
import Approvals from './pages/Approvals';
import VisualBoard from './pages/VisualBoard';
import Quotes from './pages/Quotes';
import Podcasts from './pages/Podcasts';
import Training from './pages/Training';
import Coaching from './pages/Coaching';
import Mentoring from './pages/Mentoring';
import Skills from './pages/Skills';
import LOB from './pages/LOB';
import Urgency from './pages/Urgency';
import Feedback from './pages/Feedback';
import ProblemSolving from './pages/ProblemSolving';
import Vision from './pages/Vision';
import Lean from './pages/Lean';
import Mindfulness from './pages/Mindfulness';
import Career from './pages/Career';
import DISC from './pages/DISC';
import EQOpEx from './pages/EQOpEx';
import Scores from './pages/Scores';
import Profile from './pages/Profile';
import SmartGoals from './pages/SmartGoals';
import Pricing from './pages/Pricing';
import SelfAssessment from './pages/SelfAssessment';
import Survey360Manager from './pages/Survey360Manager';
import Survey360 from './pages/Survey360';
import CompleteProfile from './pages/CompleteProfile';
import AdminPanel from './pages/AdminPanel';
import TeamBoard from './pages/TeamBoard';
import { Terms, Privacy } from './pages/Legal';

function PrivateLayout({ children }) {
  return (
    <PrivateRoute>
      <Layout>{children}</Layout>
    </PrivateRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <InstallPrompt />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/complete-profile" element={<PrivateRoute><CompleteProfile /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateLayout><Dashboard /></PrivateLayout>} />
          <Route path="/team" element={<PrivateLayout><Team /></PrivateLayout>} />
          <Route path="/approvals" element={<PrivateLayout><Approvals /></PrivateLayout>} />
          <Route path="/visual-board" element={<PrivateLayout><VisualBoard /></PrivateLayout>} />
          <Route path="/quotes" element={<PrivateLayout><Quotes /></PrivateLayout>} />
          <Route path="/podcasts" element={<PrivateLayout><Podcasts /></PrivateLayout>} />
          <Route path="/training" element={<PrivateLayout><Training /></PrivateLayout>} />
          <Route path="/coaching" element={<PrivateLayout><Coaching /></PrivateLayout>} />
          <Route path="/mentoring" element={<PrivateLayout><Mentoring /></PrivateLayout>} />
          <Route path="/skills" element={<PrivateLayout><Skills /></PrivateLayout>} />
          <Route path="/lob" element={<PrivateLayout><LOB /></PrivateLayout>} />
          <Route path="/urgency" element={<PrivateLayout><Urgency /></PrivateLayout>} />
          <Route path="/feedback" element={<PrivateLayout><Feedback /></PrivateLayout>} />
          <Route path="/problem-solving" element={<PrivateLayout><ProblemSolving /></PrivateLayout>} />
          <Route path="/vision" element={<PrivateLayout><Vision /></PrivateLayout>} />
          <Route path="/lean" element={<PrivateLayout><Lean /></PrivateLayout>} />
          <Route path="/mindfulness" element={<PrivateLayout><Mindfulness /></PrivateLayout>} />
          <Route path="/career" element={<PrivateLayout><Career /></PrivateLayout>} />
          <Route path="/disc" element={<PrivateLayout><DISC /></PrivateLayout>} />
          <Route path="/eq-opex" element={<PrivateLayout><EQOpEx /></PrivateLayout>} />
          <Route path="/scores" element={<PrivateLayout><Scores /></PrivateLayout>} />
          <Route path="/smart-goals" element={<PrivateLayout><SmartGoals /></PrivateLayout>} />
          <Route path="/profile" element={<PrivateLayout><Profile /></PrivateLayout>} />
          <Route path="/pricing" element={<PrivateLayout><Pricing /></PrivateLayout>} />
          <Route path="/self-assessment" element={<PrivateLayout><SelfAssessment /></PrivateLayout>} />
          <Route path="/360-feedback" element={<PrivateLayout><Survey360Manager /></PrivateLayout>} />
          <Route path="/admin" element={<PrivateLayout><AdminPanel /></PrivateLayout>} />
          <Route path="/survey/:surveyId" element={<Survey360 />} />
          <Route path="/team-board" element={<PrivateRoute><TeamBoard /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
