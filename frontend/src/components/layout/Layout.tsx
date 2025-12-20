import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex space-x-8">
              <Link to="/" className="inline-flex items-center px-1 pt-1 text-sm font-medium">
                Dashboard
              </Link>
              <Link to="/drivers" className="inline-flex items-center px-1 pt-1 text-sm font-medium">
                Drivers
              </Link>
              <Link to="/routes" className="inline-flex items-center px-1 pt-1 text-sm font-medium">
                Routes
              </Link>
              <Link to="/dispatches" className="inline-flex items-center px-1 pt-1 text-sm font-medium">
                Dispatches
              </Link>
              <Link to="/tracking" className="inline-flex items-center px-1 pt-1 text-sm font-medium">
                Live Tracking
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
