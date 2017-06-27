export default class FilterDisplay
{

  private canvas;
  private context;

  private myFrequencyArray:Float32Array;
  private magResponseOutput:Float32Array; // magnitude
  private resolution:number;
  private phaseResponseOutput;

  public get element()
  {
    return this.canvas;
  }

  constructor( width:number, height:number, bars:number=100 )
  {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext("2d");
    canvas.id     = "curves";
    canvas.width  = width;
    canvas.height = height;
    this.canvas = canvas;
    this.context = context;
    this.resolution = bars;

    // Array containing all the frequencies we want to get
    // response for when calling getFrequencyResponse()
    this.myFrequencyArray = new Float32Array(bars);
    // defaults...
    for(var i = 0; i < bars; ++i)
    {
      this.myFrequencyArray[i] = 2000/bars*(i+1);
    }
    // We receive the result in these two when calling
    // getFrequencyResponse()
    this.magResponseOutput = new Float32Array(bars); // magnitude
    this.phaseResponseOutput = new Float32Array(bars);

    //document.body.appendChild(canvas);
  }

  private drawFrequencyResponse (mag, phase)
  {
    const barWidth:number = this.canvas.width / this.resolution;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Magnitude
    this.context.strokeStyle = "white";
    this.context.beginPath();
    for(var frequencyStep = 0; frequencyStep < this.resolution; ++frequencyStep)
    {
      this.context.lineTo(
      frequencyStep * barWidth,
      this.canvas.height - mag[frequencyStep]*this.canvas.height);
    }
    this.context.stroke();

    // Phase
    this.context.strokeStyle = "red";
    this.context.beginPath();

    for(var frequencyStep = 0; frequencyStep < this.resolution; ++frequencyStep)
    {
      this.context.lineTo(
      frequencyStep * barWidth,
      this.canvas.height - (phase[frequencyStep]*90 + 300)/Math.PI);
    }
    this.context.stroke();
  }

  public updateFrequencyResponse ( filter:BiquadFilterNode )
  {
    filter.getFrequencyResponse(
      this.myFrequencyArray,
      this.magResponseOutput,
      this.phaseResponseOutput);
    this.drawFrequencyResponse(this.magResponseOutput, this.phaseResponseOutput);
  }
}
