import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { formatPrice } from '../../lib/format';

interface Brand {
  id: string;
  name: string;
}

interface VariantEntry {
  storage_gb: number;
  color: string;
  sale_price_cents: number;
  cost_price_cents?: number;
  items: Array<{ imei1: string; imei2?: string }>;
  key: number;
}

export function AddArticlePage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  // Estado del producto
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [modelName, setModelName] = useState('');
  const [modelCode, setModelCode] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [variants, setVariants] = useState<VariantEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Estado del formulario de variante
  const [vStorage, setVStorage] = useState('');
  const [vColor, setVColor] = useState('');
  const [vSalePrice, setVSalePrice] = useState('');
  const [vCostPrice, setVCostPrice] = useState('');
  const [vImeis, setVImeis] = useState('');

  useEffect(() => {
    fetchBrands();
  }, []);

  async function fetchBrands() {
    try {
      const res = await fetch('/api/brands', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setBrands(data.brands);
    } catch {
      // silencio
    }
  }

  function addVariant() {
    if (!vStorage || !vColor.trim() || !vSalePrice) return;

    const items = vImeis
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

    const newVariant: VariantEntry = {
      storage_gb: parseInt(vStorage, 10),
      color: vColor.trim(),
      sale_price_cents: Math.round(parseFloat(vSalePrice) * 100),
      cost_price_cents: vCostPrice ? Math.round(parseFloat(vCostPrice) * 100) : undefined,
      items,
      key: Date.now() + Math.random(),
    };

    setVariants([...variants, newVariant]);
    setVStorage('');
    setVColor('');
    setVSalePrice('');
    setVCostPrice('');
    setVImeis('');
  }

  function removeVariant(key: number) {
    setVariants(variants.filter((v) => v.key !== key));
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setImageUrl('');
  }

  function handleImageUrl() {
    if (imageUrl.trim()) {
      setImagePreview(imageUrl.trim());
      setImageFile(null);
    }
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview('');
    setImageUrl('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!modelName.trim()) {
      setError('El nombre del modelo es requerido');
      return;
    }
    if (!brandId && !newBrandName.trim()) {
      setError('Seleccione una marca o ingrese una nueva');
      return;
    }
    if (variants.length === 0) {
      setError('Debe agregar al menos una variante');
      return;
    }

    try {
      setSaving(true);

      // Upload image if present
      let mainImageUrl = '';
      if (imageFile) {
        setImageUploading(true);
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsDataURL(imageFile);
        });

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ image: base64, filename: imageFile.name }),
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          mainImageUrl = uploadData.url;
        }
        setImageUploading(false);
      } else if (imagePreview && imageUrl.trim()) {
        mainImageUrl = imageUrl.trim();
      }

      const payload: any = {
        model_name: modelName.trim(),
        model_code: modelCode.trim() || undefined,
        description,
        variants: variants.map((v) => ({
          storage_gb: v.storage_gb,
          color: v.color,
          sale_price_cents: v.sale_price_cents,
          cost_price_cents: v.cost_price_cents,
          items: v.items,
        })),
      };

      if (mainImageUrl) payload.main_image_url = mainImageUrl;

      if (brandId) {
        payload.brand_id = brandId;
      } else if (newBrandName.trim()) {
        payload.new_brand = newBrandName.trim();
      }

      const response = await fetch('/api/products/full', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear el artículo');
      }

      setSuccess(data.summary || 'Artículo creado exitosamente');
      setTimeout(() => navigate(`/admin/products/${data.product.id}`), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {success} — Redirigiendo...
        </div>
      )}

      {/* Sección 1: Producto */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">1. Información del Producto</h2>

        <div className="space-y-4">
          {/* Marca */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
            <div className="flex gap-2">
              <select
                value={brandId}
                onChange={(e) => {
                  setBrandId(e.target.value);
                  if (e.target.value) setShowNewBrand(false);
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                disabled={showNewBrand}
              >
                <option value="">Seleccionar marca...</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setShowNewBrand(!showNewBrand);
                  if (!showNewBrand) {
                    setBrandId('');
                    setNewBrandName('');
                  }
                }}
                className={`px-3 py-2 rounded-md text-sm border ${
                  showNewBrand
                    ? 'bg-red-50 text-red-600 border-red-200'
                    : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {showNewBrand ? 'Cancelar' : '+ Nueva'}
              </button>
            </div>
            {showNewBrand && (
              <input
                type="text"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="Nombre de la nueva marca"
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md"
                autoFocus
              />
            )}
          </div>

          {/* Modelo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del modelo</label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="ej: Galaxy S24 Ultra"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {/* Código de modelo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código de modelo <span className="text-gray-400">— opcional</span>
            </label>
            <input
              type="text"
              value={modelCode}
              onChange={(e) => setModelCode(e.target.value)}
              placeholder="ej: SM-S921B"
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
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      </section>

      {/* Sección de Foto */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Foto del Producto</h2>

        <div className="space-y-4">
          {imagePreview && (
            <div className="relative w-48 h-48 rounded-lg overflow-hidden border border-gray-200">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={clearImage}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
              >
                ×
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <label className="flex-1 flex flex-col items-center gap-2 px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 cursor-pointer">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-gray-500">Subir desde dispositivo</span>
              <span className="text-xs text-gray-400">o tomar foto</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageFile}
                className="hidden"
              />
            </label>

            <div className="flex-1 flex flex-col justify-center">
              <label className="text-sm text-gray-500 mb-1">O pegar URL externa</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onBlur={handleImageUrl}
                  placeholder="https://drive.google.com/..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Google Drive, Dropbox, etc.</p>
            </div>
          </div>

          {imageUploading && (
            <p className="text-sm text-blue-600">Subiendo imagen...</p>
          )}
        </div>
      </section>

      {/* Sección 2: Variantes */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">2. Variantes</h2>

        {/* Lista de variantes ya agregadas */}
        {variants.length > 0 && (
          <div className="mb-4 space-y-2">
            {variants.map((v) => (
              <div key={v.key} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <div className="text-sm">
                  <span className="font-medium">{v.storage_gb}GB</span>
                  <span className="text-gray-500"> — {v.color}</span>
                  <span className="text-gray-400 ml-3">Venta: {formatPrice(v.sale_price_cents)}</span>
                  {v.cost_price_cents && (
                    <span className="text-gray-400 ml-2">Costo: {formatPrice(v.cost_price_cents)}</span>
                  )}
                  {v.items.length > 0 && (
                    <span className="text-blue-500 ml-2">({v.items.length} dispositivo{v.items.length !== 1 ? 's' : ''})</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeVariant(v.key)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Formulario para agregar variante */}
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Agregar variante</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Almacenamiento (GB)</label>
              <input
                type="number"
                value={vStorage}
                onChange={(e) => setVStorage(e.target.value)}
                placeholder="128"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Color</label>
              <input
                type="text"
                value={vColor}
                onChange={(e) => setVColor(e.target.value)}
                placeholder="Azul"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Precio venta</label>
              <input
                type="number"
                step="0.01"
                value={vSalePrice}
                onChange={(e) => setVSalePrice(e.target.value)}
                placeholder="15000000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Precio costo <span className="text-gray-300">— opcional</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={vCostPrice}
                onChange={(e) => setVCostPrice(e.target.value)}
                placeholder="12000000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          {/* IMEIs iniciales */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              IMEIs iniciales <span className="text-gray-300">— opcional, IMEI1,IMEI2 por línea</span>
            </label>
            <textarea
              value={vImeis}
              onChange={(e) => setVImeis(e.target.value)}
              placeholder={'123456789012345, 987654321098765\n490154203237518'}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
            />
          </div>

          <button
            type="button"
            onClick={addVariant}
            disabled={!vStorage || !vColor.trim() || !vSalePrice}
            className="w-full py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 disabled:opacity-40"
          >
            + Agregar esta variante
          </button>
        </div>

        {variants.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">{variants.length} variante{variants.length !== 1 ? 's' : ''} agregada{variants.length !== 1 ? 's' : ''}</p>
        )}
      </section>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => navigate('/admin/products')}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || variants.length === 0 || !modelName.trim() || (!brandId && !newBrandName.trim())}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Creando...' : 'Crear Artículo'}
        </button>
      </div>
    </form>
  );
}
