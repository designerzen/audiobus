declare module "chiptune3/libopenmpt.worklet.js" {
	interface OpenMPT {
		HEAPU8: Uint8Array
		_malloc(size: number): number
		_free(pointer: number): void
		UTF8ToString(pointer: number): string
		_openmpt_get_supported_extensions(): number
		_openmpt_free_string(pointer: number): void
		_openmpt_module_create_from_memory(
			data: number,
			size: number,
			log: number,
			user: number,
			controls: number
		): number
		_openmpt_module_destroy(module: number): void
		_openmpt_module_set_repeat_count(module: number, repeats: number): void
		_openmpt_module_get_duration_seconds(module: number): number
		_openmpt_module_get_num_channels(module: number): number
		_openmpt_module_get_current_order(module: number): number
		_openmpt_module_get_current_pattern(module: number): number
		_openmpt_module_get_current_row(module: number): number
		_openmpt_module_get_pattern_row_channel_command(
			module: number,
			pattern: number,
			row: number,
			channel: number,
			command: number
		): number
		_openmpt_module_read_float_mono(
			module: number,
			rate: number,
			frames: number,
			output: number
		): number
	}
	export default function createOpenMPT(): Promise<OpenMPT>
}