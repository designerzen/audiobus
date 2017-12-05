import SpectrumAnalyzer from './SpectrumAnalyzer';

import Bars from './visualisers/Bars';
import Harmongraph from './visualisers/Harmongraph';
import Scope from './visualisers/Scope';
import Plasma from './visualisers/Plasma';
import Visualiser from './visualisers/Visualiser';
import IVisualiser from './visualisers/IVisualiser';

import Colour from './colour/Colour';
import Rainbows from './colour/Rainbows';

export default class ExampleVisualiser
{
  private analyser:SpectrumAnalyzer;

  private harmongraph:Harmongraph;
  private bars:Bars;
  private scope:Scope;
  private plasma:Plasma;

  private visualisers:Array<Visualiser> = [];
  private activeVisualiser:Visualiser;

  private counter:number = 0;
  private count:number = 1;

  private rainbow:Array<Colour>;

  private visualiserCanvas:HTMLCanvasElement;

  public get canvas():HTMLCanvasElement
  {
    return this.visualiserCanvas;
  }

  constructor( audioContext:AudioContext, source:GainNode, type:string=SpectrumAnalyzer.TYPE_FREQUENCY, fftSize:number=1024 )
	{
    this.analyser = new SpectrumAnalyzer( audioContext, type );

    this.visualiserCanvas = this.analyser.createCanvas( window.innerWidth,  window.innerHeight, 'visualiser' );
    this.rainbow = Rainbows.colour();

    this.analyser.connect( audioContext.destination, source );
    this.analyser.setFidelity(fftSize);

    // add our visualissers
    this.harmongraph = new Harmongraph();
    this.harmongraph.red = 0;
    this.harmongraph.green = 255;
    this.harmongraph.blue = 120;
    //this.harmongraph.createCanvas( 512, 512 );
    //this.harmongraph.appendSlave( new Plasma() );
    //this.harmongraph.prependSlave( new Plasma() );
    // now hook into our analyser for updates
    this.analyser.append( this.harmongraph );
    this.visualisers.push( this.harmongraph );


    this.bars = new Bars();
    //this.analyser.append( bars );
    this.visualisers.push( this.bars );


    this.scope = new Scope();
    //this.analyser.append( scope );
    this.visualisers.push( this.scope );

    this.plasma = new Plasma();
    //this.analyser.append( scope );
    this.visualisers.push( this.plasma );


    this.counter = 0;
    this.activeVisualiser = this.visualisers[ this.counter ];
	}


  public start():void
  {
    this.analyser.onanalysis = (spectrum:Uint8Array) => { this.update(spectrum); };
    this.analyser.start();
  }


  public update(spectrum:Uint8Array):void
  {
    // and send the updates to the visualiser
    //console.log(this.activeVisualiser);
    switch (this.activeVisualiser)
    {
      //
      case this.harmongraph:
        const index:number = Math.round( this.count*0.0005 )%255;
        const colour:Colour = this.rainbow[index];

        // recolour
        this.harmongraph.red = colour.red;
        this.harmongraph.green = colour.green;
        this.harmongraph.blue = colour.blue;

        // rotate
        this.harmongraph.zRatio = 1+(this.count++/1208)%1200;
        this.harmongraph.xPhase += 0.0003;//
        this.harmongraph.yPhase += 0.0002;//
        this.harmongraph.zPhase += 0.0001;

        break;

      case this.bars:

        break;

      case this.scope:

        break;
    }
  }

  // Goto the next visualiser!
  public next():void
  {
    this.counter = ( this.counter + 1 ) % this.visualisers.length;
    this.activeVisualiser = this.visualisers[ this.counter ];
    // connect
    this.analyser.solo( this.activeVisualiser );
    console.log( this.counter+"/"+this.visualisers.length+". activeVisualiser",this.activeVisualiser );
  }

}
