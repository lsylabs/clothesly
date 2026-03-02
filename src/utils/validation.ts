export type ValidationResult = {
  valid: boolean;
  message?: string;
};

export function validateClosetName(name: string): ValidationResult {
  const value = name.trim();
  if (!value) return { valid: false, message: 'Please enter a closet name.' };
  if (value.length < 2) return { valid: false, message: 'Closet name must be at least 2 characters.' };
  if (value.length > 40) return { valid: false, message: 'Closet name must be 40 characters or less.' };
  return { valid: true };
}

export function validatePrice(priceAmount: string): ValidationResult {
  const value = priceAmount.trim();
  if (!value) return { valid: true };
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return { valid: false, message: 'Price must be a valid number.' };
  if (parsed < 0) return { valid: false, message: 'Price cannot be negative.' };
  return { valid: true };
}

export function validateCurrency(priceCurrency: string): ValidationResult {
  const value = priceCurrency.trim();
  if (!value) return { valid: true };
  if (!/^[A-Za-z]{3}$/.test(value)) {
    return { valid: false, message: 'Currency must be a 3-letter code like USD.' };
  }
  return { valid: true };
}

export function validateCustomFieldsJson(text: string): ValidationResult {
  const value = text.trim();
  if (!value) return { valid: true };

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, message: 'Custom fields must be a JSON object.' };
    }
    return { valid: true };
  } catch {
    return { valid: false, message: 'Custom fields must be valid JSON.' };
  }
}

export function validateItemName(name: string): ValidationResult {
  const value = name.trim();
  if (!value) return { valid: false, message: 'Please enter an item name.' };
  if (value.length < 2) return { valid: false, message: 'Item name must be at least 2 characters.' };
  if (value.length > 80) return { valid: false, message: 'Item name must be 80 characters or less.' };
  return { valid: true };
}

