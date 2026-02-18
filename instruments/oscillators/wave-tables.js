// import { WAVE_FORM_NAMES_GENERAL_MIDI, WAVE_TABLE_LOCATIONS_GENERAL_MIDI } from "./tables/wave-table-general-midi"
// import { WAVE_FORM_NAMES_GOOGLE, WAVE_TABLE_LOCATIONS_GOOGLE } from "./tables/wave-table-google"
// import { generateImageFromWaveTable, loadWaveTableFromImage } from "./wave-table-utils"

import {OSCILLATORS} from "./synth-oscillator.ts"

// external dependencies
import { unzip, strFromU8 } from 'fflate'

const waveTables = new Map()
const waveTableFileNames = new Map()
const ALL_WAVE_FORM_NAMES = []

const assignWaveTables = (locations, waves, waveMap) => {
    // now try and create a relationship database...
    locations.forEach((waveTableName, index) => {
        // waveTables.set(waveTableName, WAVE_FORM_NAMES[index])
        const noteName = waves[index]
        const nameExpanded = noteName.replaceAll("_", " ")
        waveMap.set(noteName, waveTableName)
        waveMap.set(noteName.toLowerCase(), waveTableName)
        waveMap.set(nameExpanded, waveTableName)
        waveMap.set(nameExpanded.toLowerCase(), waveTableName)
        ALL_WAVE_FORM_NAMES.push(noteName)
        // console.info("waveTableName", waveTableName, WAVE_FORM_NAMES[index] ) 
    })
}

/**
 * Pick from the options above
 * @param {String} waveTableName 
 * @returns 
 */
