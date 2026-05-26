import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

const navItems = [
  { path: '/', label: 'Panel' },
  { path: '/admin/products', label: 'Catálogo' },
  { path: '/admin/products/new', label: 'Nuevo Artículo' },
  { path: '/admin/movements', label: 'Movimientos' },
  { path: '/employee', label: 'Buscar IMEI' },
];

const navIcons: Record<string, string> = {
  '/': '⊞',
  '/admin/products': '≡',
  '/admin/products/new': '+',
  '/admin/movements': '↻',
  '/employee': '⌕',
};

export function Layout({ children, title }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Overlay para mobile cuando sidebar está abierto */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-800 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-slate-700">
          <Link to="/" className="text-xl font-bold tracking-wide" onClick={() => setSidebarOpen(false)}>
            NEXUS
          </Link>
          <p className="text-xs text-slate-400 mt-0.5">Sistema de Inventario</p>
        </div>

        {/* Nav */}
        <nav className="px-3 py-4 flex-1">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive(item.path)
                      ? 'bg-slate-700 text-white font-medium'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <span className="w-5 text-center text-base">{navIcons[item.path]}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-slate-700">
          <div className="text-sm text-slate-300 truncate">
            {profile?.full_name}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {profile?.role === 'admin' ? 'Administrador' : 'Empleado'}
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header bar */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="flex items-center justify-between px-4 lg:px-6 py-3">
            <div className="flex items-center gap-3">
              {/* Hamburger — visible solo en mobile */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-1.5 rounded-md text-gray-600 hover:bg-gray-100"
                aria-label="Abrir menú"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-gray-800">{title || 'Nexus'}</h1>
            </div>
            <button
              onClick={signOut}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
