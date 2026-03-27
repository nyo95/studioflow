import { DESIGN_SYSTEM_CONFIG } from "../design-system.config";

/**
 * useDesignSystem hook
 * Currently returns the static config, but can be extended 
 * to consume dynamic overrides from a context or database.
 */
export function useDesignSystem() {
  // In the future, this can be wrapped in a Provider 
  // that merges DESIGN_SYSTEM_CONFIG with DB-backed settings.
  return DESIGN_SYSTEM_CONFIG;
}
