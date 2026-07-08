import { Routes, Route } from 'react-router-dom'
import Navbar from '@/components/Navbar'
import Home from '@/pages/Home'
import MapPage from '@/pages/MapPage'
import StatisticsPage from '@/pages/StatisticsPage'
import SearchPage from '@/pages/SearchPage'
import CollegeDetail from '@/pages/CollegeDetail'
import Login from '@/pages/Login'
import AdminPage from '@/pages/AdminPage'
import About from '@/pages/About'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function App() {
  return (
    <div className="min-h-screen pb-10">
      <Navbar />
      <main className="mt-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recherche" element={<SearchPage />} />
          <Route path="/carte" element={<MapPage />} />
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
