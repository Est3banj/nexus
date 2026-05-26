import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface Brand {
  id: string;
  name: string;
}

export function AddProductPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [modelName, setModelName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBrands();
  }, []);

  async function fetchBrands() {
    try {
      const res = await fetch('/api/brands', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      setBrands(data.brands);
    } catch {
      // si no carga marcas, el select queda vacío
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brandId || !modelName.trim()) return;

    try {
      setSaving(true);
      setError('');

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          brand_id: brandId,
          model_name: modelName.trim(),
          description: description.trim() || null,
        }),
      });

      if (res.status === 409) {
        throw new Error('Ya existe un producto con ese modelo en esta marca');
      }
      if (!res.ok) throw new Error('Error al crear producto');

      const data = await res.json();
      navigate(`/admin/products/${data.product.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        {/* Marca */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Seleccionar marca...</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Modelo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
          <input
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="ej: iPhone 15 Pro Max"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción <span className="text-gray-400">— opcional</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Especificaciones, notas..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-2 pt-2">
          <Link
            to="/admin/products"
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving || !brandId || !modelName.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Crear Producto'}
          </button>
        </div>
      </form>
    </div>
  );
}
