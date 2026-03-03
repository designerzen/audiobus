/**
 * Combined exports for IOChainFactory and IOChainManager
 * Provides convenient access to both chain management utilities
 */

export { IOChainFactory, type IOChainFactoryOptions, type IOChainPreset } from "./IO-chain-factory"
export { IOChainManager, type IOChainManagerOptions, EVENT_CHAIN_ADDED, EVENT_CHAIN_REMOVED, EVENT_CHAIN_ACTIVE_CHANGED, EVENT_CHAINS_UPDATED } from "./IO-chain-manager"

// Re-export IOChain for convenience
export { default as IOChain } from "./IO-chain"
