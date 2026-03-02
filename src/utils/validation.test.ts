import { describe, expect, it } from 'vitest';

import {
  validateClosetName,
  validateCurrency,
  validateCustomFieldsJson,
  validateItemName,
  validatePrice
} from './validation';

describe('validation utilities', () => {
  it('rejects empty closet names', () => {
    expect(validateClosetName('').valid).toBe(false);
  });

  it('accepts valid closet names', () => {
    expect(validateClosetName('Formal').valid).toBe(true);
  });

  it('rejects invalid item names', () => {
    expect(validateItemName('a').valid).toBe(false);
  });

  it('accepts positive numeric prices', () => {
    expect(validatePrice('49.95').valid).toBe(true);
  });

  it('rejects negative prices', () => {
    expect(validatePrice('-1').valid).toBe(false);
  });

  it('rejects invalid currency codes', () => {
    expect(validateCurrency('US').valid).toBe(false);
    expect(validateCurrency('USDD').valid).toBe(false);
  });

  it('accepts valid currency codes', () => {
    expect(validateCurrency('USD').valid).toBe(true);
  });

  it('accepts empty custom fields and JSON object', () => {
    expect(validateCustomFieldsJson('').valid).toBe(true);
    expect(validateCustomFieldsJson('{"fit":"relaxed"}').valid).toBe(true);
  });

  it('rejects non-object or invalid custom JSON', () => {
    expect(validateCustomFieldsJson('[]').valid).toBe(false);
    expect(validateCustomFieldsJson('{bad').valid).toBe(false);
  });
});

