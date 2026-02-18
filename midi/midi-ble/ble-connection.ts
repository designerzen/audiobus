// Web Bluetooth BLE connection helpers
// Exports helpers that use the standard Web Bluetooth API available in browsers.
// https://webbluetoothcg.github.io/web-bluetooth/#dom-requestdeviceoptions-optionalservices
// https://www.hangar42.nl/wp-content/uploads/2017/10/BLE-MIDI-spec.pdf

export interface BLERequestOptions {
	// Use a broad shape so we don't depend on exact dom types in all TS configs
	filters?: any[]
	optionalServices?: BluetoothServiceUUID[]
	acceptAll?: boolean
}

export interface CapabilityCharacteristic {
	uuid: string
	/** characteristic properties (flags like read/write/notify) */
 	properties: BluetoothCharacteristicProperties
 	/** optional reference to the actual BluetoothRemoteGATTCharacteristic instance returned from the browser */
	characteristicRef?: BluetoothRemoteGATTCharacteristic
}

export interface CapabilityService {
	uuid: string
	characteristics: CapabilityCharacteristic[]
}

export interface CapabilitiesResult {
	services: CapabilityService[]
}


import { 
	BLE_SERVICE_UUID_DEVICE_INFO, 
	BLE_SERVICE_UUID_MIDI, 
	BLUETOOTH_STATE_CHARACTERISTIC_CHANGED, 
	BLUETOOTH_STATE_GATT_DISCONNECTED, 
	MIDI_CHARACTERISTIC_UUID 
} from "./ble-constants.ts"


// Describe data structures ------------------------------------------

const BLUETOOTH_LOG_PREFIX = '[BLE] '

export const describeCharacteristic = (characteristic: CapabilityCharacteristic | BluetoothRemoteGATTCharacteristic | null | undefined) => {
	if (!characteristic) return null
	// If we've been given a capability wrapper, prefer that
	if ((characteristic as CapabilityCharacteristic).characteristicRef || (characteristic as CapabilityCharacteristic).properties) {
		const capability = characteristic as CapabilityCharacteristic
		return {
			uuid: capability.uuid,
			properties: capability.properties
		}
	}
	// Otherwise assume it's a raw BluetoothRemoteGATTCharacteristic
	const raw = characteristic as BluetoothRemoteGATTCharacteristic
	return {
		uuid: raw.uuid,
		properties: raw.properties
	}
}

// Human readable descriptions
export const describeService = (service: CapabilityService) => {
	return {
		id: service.uuid,
		characteristics: service.characteristics.map((characteristic: CapabilityCharacteristic) => describeCharacteristic(characteristic))
	}
}

/**
 * Describe the device as a human-readable string
 * @param device 
 * @returns {Object}
 */
export const describeDevice = (device:BluetoothDevice) => {
	// .gatt .gatt.connected .id .name
	return {
		connected:device.gatt?.connected ?? false,
		id:device.id,
		name:device.name
	}
}

// Actions & Commands ------------------------------------------

export const hasWebBluetooth = () => (typeof navigator !== 'undefined' && navigator.bluetooth) 

export const extractMIDICharacteristic = (characteristics: CapabilityCharacteristic[]): BluetoothRemoteGATTCharacteristic | undefined  => {
    const found = characteristics.find(c => c.uuid.toLowerCase() === MIDI_CHARACTERISTIC_UUID)
    return found?.characteristicRef
}

/**
 * Request a Bluetooth device from the user and connect to its GATT server.
 * @param options request options: filters | acceptAll, optionalServices
 * @returns an object containing the selected device and connected GATT server
 */
export async function requestBLEConnection(
	options: BLERequestOptions = {}
): Promise<{ device: BluetoothDevice; server: BluetoothRemoteGATTServer }> {
	
	if (!hasWebBluetooth()) {
		throw new Error('Web Bluetooth API not available in this environment')
	}

	const { filters, optionalServices, acceptAll=false } = options
	const requestOptions: any = {}

	if (acceptAll) {
		requestOptions.acceptAllDevices = true
	} else if (filters && filters.length > 0) {
		requestOptions.filters = filters
	} else {
		throw new Error('Either filters or acceptAll must be provided')
	}

	if (optionalServices && optionalServices.length)
	{ 
		requestOptions.optionalServices = optionalServices
	}
	
	// Connect to the Bluetooth device
	console.info( BLUETOOTH_LOG_PREFIX, "Connecting to BLE device with options", requestOptions)
	const device = await navigator.bluetooth.requestDevice(requestOptions)
	if (!device)
	{
		throw new Error('No device selected')
	}

	if (!device.gatt) 
	{
		throw new Error('BLE Device does not support GATT')
	}

	const server = await device.gatt.connect()

	// listen for disconnects
	device.addEventListener(BLUETOOTH_STATE_GATT_DISCONNECTED, onGattDisconnected)
	console.info( BLUETOOTH_LOG_PREFIX, "Connected to BLE device", { device, server })
	
	return { device, server }
}

