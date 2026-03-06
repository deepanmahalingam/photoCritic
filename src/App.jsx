import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Critique from './pages/Critique'
import Compare from './pages/Compare'
import Gallery from './pages/Gallery'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/critique" element={<Critique />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/gallery" element={<Gallery />} />
      </Routes>
    </Layout>
  )
}
