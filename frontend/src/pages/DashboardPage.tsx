import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatPrice } from '../lib/format';

// ─── Tipos ───────────────────────────────────────────────
interface DashboardStats {
  total_products: number;
  total_variants: number;
  in_stock: number;
  total_stock_value: number;
  sold: number;
  warranty: number;
  low_stock_count: number;
}

interface LowStockItem {
  id: string;
  product_id: string;
  storage_gb: number;
  color: string;
  low_stock_threshold: number;
  stock_count: number;
  product: {
    id: string;
    model_name: string;
    brand: { name: string };
  };
}

interface Movement {
  id: string;
  movement_type: string;
  quantity: number;
  reference_note: string | null;
  created_at: string;
  variant: {
    storage_gb: number;
    color: string;
    product: {
      model_name: string;
      brand: { name: string };
    };
  } | null;
}

// ─── Helpers ─────────────────────────────────────────────
function movementLabel(type: string) {
  const labels: Record<string, string> = {
    intake: 'Entrada',
    sale: 'Venta',
    warranty_send: 'Garantía',
    warranty_return: 'Retorno',
    adjustment: 'Ajuste',
  };
  return labels[type] || type;
}

function movementColor(type: string) {
  const colors: Record<string, string> = {
    intake: 'bg-green-100 text-green-700',
    sale: 'bg-red-100 text-red-700',
    warranty_send: 'bg-yellow-100 text-yellow-700',
    warranty_return: 'bg-blue-100 text-blue-700',
    adjustment: 'bg-gray-100 text-gray-600',
  };
  return colors[type] || 'bg-gray-100 text-gray-600';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

// ─── Componente ──────────────────────────────────────────
export function DashboardPage() {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [recentMovements, setRecentMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile?.role === 'employee') {
      navigate('/employee', { replace: true });
    }
  }, [profile?.role, navigate]);

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    fetchDashboard();
  }, [profile?.role]);

  async function fetchDashboard() {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!response.ok) throw new Error('Error al cargar dashboard');
      const data = await response.json();
      setStats(data.stats);
      setLowStock(data.low_stock);
      setRecentMovements(data.recent_movements);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  // ─── Loading / Error ─────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>;
  }

  // ─── Metric Cards Config ─────────────────────────────
  const primaryMetrics = [
    {
      label: 'En stock',
      value: stats?.in_stock ?? '—',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      link: '/admin/products',
    },
    {
      label: 'Productos',
      value: stats?.total_products ?? '—',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      link: '/admin/products',
    },
    {
      label: 'Valor en stock',
      value: stats?.total_stock_value != null ? formatPrice(stats.total_stock_value) : '—',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      link: '/admin/movements',
    },
    {
      label: 'Alertas',
      value: stats?.low_stock_count ?? '—',
      badge: (stats?.low_stock_count ?? 0) > 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
      color: (stats?.low_stock_count ?? 0) > 0 ? 'text-amber-600' : 'text-gray-400',
      bg: (stats?.low_stock_count ?? 0) > 0 ? 'bg-amber-50' : 'bg-gray-50',
      link: '#low-stock',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ═══ 1. Metric Cards ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryMetrics.map((m, i) => (
          <a
            key={i}
            href={m.link === '#low-stock' ? undefined : m.link}
            onClick={m.link === '#low-stock' ? (e) => { e.preventDefault(); document.getElementById('low-stock-section')?.scrollIntoView({ behavior: 'smooth' }); } : undefined}
            className={`${m.bg} rounded-xl p-5 hover:shadow-md transition-all duration-200 border border-transparent hover:border-gray-200 group`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-3xl font-bold ${m.color}`}>{m.value}</p>
                <p className="text-sm text-gray-500 mt-1.5 group-hover:text-gray-700 transition-colors">
                  {m.label}
                </p>
              </div>
              <div className={`${m.color} opacity-60 group-hover:opacity-100 transition-opacity`}>
                {m.icon}
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* ═══ 2. Low Stock + Summary ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock — ocupa 2 columnas */}
        <div id="low-stock-section" className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <h3 className="font-semibold text-gray-800">Alertas de Stock Bajo</h3>
            {lowStock.length > 0 && (
              <span className="ml-auto text-xs text-gray-400">{lowStock.length} variante{lowStock.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {lowStock.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-gray-400 text-sm">No hay variantes con stock bajo</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {lowStock.slice(0, 8).map((item) => (
                <Link
                  key={item.id}
                  to={`/admin/products/${item.product_id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-red-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {item.product?.brand.name} {item.product?.model_name}
                      <span className="text-gray-400 font-normal"> — {item.storage_gb}GB {item.color}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Umbral mínimo: {item.low_stock_threshold} unidades
                    </p>
                  </div>
                  <span className={`ml-3 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                    item.stock_count === 0
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {item.stock_count === 0 ? 'Sin stock' : `${item.stock_count} uds.`}
                  </span>
                </Link>
              ))}
              {lowStock.length > 8 && (
                <Link
                  to="/admin/products"
                  className="block text-center text-xs text-blue-600 hover:text-blue-800 py-3 border-t border-gray-100"
                >
                  Ver las {lowStock.length} variantes con stock bajo →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Summary Panel — 1 columna */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Resumen Rápido</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Variantes activas</span>
              <span className="text-sm font-semibold text-gray-800">{stats?.total_variants ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Vendidos totales</span>
              <span className="text-sm font-semibold text-red-600">{stats?.sold ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">En garantía</span>
              <span className="text-sm font-semibold text-amber-600">{stats?.warranty ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Stock bajo</span>
              <span className={`text-sm font-semibold ${(stats?.low_stock_count ?? 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {stats?.low_stock_count ?? 0}
              </span>
            </div>
            <hr className="border-gray-100" />
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Valor total en stock</span>
              <span className="text-sm font-bold text-violet-600">
                {stats?.total_stock_value != null ? formatPrice(stats.total_stock_value) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 3. Recent Movements ═══ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <h3 className="font-semibold text-gray-800">Movimientos Recientes</h3>
          </div>
          <Link to="/admin/movements" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
            Ver todos →
          </Link>
        </div>

        {recentMovements.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-gray-400 text-sm">Sin movimientos registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50">
                {recentMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3.5 pl-5 pr-3 whitespace-nowrap">
                      <span className="text-xs text-gray-400" title={formatDate(m.created_at)}>
                        {timeAgo(m.created_at)}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${movementColor(m.movement_type)}`}>
                        {m.movement_type === 'intake' ? '+' : m.movement_type === 'sale' ? '−' : '↗'}
                        {' '}{movementLabel(m.movement_type)}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-gray-700">
                      {m.variant ? (
                        <>
                          <span className="font-medium">{m.variant.product.brand.name} {m.variant.product.model_name}</span>
                          <span className="text-gray-400"> — {m.variant.storage_gb}GB {m.variant.color}</span>
                        </>
                      ) : (
                        <span className="text-gray-400">{m.reference_note || '—'}</span>
                      )}
                    </td>
                    <td className="py-3.5 pl-3 pr-5 text-right font-medium whitespace-nowrap">
                      <span className={m.movement_type === 'intake' ? 'text-green-600' : m.movement_type === 'sale' ? 'text-red-600' : 'text-gray-600'}>
                        {m.movement_type === 'intake' ? '+' : ''}{m.quantity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
