// YOSHIMI WAM Processor
// Jari Kleimola 2018-19 (jari@webaudiomodules.org)
// Multipart engine: petersalomonsen/yoshimi, GPL-2.0-or-later.
// https://github.com/petersalomonsen/yoshimi/tree/c96fb0324f0cd44f9b2dc5ba80caaeb247c2826a/wam

class YOSHIMIAWP extends AudioWorkletGlobalScope.WAMProcessor
{
  constructor(options) {
    let awgs = AudioWorkletGlobalScope;
    awgs.WAM = awgs.WAM || {}
    awgs.WAM.YOSHIMI = { ENVIRONMENT: "WEB" };
    awgs.WAM.YOSHIMI.wasmBinary = new Uint8Array(options.processorOptions.wasm);
    eval(options.processorOptions.js);

    options.mod = AudioWorkletGlobalScope.WAM.YOSHIMI;
    super(options);
    this.numOutChannels = [2];
  }
}

registerProcessor("YOSHIMI", YOSHIMIAWP);
