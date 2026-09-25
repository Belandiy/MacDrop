import { DesignModule } from './types';

// Discover all index.tsx files in subfolders of src/renderer/src/designs/
const rawModules = import.meta.glob<{
  default: React.ComponentType<any>;
  name?: string;
  description?: string;
  windowSize?: { width: number; height: number };
}>('./*/index.tsx', { eager: true });

export const availableDesigns: DesignModule[] = Object.entries(rawModules)
  .map(([filePath, mod]) => {
    // Extract folder name: "./classic-native/index.tsx" -> "classic-native"
    const match = filePath.match(/\.\/([^/]+)\/index\.tsx$/);
    const id = match ? match[1] : 'unknown';
    const name = mod.name || id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      id,
      name,
      description: mod.description,
      windowSize: mod.windowSize,
      component: mod.default
    };
  })
  .sort((a, b) => {
    // Keep 'default' or 'classic-native' first
    if (a.id === 'default') return -1;
    if (b.id === 'default') return 1;
    return a.name.localeCompare(b.name);
  });

export function getDesignById(id: string): DesignModule {
  return availableDesigns.find((d) => d.id === id) || availableDesigns[0];
}

export * from './types';
