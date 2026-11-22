import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-accent mb-4">404</p>
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-text-muted mb-6">The page you're looking for doesn't exist.</p>
        <Link to="/" className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-black font-medium px-5 py-2.5 rounded-lg transition-colors"><Home className="w-4 h-4" /> Go Home</Link>
      </div>
    </div>
  )
}
