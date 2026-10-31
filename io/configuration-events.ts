/** Value edits still notify persistence and control views, but do not change
 * the device collection or require graph layout / harmony reconstruction. */
export function configurationUpdate(type: string): CustomEvent {
	return new CustomEvent(type, { detail: { configurationOnly: true } })
}
export function isConfigurationUpdate(event?: Event): boolean {
	return (event as CustomEvent | undefined)?.detail?.configurationOnly === true
}