/**
 * Query services and characteristics from a connected device GATT server.
 * @param server - connected BluetoothRemoteGATTServer
 */
export async function getDeviceCapabilities( server:BluetoothRemoteGATTServer ): Promise<CapabilitiesResult> {

	if (!server || !server.connected)
	{ 
		throw new Error('GATT server not connected')
	}

	const primaryServices:BluetoothRemoteGATTService[] = await server.getPrimaryServices()
	const services:CapabilityService[] = []

	for (const service of primaryServices) {
		const characteristics: BluetoothRemoteGATTCharacteristic[] = await service.getCharacteristics()
		const chars: CapabilityCharacteristic[] = characteristics.map(c => ({ uuid: c.uuid, properties: c.properties, characteristicRef: c }))
		services.push({ uuid: service.uuid, characteristics: chars })
	}

	return { services }
}

/**
 * 
 * @param event 
 */
const onGattDisconnected = (event: Event) => {
	const device = event.target as BluetoothDevice
	console.warn( BLUETOOTH_LOG_PREFIX, 'GATT disconnected from device', describeDevice(device))
	// Additional handling could be added here, e.g., auto-reconnect
	if (device && device.gatt && !device.gatt.connected)
	{
		device.gatt.disconnect()
	}
}

/**
 * Subscribe to characteristic value changes and return an unsubscribe function.
 * The onValue callback receives a DataView of the characteristic value.
 *
 * @param characteristic - BluetoothRemoteGATTCharacteristic to subscribe to
 * @param onValue - callback invoked with the DataView when a value changes
 * @returns a function to stop notifications and remove the handler
 */
export async function watchCharacteristicValueChanges(
	characteristic: BluetoothRemoteGATTCharacteristic,
	onValue: (value: DataView) => void
): Promise<() => Promise<void>> {

	if (!characteristic)
	{ 
		throw new Error('Characteristic required')
	}

	// ensure this characteristic can send notifications/indications
	const props = characteristic.properties
	if (!props) {
		console.error( BLUETOOTH_LOG_PREFIX, 'Characteristic invalid (no properties)', characteristic)
		throw new Error('Characteristic not of correct type')
	}
	if (!props.notify && !props.indicate) {
		// Some platforms don't expose notify/indicate correctly; try subscribing but warn
		console.warn( BLUETOOTH_LOG_PREFIX, 'characteristic has no notify/indicate flags', { uuid: characteristic.uuid, properties: props })
	}

	const handler = (event: Event) => {
		try {
			// Some browsers/platforms set event.target, others set event.currentTarget.
			// Fall back to the original characteristic object if neither is present.
			const ev: any = event as any
			const target = (ev.target ?? ev.currentTarget ?? characteristic) as BluetoothRemoteGATTCharacteristic | undefined
			const value = target && (target.value ?? (characteristic && (characteristic as any).value))
			if (value) {
				onValue(value as DataView)
			} else {
				console.warn( BLUETOOTH_LOG_PREFIX, 'onCharacteristicValueChanged handler: no value in event', { event, target, characteristic })
			}
		} catch (err) {
			// swallow handler errors to avoid breaking notifications
			// eslint-disable-next-line no-console
			console.warn( BLUETOOTH_LOG_PREFIX, 'onCharacteristicValueChanged handler error', err)
		}
	}

	characteristic.addEventListener( BLUETOOTH_STATE_CHARACTERISTIC_CHANGED, handler)
	// attach handler then start notifications; wrap startNotifications to provide clearer error messages
	try {
		await characteristic.startNotifications()
	} catch (e: any) {
		// Normalize error for caller
		const msg = e && e.message ? e.message : String(e)
		// If notifications are not supported, try a single read as a fallback
		if (/not supported/i.test(msg) || (e && e.name === 'NotSupportedError')) {
			console.warn( BLUETOOTH_LOG_PREFIX, 'startNotifications not supported, falling back to readValue once', { uuid: characteristic.uuid, err: msg })
			try {
				const value = await characteristic.readValue()
				if (value) onValue(value)
				// return a noop unsubscribe (there's nothing to stop)
				return async () => Promise.resolve()
			} catch (readErr: any) {
				const rmsg = readErr && readErr.message ? readErr.message : String(readErr)
				throw new Error(`GATT Error (read fallback failed): ${rmsg}`)
			}
		}
		throw new Error(`GATT Error: ${msg}`)
	}

	return async () => {
		try {
			await characteristic.stopNotifications()
		} catch {
			// ignore stop errors
		}
		characteristic.removeEventListener(BLUETOOTH_STATE_CHARACTERISTIC_CHANGED, handler)
	}
}

/**
 * 
 * @param characteristics 
 * @param onData 
 * @returns 
 */
