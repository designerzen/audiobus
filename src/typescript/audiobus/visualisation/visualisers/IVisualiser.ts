interface IVisualiser
{
    update( spectrum:Uint8Array, time:number, bufferLength:number ):void;
}