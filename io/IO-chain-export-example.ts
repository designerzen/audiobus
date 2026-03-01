/**
 * Example usage of IOChain import/export functionality
 * 
 * This demonstrates how to:
 * 1. Export an IOChain to a URL-safe string
 * 2. Store or transmit that string
 * 3. Recreate the same IOChain from the exported string
 */

import IOChain from './IO-chain'
import type { ITimerControl as Timer } from 'netronome'

// Example 1: Basic export/import
function example_basicCloning(timer: Timer) {
    // Create original chain
    const chain1 = new IOChain(timer)
    
    // ... configure chain1 with transformers, inputs, outputs, commands ...
    
    // Export to string
    const exportedString = chain1.exportString()
    console.log('Exported chain:', exportedString)
    console.log('String length:', exportedString.length)
    
    // Create new chain and import the state
    const chain2 = new IOChain(timer)
    chain2.importString(exportedString)
    
    // chain2 now has the same state as chain1
}

// Example 2: Store in URL
function example_storeInUrl(chain: IOChain): string {
    const exported = chain.exportString()
    const url = `https://example.com/playback?state=${exported}`
    return url
}

// Example 3: Retrieve from URL and restore
function example_restoreFromUrl(url: string, timer: Timer): IOChain {
    const params = new URL(url).searchParams
    const exported = params.get('state')
    
    if (!exported) {
        throw new Error('No state parameter in URL')
    }
    
    const chain = new IOChain(timer)
    chain.importString(exported)
    return chain
}

// Example 4: Store in localStorage
function example_saveToLocalStorage(key: string, chain: IOChain): void {
    const exported = chain.exportString()
    localStorage.setItem(key, exported)
}

function example_restoreFromLocalStorage(key: string, timer: Timer): IOChain {
    const exported = localStorage.getItem(key)
    if (!exported) {
        throw new Error(`No saved state found for key: ${key}`)
    }
    
    const chain = new IOChain(timer)
    chain.importString(exported)
    return chain
}

// Example 5: Share chain configuration
function example_shareChainConfiguration(chain: IOChain): void {
    const exported = chain.exportString()
    const shareLink = `https://example.com/share?config=${exported}`
    
    // Copy to clipboard or display for sharing
    console.log('Share this link:', shareLink)
}

/**
 * Key characteristics of the export string:
 * - URL-safe: Can be used directly in URLs, query parameters, or fragments
 * - Compressed: Uses LZ-string compression for smaller size
 * - Base64url encoded: Standard encoding for URL-safe transmission
 * - No special characters: Only alphanumeric, hyphens, and underscores
 * - Self-contained: All data needed to recreate the chain
 * 
 * Serialized data includes:
 * - Version number (for future compatibility)
 * - All options
 * - Transformer configurations
 * - Timer state (BPM, running status, position)
 * - Audio command queue
 */