export const watchCharacteristics = async (
	characteristics: CapabilityCharacteristic[],
	onData?: (characteristic: CapabilityCharacteristic, value: DataView) => void
): Promise<Array<() => Promise<void>>> => {
	const unsubscribes: Array<() => Promise<void>> = []
	for (const characteristic of characteristics) {
		const charRef = characteristic.characteristicRef
		console.info( BLUETOOTH_LOG_PREFIX,  'Watching characteristic', characteristic.uuid, 'ref?', !!charRef)
		if (!charRef) {
			console.warn( BLUETOOTH_LOG_PREFIX, 'characteristic has no reference to subscribe to', characteristic)
			continue
		}
		const unsubscribe = await watchCharacteristicValueChanges(charRef, (value: DataView) => {
			console.info( BLUETOOTH_LOG_PREFIX, 'Data received', { characteristic, value })
			if (onData)
			{
				onData(characteristic, value)
			}
		})
		unsubscribes.push(unsubscribe)
	}
	return unsubscribes
}

/**
 * 
 * @param capabilities 
 * @returns 
 */
export const extractCharacteristics = (capabilities:CapabilitiesResult ):CapabilityCharacteristic[] => {
	const services = capabilities.services
	const characteristics = services.map( service => service.characteristics )
	return characteristics.flat()
}


/**
 * 
 * @param capabilities 
 * @returns 
 */
export const listCharacteristics = ( capabilities:CapabilitiesResult ) => {
	const services = capabilities.services
	console.log( BLUETOOTH_LOG_PREFIX, "listCharacteristics", {capabilities, services})
	const output = services.map( service => {
		console.log( BLUETOOTH_LOG_PREFIX, "Service:", service.uuid, service )
		return describeService(service)
	})
	console.log( BLUETOOTH_LOG_PREFIX, "Services:", output )
	return capabilities
}

/**
 * Convenience: request a device using filters and return its capabilities
 * It is set up by default to filter only BLE MIDI devices.
 */
export async function connectToBLEDevice(options: BLERequestOptions = {}): Promise<{ device: BluetoothDevice; server:BluetoothRemoteGATTServer, characteristic:BluetoothRemoteGATTCharacteristic }> {
	
	options = Object.assign( {}, { 
		// don't accept all by default!
		acceptAll: false,
		// instead prefer to filter by devices
		filters:[{
			services: [BLE_SERVICE_UUID_MIDI]
		}],
		optionalServices: [ BLE_SERVICE_UUID_MIDI, BLE_SERVICE_UUID_DEVICE_INFO, '0000180a-0000-1000-8000-00805f9b34fb' ]
	}, options)

	try{
		const { device, server } = await requestBLEConnection(options)
		
		console.log( BLUETOOTH_LOG_PREFIX, "Connecting to BLE device", {options, device, server})
		
		// Use getDeviceCapabilities to discover services and characteristics
		console.log( BLUETOOTH_LOG_PREFIX, "Querying device capabilities...")
		const capabilities = await getDeviceCapabilities(server)
		console.log( BLUETOOTH_LOG_PREFIX, "Device capabilities:", capabilities)
		
		// Extract all characteristics
		const allCharacteristics = extractCharacteristics(capabilities)
		console.log( BLUETOOTH_LOG_PREFIX, "Found characteristics:", allCharacteristics.map(c => c.uuid))
		
		// Try to find MIDI characteristic
		let midiChar = extractMIDICharacteristic(allCharacteristics)
		if (!midiChar && allCharacteristics.length > 0) {
			console.warn( BLUETOOTH_LOG_PREFIX, "MIDI characteristic not found, using first available characteristic")
			midiChar = allCharacteristics[0].characteristicRef
		}
		
		if (!midiChar) {
			throw new Error('No characteristics found on device')
		}
		
		console.log( BLUETOOTH_LOG_PREFIX, "Starting notifications on characteristic", {uuid: midiChar.uuid})
		await midiChar.startNotifications()
		console.log( BLUETOOTH_LOG_PREFIX, "Adding value change listener")
		
		// Add value change listener
      	midiChar.addEventListener(BLUETOOTH_STATE_CHARACTERISTIC_CHANGED, event => {
			console.info( BLUETOOTH_LOG_PREFIX, "BLE device data", {event})
		})
		
		console.info( BLUETOOTH_LOG_PREFIX, "Connected to BLE device", {device, server, characteristic: midiChar.uuid})

		return { device, server, characteristic: midiChar }		

	}catch(error){
		console.error( BLUETOOTH_LOG_PREFIX, "Error connecting to BLE device", error)
	}

	return null
}


/**
 * Disconnect a Bluetooth Low Energy Device if connected
 */
export function disconnectBLEDevice(device: BluetoothDevice | undefined): boolean {
	if (!device){ 
		return false
	}
	try {
		if (device.gatt && device.gatt.connected)
		{
 			device.gatt.disconnect()
			return true
		}
	} catch (err) {
		// eslint-disable-next-line no-console
		console.warn( BLUETOOTH_LOG_PREFIX, 'disconnect error', err)
	}
	return false
}

