/**
 * ZeroflowProvider: React context for shared configuration
 * and pretext measurer instances.
 */

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { createMeasurer } from './measure';
import type { ZeroflowConfig } from '../types';

interface ZeroflowContextValue {
  config: Required<ZeroflowConfig>;
  getMeasurer: (font: string) => ReturnType<typeof createMeasurer>;
}

const DEFAULT_CONFIG: Required<ZeroflowConfig> = {
  defaultFont: '16px Inter',
  defaultWidth: 600,
  bufferSize: 8,
  targetFps: 60,
};

const ZeroflowContext = createContext<ZeroflowContextValue | null>(null);

export interface ZeroflowProviderProps {
  children: ReactNode;
  config?: ZeroflowConfig;
}

/**
 * Provider that shares zeroflow configuration and measurer cache
 * across all child components.
 */
export function ZeroflowProvider({ children, config }: ZeroflowProviderProps) {
  const mergedConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [config]
  );

  // Cache measurers by font string
  // Each measurer wraps pretext prepare+layout for a specific font
  const measurerCache = useMemo(() => new Map<string, ReturnType<typeof createMeasurer>>(), []);

  const value = useMemo<ZeroflowContextValue>(
    () => ({
      config: mergedConfig,
      getMeasurer(font: string) {
        let measurer = measurerCache.get(font);
        if (!measurer) {
          measurer = createMeasurer(font);
          measurerCache.set(font, measurer);
        }
        return measurer;
      },
    }),
    [mergedConfig, measurerCache]
  );

  return (
    <ZeroflowContext.Provider value={value}>
      {children}
    </ZeroflowContext.Provider>
  );
}

/**
 * Module-level cache for standalone mode (no Provider).
 * Hoisted here so that prepare() is not re-run on every render.
 * Chenglou: "Do not rerun prepare() for the same text and configs."
 */
const standaloneMeasurerCache = new Map<string, ReturnType<typeof createMeasurer>>();

/**
 * Get a standalone context (no Provider needed).
 * Uses the module-level cache so measurers persist across calls.
 * Exported for testing.
 */
export function getStandaloneContext(): ZeroflowContextValue {
  return {
    config: DEFAULT_CONFIG,
    getMeasurer(font: string) {
      let measurer = standaloneMeasurerCache.get(font);
      if (!measurer) {
        measurer = createMeasurer(font);
        standaloneMeasurerCache.set(font, measurer);
      }
      return measurer;
    },
  };
}

/**
 * Access the Zeroflow context. Falls back to defaults
 * if no provider is present (works standalone).
 */
export function useZeroflowContext(): ZeroflowContextValue {
  const ctx = useContext(ZeroflowContext);
  if (ctx) return ctx;

  // Standalone mode: use module-level cache
  return getStandaloneContext();
}
