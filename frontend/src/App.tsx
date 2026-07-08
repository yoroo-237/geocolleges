import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from '@/components/Navbar'
import Home from '@/pages/Home'
import SearchMapPage from '@/pages/SearchMapPage'
import StatisticsPage from '@/pages/StatisticsPage'
import CollegeDetail from '@/pages/CollegeDetail'
import Login from '@/pages/Login'
import AdminPage from '@/pages/AdminPage'
import About from '@/pages/About'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mt-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explorer" element={<SearchMapPage />} />
          {/* Redirects pour compatibilité avec les anciens liens */}
          <Route path="/recherche" element={<Navigate to="/explorer" replace />} />
          <Route path="/carte" element={<Navigate to="/explorer" replace />} />
          <Route path="/statistiques" element={<StatisticsPage />} />
          <Route path="/etablissement/:id" element={<CollegeDetail />} />
          <Route path="/a-propos" element={<About />} />
          <Route path="/connexion" element={<Login />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin', 'gestionnaire']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  )
}
