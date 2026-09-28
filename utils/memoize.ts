/**
 * Memoize function - caches function results based on arguments
 * Useful for expensive calculations that are called frequently with the same arguments
 */

/**
 * Create a memoized version of a function
 * @param fn - Function to memoize
 * @param keyGenerator - Optional custom key generator for cache (default: JSON.stringify)
 * @returns Memoized function with .clear() method to reset cache
 */
export function memoize<T extends (...args: any[]) => any>(
	fn: T,
	keyGenerator?: (...args: Parameters<T>) => string
): T & { clear: () => void } {
	const cache = new Map<string, any>()

	const memoized = (...args: Parameters<T>): ReturnType<T> => {
		const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args)
		
		if (cache.has(key)) {
			return cache.get(key)
		}

		const result = fn(...args)
		cache.set(key, result)
		return result
	}

	memoized.clear = () => cache.clear()

	return memoized as T & { clear: () => void }
}

/**
 * Memoize with size limit - discards least recently used entries when limit exceeded
 * @param fn - Function to memoize
 * @param maxSize - Maximum cache size (default: 100)
 * @returns Memoized function with .clear() method to reset cache
 */
export function memoizeLRU<T extends (...args: any[]) => any>(
	fn: T,
	maxSize: number = 100
): T & { clear: () => void } {
	const cache = new Map<string, any>()
	const order: string[] = []

	const memoized = (...args: Parameters<T>): ReturnType<T> => {
		const key = JSON.stringify(args)

		if (cache.has(key)) {
			// Move to end (most recently used)
			const index = order.indexOf(key)
			if (index > -1) {
				order.splice(index, 1)
			}
			order.push(key)
			return cache.get(key)
		}

		// Evict least recently used if limit exceeded
		if (cache.size >= maxSize && order.length > 0) {
			const lruKey = order.shift()!
			cache.delete(lruKey)
		}

		const result = fn(...args)
		cache.set(key, result)
		order.push(key)
		return result
	}

	memoized.clear = () => {
		cache.clear()
		order.length = 0
	}

	return memoized as T & { clear: () => void }
}

/**
 * Memoize with TTL (time-to-live) - cache entries expire after specified duration
 * @param fn - Function to memoize
 * @param ttlMs - Time to live in milliseconds
 * @returns Memoized function with .clear() method to reset cache
 */
export function memoizeTTL<T extends (...args: any[]) => any>(
	fn: T,
	ttlMs: number = 5000
): T & { clear: () => void } {
	const cache = new Map<string, { result: any; expires: number }>()

	const memoized = (...args: Parameters<T>): ReturnType<T> => {
		const key = JSON.stringify(args)
		const now = Date.now()

		const cached = cache.get(key)
		if (cached && cached.expires > now) {
			return cached.result
		}

		// Remove expired entry
		if (cached) {
			cache.delete(key)
		}

		const result = fn(...args)
		cache.set(key, {
			result,
			expires: now + ttlMs
		})
		return result
	}

	memoized.clear = () => cache.clear()

	return memoized as T & { clear: () => void }
}
