import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ITEM_METADATA_OPTIONS,
  EMPTY_ITEM_METADATA_OPTIONS,
  mergeMetadataOptions,
  parseCommaValues,
  toggleMetadataOption
} from './metadataOptions';

describe('metadata options helpers', () => {
  it('exposes expected default and empty category keys', () => {
    expect(Object.keys(DEFAULT_ITEM_METADATA_OPTIONS).sort()).toEqual(['brand', 'clothing_type', 'color', 'material', 'season'].sort());
    expect(Object.keys(EMPTY_ITEM_METADATA_OPTIONS).sort()).toEqual(['brand', 'clothing_type', 'color', 'material', 'season'].sort());
  });

  it('merges defaults and custom options while preserving order and case-insensitive uniqueness', () => {
    const merged = mergeMetadataOptions(['Nike', 'Adidas'], ['nike', 'Puma', 'ADIDAS', 'Uniqlo']);
    expect(merged).toEqual(['Nike', 'Adidas', 'Puma', 'Uniqlo']);
  });

  it('toggles metadata options in and out of selection', () => {
    const added = toggleMetadataOption(['Black'], 'Blue');
    expect(added).toEqual(['Black', 'Blue']);

    const removed = toggleMetadataOption(['Black', 'Blue'], 'Black');
    expect(removed).toEqual(['Blue']);
  });

  it('parses comma-separated values and removes blanks', () => {
    expect(parseCommaValues(' Black, Blue , ,Green  ,')).toEqual(['Black', 'Blue', 'Green']);
    expect(parseCommaValues(null)).toEqual([]);
  });
});
