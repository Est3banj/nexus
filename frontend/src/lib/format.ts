/**
 * Formatea un precio en centavos a pesos colombianos (COP).
 * Ejemplo: 15000000 → $ 15.000.000
 */
export function formatPrice(cents: number): string {
  const amount = cents / 100;
  return amount.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

