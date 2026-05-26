import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface DashboardStats {
  total_products: number;
  total_variants: number;
  in_stock: number;
  sold: number;
  warranty: number;
}

interface LowStockItem {
  id: string;
  product_id?: string;
  storage_gb: number;
  color: string;
  low_stock_threshold: number;
  stock_count: number;
  product: {
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
}

function movementLabel(type: string) {
  const labels: Record<string, string> = {
    intake: 'Entrada',
    sale: 'Venta',
    warranty_send: 'Envío Garantía',
    warranty_return: 'Retorno Garantía',
    adjustment: 'Ajuste',
  };
  return labels[type] || type;
}

export function DashboardPage() {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [recentMovements, setRecentMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Si es empleado, lo mandamos directo a la búsqueda (después del render inicial)
  useEffect(() => {
    if (profile?.role === 'employee') {
      navigate('/employee', { replace: true });
    }
  }, [profile?.role, navigate]);

  useEffect(() => {
    // Solo admins pueden acceder al dashboard completo
    if (profile?.role !== 'admin') {
      return;
    }
    
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

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('es-CO', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  const metrics = [
    { label: 'Productos', value: stats?.total_products ?? '—', color: 'text-blue-600', bg: 'bg-blue-50', link: '/admin/products' },
    { label: 'Variantes', value: stats?.total_variants ?? '—', color: 'text-indigo-600', bg: 'bg-indigo-50', link: '/admin/products' },
    { label: 'En stock', value: stats?.in_stock ?? '—', color: 'text-green-600', bg: 'bg-green-50', link: '/admin/products' },
    { label: 'Vendidos', value: stats?.sold ?? '—', color: 'text-gray-600', bg: 'bg-gray-50', link: '/admin/movements' },
    { label: 'Garantía', value: stats?.warranty ?? '—', color: 'text-yellow-600', bg: 'bg-yellow-50', link: '/admin/movements' },
  ];

  return (
    <>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      ) : (
        <div className="space-y-6">
          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {metrics.map((m, i) => (
              <Link key={i} to={m.link} className={`${m.bg} rounded-lg p-4 hover:shadow-md transition-shadow`}>
                <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                <p className="text-sm text-gray-600 mt-1">{m.label}</p>
              </Link>
            ))}
          </div>

          {/* Two column: Low Stock + Recent Movements */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Low Stock */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Alertas de Stock Bajo</h3>
              </div>
              {lowStock.length === 0 ? (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">
                  No hay variantes con stock bajo
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {lowStock.map((item) => (
                    <Link
                      key={item.id}
                      to={item.product_id ? `/admin/products/${item.product_id}` : '#'}
                      className="flex items-center justify-between px-5 py-3 hover:bg-red-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {item.product?.brand.name} {item.product?.model_name}
                          <span className="text-gray-400"> — {item.storage_gb}GB {item.color}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">Umbral: {item.low_stock_threshold} unidades</p>
                      </div>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        item.stock_count === 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {item.stock_count === 0 ? 'Sin stock' : `${item.stock_count} uds.`}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Movements */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">Movimientos Recientes</h3>
                <Link to="/admin/movements" className="text-xs text-blue-600 hover:text-blue-800">Ver todos</Link>
              </div>
              {recentMovements.length === 0 ? (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">Sin movimientos</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentMovements.map((m) => (
                    <div key={m.id} className="px-5 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{formatDate(m.created_at)}</span>
                        <span className={`text-xs font-medium ${
                          m.movement_type === 'intake' ? 'text-green-600' :
                          m.movement_type === 'sale' ? 'text-red-600' : 'text-yellow-600'
                        }`}>{movementLabel(m.movement_type)}</span>
                      </div>
                      {m.reference_note && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{m.reference_note}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
