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
      image_url?: string; // Campo opcional para imagen
    };
  } | null;
}

interface SearchFilters {
  searchBy: 'imei' | 'model' | 'color' | 'storage' | 'all';
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    in_stock: 'En stock',
    sold: 'Vendido',
    warranty: 'Garantía',
  };
  return labels[status] || status;
}

function statusColor(status: string) {
  const colors: Record<string, string> = {
    in_stock: 'bg-green-100 text-green-700',
    sold: 'bg-gray-100 text-gray-500',
    warranty: 'bg-yellow-100 text-yellow-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-500';
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toLocaleString('es-US', { minimumFractionDigits: 2 })}`;
}

export function EmployeeSearchPage() {
  const { session, profile, signOut } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [total, setTotal] = useState(0);
  const [searchBy, setSearchBy] = useState<SearchFilters['searchBy']>('imei');
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Enfoque inicial en el input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Búsqueda automática al cambiar query o searchBy
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setSearched(false);
      return;
    }

    // Mínimo 2 caracteres para búsqueda por modelo/color, 3 para IMEI
    const minLength = searchBy === 'imei' ? 3 : 2;
    if (trimmed.length < minLength) return;

    timerRef.current = setTimeout(() => {
      searchItems(trimmed, searchBy);
    }, 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, searchBy]);

  async function searchItems(term: string, searchBy: SearchFilters['searchBy']) {
    try {
      setLoading(true);
      setSearched(true);
      
      let endpoint = `/api/inventory/search?q=${encodeURIComponent(term)}`;
      
      // Si no es búsqueda por IMEI, usamos un endpoint diferente o parámetros
      if (searchBy !== 'imei') {
        endpoint = `/api/inventory/search-advanced?q=${encodeURIComponent(term)}&searchBy=${searchBy}`;
      }

      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      
      if (!response.ok) {
        // Si falla el endpoint avanzado, intentar con el básico como fallback
        if (searchBy !== 'imei') {
          const fallbackResponse = await fetch(`/api/inventory/search?q=${encodeURIComponent(term)}`, {
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });
          if (!fallbackResponse.ok) throw new Error('Error al buscar');
          const data = await fallbackResponse.json();
          setResults(data.results);
          setTotal(data.total);
          return;
        } else {
          throw new Error('Error al buscar');
        }
      }
      
      const data = await response.json();
      setResults(data.results);
      setTotal(data.total);
    } catch (err) {
      console.error('Error searching:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  // Manejar tecla Enter para buscar
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Forzar búsqueda actual
      if (timerRef.current) clearTimeout(timerRef.current);
      searchItems(query.trim(), searchBy);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img 
              src="/logo/nexuslogo.webp" 
              alt="Nexus Logo" 
              className="h-10 w-auto"
            />
            <h1 className="text-xl font-bold text-gray-800">Nexus Empleado</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {profile?.full_name} ({profile?.role === 'admin' ? 'Admin' : 'Empleado'})
            </span>
            <button onClick={signOut} className="text-sm text-red-600 hover:text-red-800">
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Search Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="mb-4">
            <label htmlFor="search-input" className="block text-sm font-medium text-gray-700 mb-2">
              Buscar productos
            </label>
            <div className="flex gap-3">
              <input
                ref={inputRef}
                id="search-input"
                type="text"
                inputMode="text"
                placeholder="Buscar por IMEI, modelo, color o capacidad..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
              
              {/* Selector de tipo de búsqueda */}
              <div className="relative">
                <label htmlFor="search-type" className="block text-xs text-gray-500 mb-1">Buscar por:</label>
                <select
                  id="search-type"
                  value={searchBy}
                  onChange={(e) => setSearchBy(e.target.value as SearchFilters['searchBy'])}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  <option value="imei">IMEI</option>
                  <option value="model">Modelo</option>
                  <option value="color">Color</option>
                  <option value="storage">Capacidad (GB)</option>
                  <option value="all">Todos los campos</option>
                </select>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-2">
              {searchBy === 'imei' 
                ? 'Ingrese al menos 3 dígitos del IMEI' 
                : searchBy === 'all'
                  ? 'Busca en modelo, marca, color y capacidad'
                  : `Busca por ${searchBy === 'model' ? 'nombre del modelo' : searchBy === 'color' ? 'color' : 'capacidad en GB'}`
              }
            </p>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}

        {/* No Results */}
        {!loading && searched && results.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 text-lg">No se encontraron resultados</p>
            <p className="text-gray-400 text-sm mt-1">
              {searchBy === 'imei' 
                ? 'Verifique el IMEI e intente de nuevo' 
                : `Intente con otro término de búsqueda o cambie el tipo de búsqueda`}
            </p>
            <button 
              onClick={() => {
                setQuery('');
                setResults([]);
                setSearched(false);
                inputRef.current?.focus();
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Nueva búsqueda
            </button>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div>
            <div className="mb-4 flex justify-between items-start">
              <p className="text-sm text-gray-500">
                {total} resultado{total !== 1 ? 's' : ''}
              </p>
              {total > 0 && (
                <span className="text-xs text-gray-400">
                  {results.filter(r => r.variant?.status === 'in_stock').length} disponibles
                </span>
              )}
            </div>
            
            <div className="space-y-4">
              {results.map((item) => (
                <div key={item.id} className="bg-white rounded-lg shadow p-5">
                  {/* Resultado Principal */}
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    
                    {/* Imagen del producto */}
                    <div className="flex-shrink-0">
                      {item.variant?.product?.image_url ? (
                        <img 
                          src={item.variant.product.image_url} 
                          alt={`${item.variant.product.brand.name} ${item.variant.product.model_name}`} 
                          className="w-24 h-24 object-contain bg-gray-50 rounded p-2"
                        />
                      ) : (
                        <div className="w-24 h-24 flex items-center justify-center bg-gray-200 rounded text-gray-400">
                          <span className="text-xs">Sin imagen</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Información del producto */}
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-lg font-mono font-bold tracking-wider">{item.imei1}</p>
                          {item.imei2 && (
                            <p className="text-sm font-mono text-gray-400 tracking-wider">
                              Secundario: {item.imei2}
                            </p>
                          )}
                        </div>
                        <div className="text-xs flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(item.status)}`}>
                            {statusLabel(item.status)}
                          </span>
                          {item.variant?.status === 'in_stock' && item.variant?.inventory_count === 1 && (
                            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              ¡ÚLTIMA UNIDAD!
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-gray-700 font-medium">
                          {item.variant?.product.brand.name} {item.variant?.product.model_name}
                        </p>
                        {item.variant && (
                          <p className="text-gray-600 text-sm">
                            {item.variant.storage_gb}GB • {item.variant.color}
                          </p>
                        )}
                        {item.variant && (
                          <p className="text-gray-500 text-sm mt-1">
                            Precio: <span className="font-medium">{formatPrice(item.variant.sale_price_cents)}</span>
                          </p>
                        )}
                      </div>
                      
                      {item.notes && (
                        <p className="mt-2 text-sm text-gray-500 border-t pt-2">
                          Nota: {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Acciones rápidas para empleados */}
                  {item.variant?.status === 'in_stock' && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex justify-between items-center">
                        <button
                          onClick={() => {
                            // Aquí iría la lógica para "marcar como mostrado" o "preparar para venta"
                            alert(`Mostrando dispositivo IMEI: ${item.imei1}`);
                          }}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-2"
                        >
                          Mostrar al cliente
                        </button>
                        <button
                          onClick={() => {
                            // Aquí iría la lógica para iniciar venta
                            alert(`Iniciando venta para IMEI: ${item.imei1}`);
                          }}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                         >
                           Vender este equipo
                         </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Historial rápido (versión simplificada) */}
                  {item.variant?.status !== 'in_stock' && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-sm text-gray-500">
                        Estado actual: {statusLabel(item.status)}
                        {item.notes && ` — ${item.notes}`}
                      </div>
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