import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { formatPrice } from '../../lib/format';

interface InventoryItem {
  id: string;
  imei1: string;
  imei2?: string | null;
  status: 'in_stock' | 'sold' | 'warranty';
  notes: string | null;
  created_at: string;
}

interface Variant {
  id: string;
  storage_gb: number;
  color: string;
  sale_price_cents: number;
  cost_price_cents?: number;
  is_active: boolean;
  stock_count: number;
  created_at: string;
}

interface Product {
  id: string;
  model_name: string;
  model_code?: string | null;
  description: string | null;
  main_image_url?: string | null;
  is_active: boolean;
  created_at: string;
  brand: { id: string; name: string; slug: string } | null;
  variants: Variant[];
}

function statusLabel(status: string) {
  const labels: Record<string, string> = { in_stock: 'En stock', sold: 'Vendido', warranty: 'Garantía' };
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

function availableTransitions(status: string): { value: string; label: string }[] {
  switch (status) {
    case 'in_stock': return [
      { value: 'sold', label: 'Vender' },
      { value: 'warranty', label: 'Enviar a Garantía' },
    ];
    case 'sold': return [{ value: 'warranty', label: 'Reclamar Garantía' }];
    case 'warranty': return [{ value: 'in_stock', label: 'Devolver a stock' }];
    default: return [];
  }
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedVariant, setExpandedVariant] = useState<string | null>(null);
  const [inventoryCache, setInventoryCache] = useState<Record<string, InventoryItem[]>>({});
  const [loadingInventory, setLoadingInventory] = useState(false);

  const [form, setForm] = useState({ storage_gb: '', color: '', sale_price: '', cost_price: '' });
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ model_name: '', model_code: '', description: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => { fetchProduct(); }, [id]);

  async function fetchProduct() {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`/api/products/${id}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!response.ok) throw new Error('Error al cargar producto');
      const data = await response.json();
      setProduct(data.product);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  async function toggleInventory(variantId: string) {
    if (expandedVariant === variantId) { setExpandedVariant(null); return; }
    setExpandedVariant(variantId);
    if (inventoryCache[variantId]) return;
    try {
      setLoadingInventory(true);
      const response = await fetch(`/api/variants/${variantId}/inventory`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!response.ok) throw new Error('Error al cargar IMEIs');
      const data = await response.json();
      setInventoryCache((prev) => ({ ...prev, [variantId]: data.inventory }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInventory(false);
    }
  }

  async function handleStatusChange(itemId: string, newStatus: string, variantId: string) {
    try {
      const response = await fetch(`/api/inventory/${itemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Error'); }
      const data = await response.json();
      setInventoryCache((prev) => ({
        ...prev,
        [variantId]: prev[variantId]?.map((item) => item.id === itemId ? data.inventory : item),
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cambiar estado');
    }
  }

  async function handleCreateVariant() {
    if (!form.storage_gb || !form.color || !form.sale_price) return;
    try {
      setSaving(true);
      const response = await fetch(`/api/products/${id}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          storage_gb: parseInt(form.storage_gb, 10),
          color: form.color,
          sale_price_cents: Math.round(parseFloat(form.sale_price) * 100),
          cost_price_cents: form.cost_price ? Math.round(parseFloat(form.cost_price) * 100) : null,
        }),
      });
      if (response.status === 409) throw new Error('Ya existe una variante con ese storage y color');
      if (!response.ok) throw new Error('Error al crear variante');
      await fetchProduct();
      setShowModal(false);
      setForm({ storage_gb: '', color: '', sale_price: '', cost_price: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  function startEditing() {
    if (!product) return;
    setEditForm({
      model_name: product.model_name,
      model_code: product.model_code || '',
      description: product.description || '',
    });
    setEditing(true);
    setEditError('');
  }

  async function handleEditSave() {
    if (!product || !editForm.model_name.trim()) {
      setEditError('El nombre del modelo es requerido');
      return;
    }
    try {
      setEditSaving(true);
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          model_name: editForm.model_name.trim(),
          model_code: editForm.model_code.trim() || null,
          description: editForm.description.trim() || null,
        }),
      });
      if (!response.ok) throw new Error('Error al guardar');
      const data = await response.json();
      setProduct(data.product);
      setEditing(false);
      setEditError('');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setEditSaving(false);
    }
  }

  function cancelEditing() {
    setEditing(false);
    setEditError('');
  }

  async function handleDeleteProduct() {
    if (!product) return;
    try {
      setDeleting(true);
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!response.ok) throw new Error('Error al eliminar');
      navigate('/admin/products');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  if (error || !product) {
    return <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error || 'Producto no encontrado'}</div>;
  }

  const totalStock = product.variants.reduce((s, v) => s + v.stock_count, 0);
  const totalValue = product.variants.reduce((s, v) => s + v.sale_price_cents * v.stock_count, 0);

  return (
    <div className="space-y-6">
      {/* Hero: brand + model */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {product.main_image_url ? (
                <img
                  src={product.main_image_url}
                  alt={product.model_name}
                  className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                  {product.brand?.name?.charAt(0) || '?'}
                </div>
              )}
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nombre del modelo</label>
                    <input
                      type="text"
                      value={editForm.model_name}
                      onChange={(e) => setEditForm({ ...editForm, model_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md font-bold text-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Código de modelo</label>
                    <input
                      type="text"
                      value={editForm.model_code}
                      onChange={(e) => setEditForm({ ...editForm, model_code: e.target.value })}
                      placeholder="SM-S921B"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Descripción</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  {editError && (
                    <p className="text-sm text-red-600">{editError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleEditSave}
                      disabled={editSaving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {editSaving ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h1 className="text-xl font-bold text-gray-800">
                    {product.brand?.name} {product.model_name}
                  </h1>
                  {product.model_code && (
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">Código: {product.model_code}</p>
                  )}
                  {product.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{product.description}</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate('/admin/products')}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-md"
            >
              Volver
            </button>
            {isAdmin && !editing && (
              <button
                onClick={startEditing}
                className="text-sm px-3 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-md"
              >
                Editar
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setShowModal(true)}
                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700"
              >
                + Nueva Variante
              </button>
            )}
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {product.is_active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-800">{product.variants.length}</p>
            <p className="text-xs text-gray-500">Variantes</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${totalStock > 0 ? 'text-green-600' : 'text-red-500'}`}>
              {totalStock}
            </p>
            <p className="text-xs text-gray-500">En stock</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-800">
              {product.variants.filter((v) => v.stock_count > 0).length}
            </p>
            <p className="text-xs text-gray-500">Variantes con stock</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-800 truncate">{formatPrice(totalValue)}</p>
            <p className="text-xs text-gray-500">Valor en stock</p>
          </div>
        </div>
      </div>

      {/* Variants */}
      {product.variants.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
          No hay variantes para este producto
        </div>
      ) : (
        <div className="space-y-3">
          {product.variants.map((variant) => {
            const isExpanded = expandedVariant === variant.id;
            const inventory = inventoryCache[variant.id];
            const stockLevel = variant.stock_count === 0 ? 'empty' : variant.stock_count <= 3 ? 'low' : 'ok';
            const borderColor = stockLevel === 'empty' ? 'border-red-200' : stockLevel === 'low' ? 'border-yellow-200' : 'border-gray-200';

            return (
              <div key={variant.id} className={`bg-white rounded-lg shadow border-l-4 ${
                stockLevel === 'empty' ? 'border-l-red-500' : stockLevel === 'low' ? 'border-l-yellow-500' : 'border-l-green-500'
              } ${borderColor} ${!variant.is_active ? 'opacity-60' : ''}`}>
                {/* Variant header */}
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row justify-between gap-3">
                    {/* Left: variant info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-800">{variant.storage_gb}GB</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {variant.color}
                        </span>
                      </div>

                      {/* Prices */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span className="text-gray-500">
                          Venta: <span className="font-semibold text-gray-800">{formatPrice(variant.sale_price_cents)}</span>
                        </span>
                        {isAdmin && variant.cost_price_cents && (
                          <span className="text-gray-500">
                            Costo: <span className="font-semibold text-gray-800">{formatPrice(variant.cost_price_cents)}</span>
                          </span>
                        )}
                        {isAdmin && variant.cost_price_cents && (
                          <span className="text-gray-400">
                            Margen: <span className="font-semibold text-green-600">
                              {Math.round(((variant.sale_price_cents - variant.cost_price_cents) / variant.sale_price_cents) * 100)}%
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: stock + actions */}
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        stockLevel === 'empty' ? 'bg-red-100 text-red-700' :
                        stockLevel === 'low' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {variant.stock_count > 0 ? `${variant.stock_count} en stock` : 'Sin stock'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => toggleInventory(variant.id)}
                      className="text-sm px-3 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      {isExpanded ? 'Ocultar IMEIs' : `Ver IMEIs (${variant.stock_count})`}
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => navigate(`/admin/stock-intake/${variant.id}`)}
                          className="text-sm px-3 py-1 rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50"
                        >
                          + Agregar Stock
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* IMEI table */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 rounded-b-lg overflow-x-auto">
                    {loadingInventory && !inventory ? (
                      <div className="p-4 text-sm text-gray-400">Cargando IMEIs...</div>
                    ) : !inventory || inventory.length === 0 ? (
                      <div className="p-4 text-sm text-gray-400">No hay IMEIs registrados</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-100 text-gray-500">
                            <th className="text-left py-2 px-4 font-medium">IMEI Principal</th>
                            <th className="text-left py-2 px-4 font-medium">IMEI Secundario</th>
                            <th className="text-left py-2 px-4 font-medium">Estado</th>
                            {isAdmin && <th className="text-left py-2 px-4 font-medium">Acción</th>}
                            <th className="text-left py-2 px-4 font-medium">Registrado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {inventory.map((item) => {
                            const transitions = isAdmin ? availableTransitions(item.status) : [];
                            return (
                              <tr key={item.id} className="hover:bg-white">
                                <td className="py-2 px-4 font-mono font-medium">{item.imei1}</td>
                                <td className="py-2 px-4 font-mono">
                                  {item.imei2 ? (
                                    <span className="text-gray-700">{item.imei2}</span>
                                  ) : (
                                    <span className="text-gray-400 italic">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-4">
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor(item.status)}`}>
                                    {statusLabel(item.status)}
                                  </span>
                                </td>
                                {isAdmin && (
                                  <td className="py-2 px-4">
                                    {transitions.length > 0 ? (
                                      <select
                                        className="text-xs border border-gray-300 rounded px-1.5 py-1"
                                        defaultValue=""
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            handleStatusChange(item.id, e.target.value, variant.id);
                                            e.target.value = '';
                                          }
                                        }}
                                      >
                                        <option value="" disabled>Cambiar...</option>
                                        {transitions.map((t) => (
                                          <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                )}
                                <td className="py-2 px-4 text-gray-400">
                                  {new Date(item.created_at).toLocaleDateString('es-CO')}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && !editing && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="text-sm px-4 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg"
          >
            Eliminar Producto
          </button>
        </div>
      )}

      {/* Modal: Nueva Variante */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">Nueva Variante</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Almacenamiento (GB)</label>
                <input type="number" value={form.storage_gb} onChange={(e) => setForm({ ...form, storage_gb: e.target.value })} placeholder="ej: 128" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <input type="text" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="ej: Azul" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio de venta</label>
                <input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} placeholder="ej: 15000000" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio de costo <span className="text-gray-400">— opcional</span></label>
                <input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} placeholder="ej: 12000000" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
            </div>
            {error && <div className="mt-4 bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowModal(false); setError(''); }} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancelar</button>
              <button onClick={handleCreateVariant} disabled={saving || !form.storage_gb || !form.color || !form.sale_price} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Eliminar producto</h3>
            <p className="text-sm text-gray-600 mb-4">
              ¿Estás seguro de eliminar <strong>{product?.brand?.name} {product?.model_name}</strong>?
              El producto se desactivará y no aparecerá en el catálogo.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
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
    </div>
  );
}
