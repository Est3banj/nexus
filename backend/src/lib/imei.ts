/**
 * Valida un IMEI usando el algoritmo de Luhn.
 * Un IMEI válido tiene 15 dígitos y pasa el checksum de Luhn.
 */
export function validateImei(imei: string): { valid: boolean; error?: string } {
  // 1. Solo dígitos
  if (!/^\d+$/.test(imei)) {
    return { valid: false, error: 'Solo debe contener dígitos' };
  }

  // 2. Exactamente 15 dígitos
  if (imei.length !== 15) {
    return { valid: false, error: 'Debe tener exactamente 15 dígitos' };
  }

  // 3. Checksum de Luhn
  // El dígito verificador está en la última posición (derecha).
  // Empezando desde la derecha, se duplican los dígitos en posiciones pares
  // (contando desde 1 desde la derecha). Para 15 dígitos, eso son los índices
  // impares (1, 3, 5, 7, 9, 11, 13) en 0-indexed desde la izquierda.
  let sum = 0;
  for (let i = 0; i < imei.length; i++) {
    let digit = parseInt(imei[i], 10);
    // Para longitud impar (15), la paridad del índice a duplicar
    // coincide con la paridad de la longitud: i % 2 === length % 2
    if (i % 2 === imei.length % 2) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  if (sum % 10 !== 0) {
    return { valid: false, error: 'IMEI inválido (checksum Luhn no coincide)' };
  }

  return { valid: true };
}

export function validateImeiPair(
  imei1: string,
  imei2?: string
): { valid: boolean; imei1?: string; imei2?: string | null; errors: { field: 'imei1' | 'imei2'; error: string }[] } {
  const errors: { field: 'imei1' | 'imei2'; error: string }[] = [];

  const stripped1 = imei1.trim().replace(/[^0-9]/g, '');
  const result1 = validateImei(stripped1);
  if (!result1.valid) {
    errors.push({ field: 'imei1', error: result1.error! });
  }

  let cleaned2: string | null = null;
  if (imei2 !== undefined && imei2 !== null && imei2.trim().length > 0) {
    cleaned2 = imei2.trim().replace(/[^0-9]/g, '');
    const result2 = validateImei(cleaned2);
    if (!result2.valid) {
      errors.push({ field: 'imei2', error: result2.error! });
    }

    if (result1.valid && result2.valid && stripped1 === cleaned2) {
      errors.push({ field: 'imei1', error: 'imei1 and imei2 must be different' });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, imei1: stripped1, imei2: cleaned2, errors: [] };
}
