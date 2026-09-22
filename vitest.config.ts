import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      'dgram': 'dgram',
      'os': 'os',
      'http': 'http'
    }
  }
});
