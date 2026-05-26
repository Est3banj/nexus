import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface VariantDetail {
  id: string;
  storage_gb: number;
  color: string;
  product: { model_name: string; brand: { name: string } };
}

export function StockIntakePage() {
  const { variantId } = useParams<{ variantId: string }>();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [variant, setVariant] = useState<VariantDetail | null>(null);
  const [imeiInput, setImeiInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    message: string;
    inserted: number;
    errors?: { imei1: string; imei2?: string; error: string }[];
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchVariant();
  }, [variantId]);

  async function fetchVariant() {
    try {
      // Obtenemos el producto al que pertenece esta variante
      // Primero obtenemos el variant detail para saber el product_id
      const res = await fetch('/api/variants/' + variantId, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error('Error al cargar variante');
      const data = await res.json();
      setVariant(data.variant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items = imeiInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(',').map((p) => p.trim());
        if (parts.length >= 2 && parts[1]) {
          return { imei1: parts[0], imei2: parts[1] };
        }
        return { imei1: parts[0] };
      });

    if (items.length === 0) return;

    try {
      setSaving(true);
      setResult(null);
      setError('');

      const res = await fetch(`/api/variants/${variantId}/intake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ items }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar IMEIs');
      }

      setResult(data);
      if (data.errors?.length === 0) {
        setImeiInput('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      {variant && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-500">Variante</p>
          <p className="font-semibold">
            {variant.product.brand.name} {variant.product.model_name} — {variant.storage_gb}GB {variant.color}
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm">{error}</div>
      )}

      {result && (
        <div className={`p-4 rounded-lg mb-4 ${
          result.errors?.length ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'
        }`}>
          <p className="font-medium">{result.message}</p>
          {result.errors && result.errors.length > 0 && (
            <ul className="mt-2 text-sm space-y-1">
              {result.errors.map((e, i) => (
                <li key={i} className="text-red-600">
                  {e.imei1}{e.imei2 ? `, ${e.imei2}` : ''}: {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          IMEIs <span className="text-gray-400">— IMEI1, IMEI2 por línea</span>
        </label>
        <textarea
          value={imeiInput}
          onChange={(e) => setImeiInput(e.target.value)}
          placeholder={'123456789012345, 987654321098765\n490154203237518'}
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
          disabled={saving}
        />
        <p className="text-xs text-gray-400 mt-1">
          IMEI1, IMEI2 por línea — si el equipo tiene solo 1 IMEI, ponelo solo. Separados por coma.
        </p>

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !imeiInput.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Registrando...' : 'Registrar Stock'}
          </button>
        </div>
      </form>
    </div>
  );
}
