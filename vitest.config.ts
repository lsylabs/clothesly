import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['**/*.ui.test.ts', '**/*.ui.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      all: true,
      include: [
        'src/utils/**/*.ts',
        'src/features/items/metadataOptions.ts',
        'src/services/storagePaths.ts',
        'src/services/itemDetailCacheService.ts',
        'src/services/profileCacheService.ts',
        'src/services/wardrobeDataService.ts'
      ],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 70
      }
    }
  }
});
