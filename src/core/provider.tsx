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
 * Access the Zeroflow context. Falls back to defaults
 * if no provider is present (works standalone).
 */
export function useZeroflowContext(): ZeroflowContextValue {
  const ctx = useContext(ZeroflowContext);
  if (ctx) return ctx;

  // Standalone mode: no provider needed for basic usage
  const measurerCache = new Map<string, ReturnType<typeof createMeasurer>>();
  return {
    config: DEFAULT_CONFIG,
    getMeasurer(font: string) {
      let measurer = measurerCache.get(font);
      if (!measurer) {
        measurer = createMeasurer(font);
        measurerCache.set(font, measurer);
      }
      return measurer;
    },
  };
}
