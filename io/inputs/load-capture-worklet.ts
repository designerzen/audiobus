const registrations = new WeakMap<BaseAudioContext, Map<string, Promise<void>>>()

export function loadCaptureWorklet(context: BaseAudioContext, name: string, code: string): Promise<void> {
	let modules = registrations.get(context)
	if (!modules) {
		modules = new Map()
		registrations.set(context, modules)
	}
	const existing = modules.get(name)
	if (existing) return existing

	const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }))
	const registration = Promise.resolve().then(() => context.audioWorklet.addModule(url))
		.catch(error => {
			modules.delete(name)
			throw error
		})
		.finally(() => URL.revokeObjectURL(url))
	modules.set(name, registration)
	return registration
}
