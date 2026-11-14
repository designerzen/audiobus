/**
 * The native MIDI 2 addon is built and shipped by the host (e.g. an Electron app), not by audiobus,
 * so the host supplies how to load it.
 */
let loadAddon: (() => unknown | Promise<unknown>) | undefined

export function setNativeMidiAddonLoader(loader: (() => unknown | Promise<unknown>) | undefined) {
	loadAddon = loader
}

/** Load the addon; rejects when the host has not supplied a loader. */
export async function loadNativeMidiAddon(): Promise<any> {
	if (!loadAddon) {
		throw new Error("No native MIDI addon; call setNativeMidiAddonLoader() first")
	}
	return loadAddon()
}
