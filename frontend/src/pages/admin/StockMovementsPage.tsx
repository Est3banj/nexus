import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface Movement {
  id: string;
  movement_type: string;
  quantity: number;
  reference_note: string | null;
  performed_by: string;
  inventory_item_id: string | null;
  created_at: string;
  variant: {
    storage_gb: number;
    color: string;
    product: {
      model_name: string;
      brand: {
        name: string;
      };
    };
  } | null;
}

function movementLabel(type: string) {
  const labels: Record<string, string> = {
    intake: 'Entrada',
    sale: 'Venta',
    warranty_send: 'Envío a Garantía',
    warranty_return: 'Devolución de Garantía',
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

function movementIcon(type: string) {
  const icons: Record<string, string> = {
    intake: '+',
    sale: '→',
    warranty_send: '↗',
    warranty_return: '↩',
    adjustment: '±',
  };
  return icons[type] || '·';
}

export function StockMovementsPage() {
  const { session } = useAuth();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const perPage = 50;

  useEffect(() => {
    fetchMovements();
  }, [page]);

  async function fetchMovements() {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/movements?limit=${perPage}&offset=${page * perPage}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      if (!response.ok) throw new Error('Error al cargar movimientos');
      const data = await response.json();
      setMovements(data.movements);
      setTotal(data.total);
    } catch (err) {
      console.error('Error fetching movements:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('es-DO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const totalPages = Math.ceil(total / perPage);

  return (
    <>
      <p className="text-sm text-gray-500 mb-4">
        {total} movimiento{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : movements.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No hay movimientos registrados</div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 border-b">
                  <th className="text-left py-3 px-4">Fecha</th>
                  <th className="text-left py-3 px-4">Tipo</th>
                  <th className="text-left py-3 px-4">Producto</th>
                  <th className="text-left py-3 px-4">Cant.</th>
                  <th className="text-left py-3 px-4">Nota</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                      {formatDate(m.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${movementColor(m.movement_type)}`}>
                        <span>{movementIcon(m.movement_type)}</span>
                        {movementLabel(m.movement_type)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {m.variant ? (
                        <span>
                          {m.variant.product.brand.name} {m.variant.product.model_name}
                          <span className="text-gray-400"> — {m.variant.storage_gb}GB {m.variant.color}</span>
                        </span>
                      ) : (
                        <span className="text-gray-400">Variante eliminada</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {m.movement_type === 'intake' ? '+' : ''}{m.quantity}
                    </td>
                    <td className="py-3 px-4 text-gray-500 max-w-xs truncate">
                      {m.reference_note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-30"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-500">
                Página {page + 1} de {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-30"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
