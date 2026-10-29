import { installSiONAudio } from './SiONAudioHost.js';
/** Load the complete SiON engine. Supplying a context enables its playback APIs. */
export async function loadSiON(context, destination) {
    const library = await import('./sion/index.js');
    const { runtime } = await import('./sion/runtime.js');
    const audio = context ? installSiONAudio(context, runtime, destination) : undefined;
    return { ...library, audio };
}
