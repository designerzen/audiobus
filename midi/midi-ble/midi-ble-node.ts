/**
 * Node JS variant of MIDI over BLE using Noble library
 * NB. this allows for use outside of the browser ecosystem
 */
import {BLUETOOTH_STATE_CHANGED, BLUETOOTH_STATE_CHARACTERISTIC_CHANGED, BLUETOOTH_STATE_DISCOVER_DEVICES, BLUETOOTH_STATE_POWERED_ON} from './ble-constants.ts'

const MIDI_NODE_LOG_PREFIX = '[MIDI-NODE-BLE]'

interface Peripheral {
    uuid: string
    connect(callback: (error: Error | null) => void): void
    discoverSomeServicesAndCharacteristics(
        serviceIds: string[],
        characteristicIds: string[],
        callback: (error: Error | null, services?: any[], characteristics?: any[]) => void
    ): void
}


/**
 * Displays error messages (currently only to console)
 */
const onError = (e: Error): void => {
    console.error(MIDI_NODE_LOG_PREFIX, e, e.message)
}



/**
 * Handle connected peripheral and discover services/characteristics
 * 
 * @param peripheral 
 * @param callback 
 */
const onPeripheralConnected = (peripheral: Peripheral, callback: MidiCallback): void => {
    peripheral.discoverSomeServicesAndCharacteristics(
        MIDI_SERVICE_UUIDS,
        MIDI_CHARACTERISTIC_UUIDS,
        (error, services, characteristics) => {
            if (error) {
                onError(error)
                return null
            }

            console.info( MIDI_NODE_LOG_PREFIX, 'discovered Services', services)
            console.info( MIDI_NODE_LOG_PREFIX, 'discovered Characteristics', characteristics)
          
            if (services && characteristics) {
                return servicesAndCharacteristics(peripheral.uuid, services, characteristics, callback)
            }
        }
    )
}

/**
 * Initialize Noble BLE library with error handlers
 */
export const watchForBlueToothLightStateChange = (): void => {

    noble.on(BLUETOOTH_STATE_CHANGED, (state: string) => {
        console.log( MIDI_NODE_LOG_PREFIX, 'State Change', state)
               
        switch (state )
        {
            case BLUETOOTH_STATE_POWERED_ON:
                break

            default:
                noble.stopScanning()
        }
    })
        
    // catch errors
    noble.on('error', onError)
    // @ts-ignore - accessing private bindings
    noble._bindings.on('error', onError)
}


/**
 * Discover and subscribe to MIDI characteristics
 * 
 * @param _uuid 
 * @param _services 
 * @param characteristics 
 * @param callback 
 */
const servicesAndCharacteristics = (
    _uuid: string,
    _services: any[],
    characteristics: any[],
    callback: MidiCallback
): void => {
    const characteristic = characteristics[0]
    const onData = createBlueToothLightDataReceivedCallback(characteristic.uuid, callback)
    characteristic.addEventListener(BLUETOOTH_STATE_CHARACTERISTIC_CHANGED, (event: any) => onData(event.target.value))
    callback.setCharacteristic(characteristic)
}


/**
 * Handle discovered peripheral and initiate connection
 * 
 * @param peripheral 
 * @param callback 
 * @returns 
 */
const connectPeripheral = (peripheral: Peripheral, callback: MidiCallback): void => {

    if (!peripheral) {
        console.info(MIDI_NODE_LOG_PREFIX, 'No BLE Peripherals discovered.')
        return 
    }
       
    console.info( MIDI_NODE_LOG_PREFIX, 'Connect to BLE peripheral ...')

    peripheral.connect((error: Error | null) => {
        if (error) {
            onError(error)
            return
        }
        console.info( MIDI_NODE_LOG_PREFIX, 'Connected to peripheral', peripheral)
        return onPeripheralConnected(peripheral, callback)
    })
}

/**
 * Start scanning for MIDI BLE peripherals
 *
 * @param callback 
 * @param allowDuplicates 
 */
export const scanForBluetoothPeripherals = (callback: MidiCallback, allowDuplicates:boolean = false): void => { 
    noble.on( BLUETOOTH_STATE_DISCOVER_DEVICES, (peripheral: Peripheral) => {
        console.info( MIDI_NODE_LOG_PREFIX, 'peripheral discovered', peripheral)
        noble.stopScanning()
        connectPeripheral(peripheral, callback)
    })
    noble.startScanning(MIDI_SERVICE_UUIDS, allowDuplicates)
}