export const loadWaveTableFromFile = async (waveTableName = TB303) => {
    console.info("Loading wavetable from file", waveTableName ) 
       
    const url = waveTableFileNames.get(waveTableName)
    // we use the names from above...
    const request = await fetch(url)
    // const request = await fetch(`/wave-tables/${waveTableName}`)
    const response = await request.text()
    // firstly remove all new lines and carriage returns
    // and swap out the double quotes with single quotes
    const data = response
        .replaceAll(/(\s|\n|\r)/g, '')
        .replaceAll(/"/g, "'")

    const delimA = /\{('|")real('|"):\[/
    const delimB = /(,)?\],('|")imag('|"):\[/
    const delimC = /(,)?\](,)?\}/ // ]}

    const parts = data.split(delimB)

    // now both real and imag are arrays of string numbers :(
    const part1 = parts[0].replace(delimA, "").split(",")
    // const part1 = parts[0].split(delimA)[1].trim().split(",")
    const part2 = parts[parts.length - 1].replace(delimC, "").split(",")

    // Ensure real/imag arrays are Float32Array for createPeriodicWave
    // convert all these strings into numbers
    const real = new Float32Array(part1.map(Number))
    const imag = new Float32Array(part2.map(Number))

    // create the object
    const waves = { real, imag }

    // GAH, ensure that both arrays have the same length...
    if (real.length !== imag.length) {
        console.error(waveTableName + " Length mismatch real:" + real.length + " imaginary:" + imag.length, { waves, parts, part1, part2, data, real, imag })
        // throw Error(waveTableName + " Length mismatch real:" + real.length + " imaginary:" + imag.length)
        // HACK: just make the arrays the same length
        real.length = imag.length
    }

    console.info("Wave table available:loadWaveTableFromFile", waves)

    waveTables.set(waveTableName, waves)
    return waves
}

export const generateNoiseWave = ( colour="white", numberOfHarmonics = 4096 ) => {
        
    // Array length needs to be numberOfHarmonics + 1 to include the DC component (index 0)
    const arrayLength = numberOfHarmonics + 1

    const real = new Float32Array(arrayLength)
    const imag = new Float32Array(arrayLength)

    // Generally, we don't want a DC offset in our noise signal.
    real[0] = 0
    // The imaginary part for the DC component MUST be 0.
    imag[0] = 0

    // Assign random values to the coefficients for harmonics 1 through N.
    // Math.random() gives [0, 1), so Math.random() * 2 - 1 gives [-1, 1)
    for (let i = 1; i < arrayLength; i++) {
        // Generate random values for phase component (same as white noise)
        const randomReal = Math.random() * 2 - 1
        const randomImag = Math.random() * 2 - 1
        
        // PINK:Calculate the scaling factor for pink noise (Amplitude ~ 1/sqrt(f))
        // PINK: Since frequency is proportional to harmonic number 'i', scale by 1/sqrt(i)
        // BROWN: Calculate the scaling factor for Brown noise (Amplitude ~ 1/f)
        // BROWN: Since frequency is proportional to harmonic number 'i', scale by 1/i
         const scaleFactor = 
            colour === "pink" ? 1 / Math.sqrt(i) :
            colour === "brown" ? 1 / i : 1

        // Apply the scale factor to the random components
        real[i] = randomReal * scaleFactor
        imag[i] = randomImag * scaleFactor
    }

    // Note: We are *not* manually normalizing the coefficients here.
    // By default, audioContext.createPeriodicWave normalizes the resulting
    // waveform so that its peak amplitude is 1.0. Relying on this built-in
    // normalization is usually sufficient and simpler.
    // If you were to set `disableNormalization: true` in createPeriodicWave,
    // you would need to scale these random coefficients down significantly
    // to avoid generating a waveform that clips violently.
    const waveTable = {
        "name": colour + " Noise",
        "midi_number": -1,
        "description":colour + " Noise",
        real, imag
    }

    return waveTable
}


export const loadWaveTableFromJSON = (waveTableURI, waveTableString) => {

    // Ensure real/imag arrays are Float32Array for createPeriodicWave
    const real = new Float32Array(waveTableString.real)
    const imag = new Float32Array(waveTableString.imag)

    if (!waveTableString || !waveTableString.name)
    {
        throw Error("No waveTableString @ "+ waveTableURI )
    }

    // --- Important Constraints ---
    // real[0] must be 0 (DC offset). We ensured this in generation.
    // imag[0] must be 0. We ensured this in generation.
    // The lengths of real and imag must be the same and >= 2.
    if (real.length !== imag.length || real.length < 2) {
        console.error(`Invalid wave data for GM ${waveTableString.gm_number}: ${waveTableString.name}`)
        return null
    }

    // Optional: Explicitly set DC offset and imag[0] to zero just in case
    real[0] = 0
    imag[0] = 0

    const waveTable = {
        "name": waveTableString.name,
        "midi_number": waveTableString.gm_number ?? -1,
        "description": waveTableString.description,
        real, imag
    }

    waveTables.set( waveTableString.name, waveTable)
    // console.error("loading waves from JSON", waveTableURI, waveTables.entries(), {waveTable, waveTables} )
    return waveTable
}

export const loadWaveTableFromJSONFile = async (waveTableURI) => {
    try {
        const response = await fetch(waveTableURI)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        return loadWaveTableFromJSON(waveTableURI, data)
    } catch (e) {
        console.error("Error loading wave table from", waveTableURI, e)
        return null
    }
}

/**
 * Load a wave table from the file system and cache
 * @param {String} waveTableName eg. 001_acoustic_grand_piano.json
 * @returns 
 */
export const loadWaveTable = async (waveTableName = TB303) => {
    // Cache in static Map and load if registered
    if (waveTables.has(waveTableName)) {
        return waveTables.get(waveTableName)
    } else {
        return loadWaveTableFromFile(waveTableName)
    }
}

/**
 * 
 * @returns 
 */
export const getRandomWaveTableName = () => {
    const randomIndex = Math.floor(Math.random() * waveTables.size )
    const allWaves = getAllWaveTables()
    console.error("randomIndex", randomIndex, allWaves )
    return allWaves[randomIndex]
    // return ALL_WAVE_FORM_NAMES[Math.floor(Math.random() * ALL_WAVE_FORM_NAMES.length)]
}

// get all the map's keys
export const getAllWaveTables = () => {
    const p = Array.from(waveTables.keys())
    p.unshift(...OSCILLATORS)
    return p
 } // ALL_WAVE_FORM_NAMES

 
export const getWaveTable =async (timbre) => {

    if (waveTables.has(timbre))
    {
        console.info("Found saved wavetable", timbre, waveTables.get(timbre) )
        return waveTables.get(timbre)
    }

    // check if it is a string and if so, try to load it
    if (typeof timbre === 'string') 
    {
        return loadWaveTable(timbre)
    }

    return timbre
}

/**
 * 
 * @returns 
 */
export const loadRandomWaveTable = async () => {
    return loadWaveTable(getRandomWaveTableName())
}


export const preloadAllWaveTables = async (simultaneous = 3) => {

    for (let i = 0, l = ALL_WAVE_FORM_NAMES.length; i < l; i++) {
        const group = []
        for (let p = 0; p < simultaneous; p++) {
            const name = ALL_WAVE_FORM_NAMES[i]
            if (!name) { break }
            group.push(loadWaveTable(name))
            i++
            console.info("prelaodwave", name, p, i,)
        }
        await Promise.allSettled(group)
    }
}



// Google Wave tables from :
// https://github.com/GoogleChromeLabs/web-audio-samples/blob/main/src/demos/wavetable-synth/index.html
// assignWaveTables(WAVE_TABLE_LOCATIONS_GOOGLE, WAVE_FORM_NAMES_GOOGLE, waveTableNames)
// assignWaveTables(WAVE_TABLE_LOCATIONS_GENERAL_MIDI, WAVE_FORM_NAMES_GENERAL_MIDI, waveTableNames)
// console.info("waveTableNames", {waveTableNames, ALL_WAVE_FORM_NAMES} ) 

/**
 * loadWaveTableFromManifest(GM_MANIFEST)
 * @param {String} manifest GM_MANIFEST
 */
export const loadWaveTableFromManifest = (manifest, folder="/wave-tables/gm_periodic_waves_v5/") => {
    // console.error("GM_MANIFEST", GM_MANIFEST)
    const keys = Object.keys(manifest)
    const waveDataToLoad = keys.map(async (noteName, index) => {

        const noteURI = manifest[noteName]

        // first create the file name to load
        const waveTableFileName = noteName.replaceAll(" ", "")
        const path = folder + noteURI
        const waveTableData = loadWaveTableFromJSONFile(path)

        ALL_WAVE_FORM_NAMES.push(noteName)

        // console.info(noteNumber, "GM",path, {waveTableData, real, imag, noteName, noteName, noteURI, waveTableFileName} ) 
        if (index === keys.length - 1) {
            console.error("waveTables", waveTables)
        }
        return waveTableData
    })

    Promise
        .allSettled(waveDataToLoad)
        .then(results => {
            waveDataToLoad.forEach((waveTableData, index) => {
                const { real, imag } = waveTableData
                const noteNumber = index + 1
                const noteName = keys[index]
                const nameExpanded = noteName.replaceAll("_", " ")

                waveTables.set(noteNumber, waveTableData)
                // waveMap.set(waveTableData.name, waveTableData)
                // waveMap.set(waveTableData.name.toLowerCase(), waveTableData)
                waveTables.set(nameExpanded, waveTableData)
                waveTables.set(nameExpanded.toLowerCase(), waveTableData)
            })

            console.info("results", { results, waveTables })
        })
}

// const attemptToConvertWaveTableIntoImage = async( waveTableName, mimeType="image/png" ) => {
//     const waveTable = await loadWaveTable( waveTableName )
//     const canvas = await generateImageFromWaveTable( waveTable )
//     return canvas.toDataURL(mimeType)
// }

// attemptToConvertWaveTableIntoImage(ALL_WAVE_FORM_NAMES[20] ).then( png => {
//     console.info("png", png)
// })
// // attemptToConvertWaveTableIntoImage(ALL_WAVE_FORM_NAMES[0] )

export const loadWaveTableFromArchive = (waveTableArchiveURI, onProgress) => new Promise( async (resolve, reject) => {
    const fileBuffer = await fetch(waveTableArchiveURI)
    const arrayBuffer = await fileBuffer.arrayBuffer()
    const arrayBufferAsUint8Array = new Uint8Array(arrayBuffer)
    unzip(arrayBufferAsUint8Array, (err, unzipped) => {
        
        if (err)
        {
            reject(err)
            return
        }
        
        const fileNames = Object.keys(unzipped)
   
        const waveTables = [] 
        
        // TODO: multiple streams?
        fileNames.forEach( (fileName, index) => {
            if (fileName !== "manifest.json")
            {
                // Conversion to string and then JSON
                const progress = index / fileNames.length
                const file = unzipped[fileName]

                try{
                    const waveTable = JSON.parse( strFromU8( file ) )
                    const waveTableData = loadWaveTableFromJSON(fileName, waveTable)
                
                    onProgress && onProgress(progress, fileName, waveTable )
                    waveTables.push(waveTableData )

                }catch(error){

                    // likely a JSON parsing error
                    console.error("Error loading wave table", fileName, error)
                }
            }
        })

        resolve( waveTables )
    })
})

export const addNoises = () => {
    waveTables.set( "White Noise",  generateNoiseWave() )
    waveTables.set( "Pink Noise",  generateNoiseWave( "pink" ) )
    waveTables.set( "Brown Noise",  generateNoiseWave( "brown" ) )
}