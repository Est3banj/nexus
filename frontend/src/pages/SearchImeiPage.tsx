import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

interface SearchResult {
  id: string;
  imei1: string;
  imei2?: string | null;
  status: 'in_stock' | 'sold' | 'warranty';
  notes: string | null;
  created_at: string;
  variant: {
    storage_gb: number;
    color: string;
    sale_price_cents: number;
    product: {
      model_name: string;
      brand: { name: string };
    };
  } | null;
}

interface Movement {
  id: string;
  movement_type: string;
  quantity: number;
  reference_note: string | null;
  performed_by: string;
  created_at: string;
  variant: {
    storage_gb: number;
    color: string;
  } | null;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    in_stock: 'En stock',
    sold: 'Vendido',
    warranty: 'Garantía',
  };
  return labels[status] || status;
}

function movementLabel(type: string) {
  const labels: Record<string, string> = {
    intake: 'Entrada a stock',
    sale: 'Vendido',
    warranty_send: 'Enviado a garantía',
    warranty_return: 'Devuelto de garantía',
    adjustment: 'Ajuste',
  };
  return labels[type] || type;
}

function movementColor(type: string) {
  const colors: Record<string, string> = {
    intake: 'text-green-600',
    sale: 'text-red-600',
    warranty_send: 'text-yellow-600',
    warranty_return: 'text-blue-600',
    adjustment: 'text-gray-500',
  };
  return colors[type] || 'text-gray-500';
}

function statusColor(status: string) {
  const colors: Record<string, string> = {
    in_stock: 'bg-green-100 text-green-700',
    sold: 'bg-gray-100 text-gray-500',
    warranty: 'bg-yellow-100 text-yellow-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-500';
}

export function SearchImeiPage() {
  const { session, profile, signOut } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [total, setTotal] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [movementsCache, setMovementsCache] = useState<Record<string, Movement[]>>({});
  const [loadingMovements, setLoadingMovements] = useState(false);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function toggleMovements(itemId: string) {
    if (expandedId === itemId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(itemId);

    if (movementsCache[itemId]) return;

    try {
      setLoadingMovements(true);
      const response = await fetch(`/api/inventory/${itemId}/movements`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!response.ok) throw new Error('Error al cargar historial');
      const data = await response.json();
      setMovementsCache((prev) => ({ ...prev, [itemId]: data.movements }));
    } catch (err) {
      console.error('Error fetching movements:', err);
    } finally {
      setLoadingMovements(false);
    }
  }

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setSearched(false);
      return;
    }

    if (trimmed.length < 3) return; // mínimo 3 dígitos para buscar

    timerRef.current = setTimeout(() => {
      searchImei(trimmed);
    }, 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  async function searchImei(term: string) {
    try {
      setLoading(true);
      setSearched(true);
      const response = await fetch(`/api/inventory/search?q=${encodeURIComponent(term)}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!response.ok) throw new Error('Error al buscar');
      const data = await response.json();
      setResults(data.results);
      setTotal(data.total);
    } catch (err) {
      console.error('Error searching IMEI:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function formatPrice(cents: number) {
    return `RD$${(cents / 100).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-gray-800">Nexus</h1>
            {isAdmin && (
              <Link to="/" className="text-sm text-blue-600 hover:text-blue-800">
                Panel Admin
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {profile?.full_name} ({profile?.role})
            </span>
            <button onClick={signOut} className="text-sm text-red-600 hover:text-red-800">
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Search */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <label htmlFor="imei-search" className="block text-sm font-medium text-gray-600 mb-2">
            Buscar por IMEI
          </label>
          <input
            ref={inputRef}
            id="imei-search"
            type="text"
            inputMode="numeric"
            placeholder="Ingrese IMEI (mínimo 3 dígitos)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            {query.trim().length > 0 && query.trim().length < 3
              ? 'Escriba al menos 3 dígitos para buscar...'
              : 'Búsqueda parcial — escribe cualquier parte del IMEI'}
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}

        {/* No results */}
        {!loading && searched && results.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 text-lg">No se encontraron resultados</p>
            <p className="text-gray-400 text-sm mt-1">Verifique el IMEI e intente de nuevo</p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div>
            <p className="text-sm text-gray-500 mb-3">
              {total} resultado{total !== 1 ? 's' : ''}
            </p>
            <div className="space-y-3">
              {results.map((item) => (
                <div key={item.id} className="bg-white rounded-lg shadow p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-lg font-mono font-bold tracking-wider">{item.imei1}</p>
                      {item.imei2 && (
                        <p className="text-sm font-mono text-gray-400 tracking-wider">
                          Secundario: {item.imei2}
                        </p>
                      )}
                      {item.variant && (
                        <p className="text-gray-600 text-sm mt-1">
                          {item.variant.product.brand.name} {item.variant.product.model_name}
                          <span className="text-gray-400">
                            {' — '}{item.variant.storage_gb}GB {item.variant.color}
                          </span>
                        </p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </div>

                  <div className="flex gap-4 text-sm text-gray-500">
                    {item.variant && (
                      <span>
                        Precio: <span className="font-medium text-gray-700">{formatPrice(item.variant.sale_price_cents)}</span>
                      </span>
                    )}
                    <span>
                      Registrado: {new Date(item.created_at).toLocaleDateString('es-DO')}
                    </span>
                  </div>

                  {item.notes && (
                    <p className="mt-2 text-sm text-gray-500 border-t pt-2">
                      Nota: {item.notes}
                    </p>
                  )}

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => toggleMovements(item.id)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {expandedId === item.id ? 'Ocultar historial' : 'Ver historial'}
                    </button>
                  </div>

                  {expandedId === item.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      {loadingMovements && movementsCache[item.id] === undefined ? (
                        <div className="text-sm text-gray-400 py-2">Cargando historial...</div>
                      ) : movementsCache[item.id]?.length === 0 ? (
                        <div className="text-sm text-gray-400 py-2">Sin movimientos registrados</div>
                      ) : (
                        <div className="relative pl-6">
                          {/* Línea vertical de timeline */}
                          <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-gray-200" />
                          {movementsCache[item.id]?.map((m) => (
                            <div key={m.id} className="relative pb-4 last:pb-0">
                              {/* Punto en la línea */}
                              <div className={`absolute -left-[18px] top-1 w-3 h-3 rounded-full border-2 border-white ${movementColor(m.movement_type).replace('text-', 'bg-')}`} />
                              <div className="text-sm">
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${movementColor(m.movement_type)}`}>
                                    {movementLabel(m.movement_type)}
                                  </span>
                                  <span className="text-gray-400 text-xs">
                                    {new Date(m.created_at).toLocaleString('es-DO', {
                                      year: 'numeric', month: '2-digit', day: '2-digit',
                                      hour: '2-digit', minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                {m.reference_note && (
                                  <p className="text-gray-500 mt-0.5">{m.reference_note}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
