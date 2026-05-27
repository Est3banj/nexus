import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { formatPrice } from '../../lib/format';

// ─── Tipos ───────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────
function parseImeis(text: string): Array<{ imei1: string; imei2?: string }> {
  return text
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
}

// ─── Componente ──────────────────────────────────────────
export function AddArticlePage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  // ── Estado del producto ──
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
  const [imeiErrors, setImeiErrors] = useState<{ variant: string; imei1: string; imei2?: string; error: string }[]>([]);

  // ── Estado del formulario de variante ──
  const [vStorage, setVStorage] = useState('');
  const [vColor, setVColor] = useState('');
  const [vSalePrice, setVSalePrice] = useState('');
  const [vCostPrice, setVCostPrice] = useState('');
  const [vImeis, setVImeis] = useState('');

  // ── Refs ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
    } catch { /* silencio */ }
  }

  // ── Variants ──
  function addVariant() {
    if (!vStorage || !vColor.trim() || !vSalePrice) return;

    const items = parseImeis(vImeis);
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

  // ── Image ──
  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      setError('Formato no válido. Solo se aceptan JPG, PNG y WebP.');
      e.target.value = '';
      return;
    }

    if (file.size > maxSize) {
      setError('La imagen es demasiado grande. El tamaño máximo es 5MB.');
      e.target.value = '';
      return;
    }

    setError('');
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

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!modelName.trim()) { setError('El nombre del modelo es requerido'); return; }
    if (!brandId && !newBrandName.trim()) { setError('Seleccione una marca o ingrese una nueva'); return; }
    if (variants.length === 0) { setError('Debe agregar al menos una variante'); return; }

    try {
      setSaving(true);
      setImeiErrors([]);

      let mainImageUrl = '';
      if (imageFile) {
        setImageUploading(true);
        try {
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
          if (!uploadRes.ok) {
            const errorBody = await uploadRes.text();
            console.error('Upload failed:', uploadRes.status, errorBody);
            throw new Error(`Error al subir la imagen (${uploadRes.status}): ${errorBody || 'Error desconocido'}`);
          }
          const uploadData = await uploadRes.json();
          mainImageUrl = uploadData.url;
        } finally {
          setImageUploading(false);
        }
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
      if (brandId) payload.brand_id = brandId;
      else if (newBrandName.trim()) payload.new_brand = newBrandName.trim();

      const response = await fetch('/api/products/full', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al crear el artículo');

      if (data.imei_errors?.length > 0) setImeiErrors(data.imei_errors);
      setSuccess(data.summary || 'Artículo creado exitosamente');
      if (data.product?.id) {
        setTimeout(() => navigate(`/admin/products/${data.product.id}`), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  // ── Previsualización de precio en tiempo real ──
  const salePricePreview = vSalePrice
    ? formatPrice(Math.round(parseFloat(vSalePrice || '0') * 100))
    : null;
  const costPricePreview = vCostPrice
    ? formatPrice(Math.round(parseFloat(vCostPrice || '0') * 100))
    : null;

  // ── Render ──
  return (
    <form ref={formRef} onSubmit={handleSubmit} className="max-w-4xl space-y-6 pb-24">
      {/* ═══ Notificaciones ═══ */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <span>✅</span> {success} — Redirigiendo...
        </div>
      )}
      {imeiErrors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
            <span>⚠️</span> {imeiErrors.length} IMEI(s) no se pudieron registrar:
          </p>
          <ul className="text-sm text-amber-700 space-y-1 ml-7 list-disc">
            {imeiErrors.map((e, i) => (
              <li key={i}>
                <span className="font-mono">{e.imei1}</span>{e.imei2 ? `, ${e.imei2}` : ''} — {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ═══ 1. Información del Producto ═══ */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</span>
          <h2 className="font-semibold text-gray-800">Información del Producto</h2>
        </div>
        <div className="p-6 space-y-5">
          {/* Marca */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Marca <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={brandId}
                onChange={(e) => { setBrandId(e.target.value); if (e.target.value) setShowNewBrand(false); }}
                className={`flex-1 px-3 py-2.5 border rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${showNewBrand ? 'bg-gray-100' : 'bg-white'}`}
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
                  if (!showNewBrand) { setBrandId(''); setNewBrandName(''); }
                }}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  showNewBrand
                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {showNewBrand ? 'Cancelar' : '+ Nueva'}
              </button>
            </div>
            {showNewBrand && (
              <div className="mt-2">
                <input
                  type="text"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="Nombre de la nueva marca"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Modelo + Código en grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre del modelo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="ej: Galaxy S24 Ultra"
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Código <span className="text-gray-400">— opc.</span>
              </label>
              <input
                type="text"
                value={modelCode}
                onChange={(e) => setModelCode(e.target.value)}
                placeholder="SM-S921B"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Descripción <span className="text-gray-400">— opcional</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Especificaciones, notas, características destacadas..."
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
        </div>
      </section>

      {/* ═══ 2. Foto del Producto ═══ */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">2</span>
          <h2 className="font-semibold text-gray-800">Foto del Producto</h2>
          <span className="text-xs text-gray-400 ml-auto">Opcional</span>
        </div>
        <div className="p-6">
          {imagePreview ? (
            /* Preview con overlay */
            <div className="relative inline-block">
              <div className="w-48 h-48 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <button
                type="button"
                onClick={clearImage}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-red-600 shadow-md transition-colors"
              >
                ✕
              </button>
              <p className="text-xs text-gray-400 mt-2 text-center">Click ✕ para cambiar</p>
            </div>
          ) : (
            /* Opciones de carga */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 px-6 py-8 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group"
              >
                <svg className="w-10 h-10 text-gray-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-600 group-hover:text-blue-600 transition-colors">Subir desde dispositivo</span>
                <span className="text-xs text-gray-400">o tomar foto</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageFile}
                className="hidden"
              />

              <div className="flex flex-col justify-center gap-2">
                <label className="text-sm text-gray-500">O pegar URL externa</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    onBlur={handleImageUrl}
                    placeholder="https://drive.google.com/..."
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleImageUrl}
                    disabled={!imageUrl.trim()}
                    className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-40 transition-colors font-medium"
                  >
                    Cargar
                  </button>
                </div>
                <p className="text-xs text-gray-400">Google Drive, Dropbox, imágenes online</p>
              </div>
            </div>
          )}
          {imageUploading && (
            <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
              Subiendo imagen...
            </div>
          )}
        </div>
      </section>

      {/* ═══ 3. Variantes ═══ */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">3</span>
          <h2 className="font-semibold text-gray-800">Variantes</h2>
          {variants.length > 0 && (
            <span className="ml-auto text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium">
              {variants.length} agregada{variants.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="p-6 space-y-5">
          {/* Lista de variantes ya agregadas */}
          {variants.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Variantes agregadas</p>
              {variants.map((v) => (
                <div
                  key={v.key}
                  className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 px-5 py-4 hover:shadow-sm transition-shadow group"
                >
                  <div className="flex items-center gap-4">
                    {/* Indicador de color visual */}
                    <div
                      className="w-8 h-8 rounded-lg border border-gray-200 flex-shrink-0"
                      style={{ backgroundColor: v.color.toLowerCase() === 'negro' ? '#1a1a1a' : v.color.toLowerCase() === 'blanco' ? '#f5f5f5' : v.color.toLowerCase() === 'azul' ? '#3b82f6' : v.color.toLowerCase() === 'gris' ? '#6b7280' : v.color.toLowerCase() === 'plateado' ? '#d1d5db' : '#e5e7eb' }}
                      title={v.color}
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {v.storage_gb}GB <span className="font-normal text-gray-500">— {v.color}</span>
                      </p>
                      <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                        <span>Venta: <span className="font-medium text-gray-600">{formatPrice(v.sale_price_cents)}</span></span>
                        {v.cost_price_cents && (
                          <span>Costo: <span className="font-medium text-gray-600">{formatPrice(v.cost_price_cents)}</span></span>
                        )}
                        {v.items.length > 0 && (
                          <span className="text-blue-500">{v.items.length} IMEI{v.items.length !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVariant(v.key)}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-sm font-medium"
                    title="Eliminar variante"
                  >
                    ✕ Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Formulario para agregar variante */}
          <div className="border border-gray-200 rounded-xl p-5 bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">+</span>
              Agregar nueva variante
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Almacenamiento (GB)</label>
                <input
                  type="number"
                  value={vStorage}
                  onChange={(e) => setVStorage(e.target.value)}
                  placeholder="128"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Color</label>
                <input
                  type="text"
                  value={vColor}
                  onChange={(e) => setVColor(e.target.value)}
                  placeholder="Azul"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {salePricePreview && (
                  <p className="text-xs text-green-600 mt-0.5">{salePricePreview}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Precio costo <span className="text-gray-300">— opc.</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={vCostPrice}
                  onChange={(e) => setVCostPrice(e.target.value)}
                  placeholder="12000000"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {costPricePreview && (
                  <p className="text-xs text-gray-400 mt-0.5">{costPricePreview}</p>
                )}
              </div>
            </div>

            {/* IMEIs iniciales */}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1.5">
                IMEIs iniciales <span className="text-gray-300">— opcional, un IMEI por línea (IMEI1, IMEI2)</span>
              </label>
              <textarea
                value={vImeis}
                onChange={(e) => setVImeis(e.target.value)}
                placeholder={'123456789012345, 987654321098765\n490154203237518'}
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
              {vImeis.trim() && (
                <p className="text-xs text-gray-400 mt-1">
                  {parseImeis(vImeis).length} dispositivo(s) detectado(s)
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={addVariant}
              disabled={!vStorage || !vColor.trim() || !vSalePrice}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              + Agregar esta variante
            </button>
          </div>
        </div>
      </section>

      {/* ═══ Sticky Action Bar ═══ */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-6 py-4 z-40">
        <div className="max-w-4xl mx-auto flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/products')}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || variants.length === 0 || !modelName.trim() || (!brandId && !newBrandName.trim())}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Creando...
              </>
            ) : (
              'Crear Artículo'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
