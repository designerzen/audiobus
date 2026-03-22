// YOSHIMI WAM Processor
// Jari Kleimola 2018-19 (jari@webaudiomodules.org)

class YOSHIMIAWP extends AudioWorkletGlobalScope.WAMProcessor
{
  constructor(options) {
    let awgs = AudioWorkletGlobalScope;
    awgs.WAM = awgs.WAM || {}
    awgs.WAM.YOSHIMI = awgs.WAM.YOSHIMI || { ENVIRONMENT: "WEB" };
    awgs.WAM.YOSHIMI.wasmBinary = new Uint8Array(options.processorOptions.wasm);
    eval(options.processorOptions.js);

    options.mod = AudioWorkletGlobalScope.WAM.YOSHIMI;
    super(options);
    this.numOutChannels = [2];
  }
}

registerProcessor("YOSHIMI", YOSHIMIAWP);
