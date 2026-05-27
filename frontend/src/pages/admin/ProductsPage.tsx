import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { formatPrice } from '../../lib/format';

interface Brand {
  id: string;
  name: string;
}

interface Variant {
  id: string;
  storage_gb: number;
  color: string;
  sale_price_cents: number;
  stock_count: number;
}

interface Product {
  id: string;
  model_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  main_image_url?: string | null;
  brand: Brand | null;
  variants: Variant[];
}

export function ProductsPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchVersion, setSearchVersion] = useState(0);
  const limit = 20;

  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetchProducts();
  }, [selectedBrand, page, searchVersion]);

  useEffect(() => {
    fetchBrands();
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(1);
      setSearchVersion((v) => v + 1);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  async function fetchBrands() {
    try {
      const response = await fetch('/api/brands', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      setBrands(data.brands);
    } catch { /* silencio */ }
  }

  async function fetchProducts() {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (selectedBrand) params.append('brand_id', selectedBrand);
      if (search) params.append('search', search);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const response = await fetch(`/api/products?${params}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (!response.ok) throw new Error('Error al cargar productos');

      const data = await response.json();
      setProducts(data.products);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProduct() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const response = await fetch(`/api/products/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!response.ok) throw new Error('Error al eliminar producto');
      setDeleteTarget(null);
      fetchProducts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setDeleting(false);
    }
  }

  function handleSearchChange(value: string) {
    setSearch(value);
  }

  function totalStock(variants: Variant[]) {
    return variants.reduce((sum, v) => sum + v.stock_count, 0);
  }

  function getInitials(name: string) {
    return name?.charAt(0).toUpperCase() || '?';
  }

  // Colores para el placeholder de imagen por marca
  const brandColors: Record<string, string> = {
    A: 'bg-red-100 text-red-600',
    B: 'bg-blue-100 text-blue-600',
    C: 'bg-green-100 text-green-600',
    D: 'bg-purple-100 text-purple-600',
    E: 'bg-yellow-100 text-yellow-600',
    F: 'bg-pink-100 text-pink-600',
    G: 'bg-indigo-100 text-indigo-600',
    H: 'bg-teal-100 text-teal-600',
    I: 'bg-orange-100 text-orange-600',
    J: 'bg-cyan-100 text-cyan-600',
    K: 'bg-lime-100 text-lime-600',
    L: 'bg-amber-100 text-amber-600',
    M: 'bg-violet-100 text-violet-600',
    N: 'bg-rose-100 text-rose-600',
    O: 'bg-fuchsia-100 text-fuchsia-600',
    P: 'bg-sky-100 text-sky-600',
    Q: 'bg-emerald-100 text-emerald-600',
    R: 'bg-blue-100 text-blue-600',
    S: 'bg-red-100 text-red-600',
    T: 'bg-purple-100 text-purple-600',
    U: 'bg-green-100 text-green-600',
    V: 'bg-pink-100 text-pink-600',
    W: 'bg-indigo-100 text-indigo-600',
    X: 'bg-teal-100 text-teal-600',
    Y: 'bg-orange-100 text-orange-600',
    Z: 'bg-cyan-100 text-cyan-600',
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>;
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      {/* Filtros + acciones */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder="Buscar por modelo..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          />
          <select
            value={selectedBrand}
            onChange={(e) => { setSelectedBrand(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Todas las marcas</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/admin/products/new')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 whitespace-nowrap"
          >
            + Nuevo Artículo
          </button>
          <button
            onClick={fetchProducts}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Grid de productos */}
      {products.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {search || selectedBrand
            ? 'No se encontraron productos'
            : 'No hay productos registrados'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product) => {
              const initial = product.brand ? getInitials(product.brand.name) : '?';
              const colorClass = brandColors[initial] || 'bg-gray-100 text-gray-600';
              const stock = totalStock(product.variants);

              return (
                <div
                  key={product.id}
                  onClick={() => navigate(`/admin/products/${product.id}`)}
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border border-gray-200 hover:border-blue-300 overflow-hidden"
                >
                  {/* Imagen del producto */}
                  {product.main_image_url ? (
                    <div className="h-28 flex items-center justify-center bg-white">
                      <img
                        src={product.main_image_url}
                        alt={`${product.brand?.name} ${product.model_name}`}
                        className="h-full w-full object-contain p-2"
                      />
                    </div>
                  ) : (
                    <div className={`h-28 flex items-center justify-center ${colorClass}`}>
                      <span className="text-4xl font-bold opacity-60">{initial}</span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate">
                          {product.brand?.name} {product.model_name}
                        </p>
                        {product.description && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{product.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${
                          product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {product.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                        {/* Three-dots menu */}
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === product.id ? null : product.id); }}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>
                          {openMenu === product.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpenMenu(null); }} />
                              <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-36">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setOpenMenu(null); navigate(`/admin/products/${product.id}`); }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setOpenMenu(null); setDeleteTarget(product); }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Variants compactas */}
                    {product.variants.length > 0 ? (
                      <div className="space-y-1 mt-3">
                        {product.variants.slice(0, 3).map((v) => (
                          <div key={v.id} className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">
                              {v.storage_gb}GB <span className="text-gray-400">— {v.color}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">{formatPrice(v.sale_price_cents)}</span>
                              <span className={`font-medium ${
                                v.stock_count > 0 ? 'text-green-600' : 'text-red-400'
                              }`}>
                                {v.stock_count}
                              </span>
                            </div>
                          </div>
                        ))}
                        {product.variants.length > 3 && (
                          <p className="text-xs text-gray-400 text-center pt-1">
                            +{product.variants.length - 3} variante{product.variants.length - 3 !== 1 ? 's' : ''} más
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-3">Sin variantes</p>
                    )}

                    {/* Footer */}
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100 text-xs text-gray-400">
                      <span>{stock} en stock</span>
                      <span>{new Date(product.created_at).toLocaleDateString('es-CO')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-6">
              <span className="text-sm text-gray-500">
                Página {page} de {totalPages} ({total} productos)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Eliminar producto</h3>
            <p className="text-sm text-gray-600 mb-4">
              ¿Estás seguro de eliminar <strong>{deleteTarget.brand?.name} {deleteTarget.model_name}</strong>?
              El producto se desactivará, no se eliminarán sus datos.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
