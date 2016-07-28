/// <reference path="../audiobus/Dependencies.ts"/>
module examples
{
	export class ExampleDrumKeyboard
	{
		// Instruments
		private drums:audiobus.instruments.DrumMachine;
		private bass:audiobus.instruments.basics.Oscillator;
		//private keyDown:Array<number> = new Array();

		// Timing
		private metronome:audiobus.timing.Metronome;
		private netronome:audiobus.timing.Netronome;

		private harmongraph:audiobus.visualisation.visualisers.Harmongraph;

		// Begin here
		constructor(  )
		{

			var context:AudioContext = audiobus.Engine.create(window);
			var volume:GainNode = context.createGain();
			//var destination = context.destination;
			//volume.connect( context.destination );



			// Instruments :
			// -----------------------------------------------
			// Create a drum kit
			this.drums = new audiobus.instruments.DrumMachine( context, volume );

			// Timing :
			// -----------------------------------------------
			this.netronome = new audiobus.timing.Netronome();
			this.netronome.ontick = (time) => {
	            console.log("tick "+time);
				//square.start( (Math.random()*440)+440 );
				//this.drums.trigger(1);
	        };
			//this.netronome.start( 90 );

			this.metronome = new audiobus.timing.Metronome();
			this.metronome.ontick = (time) => {
	            console.log("tick "+time);
	        };
			// this.netronome.start( 90 );

			/**/
			// Visualisations :
			// -----------------------------------------------
			var analyser:audiobus.visualisation.SpectrumAnalyzer = new audiobus.visualisation.SpectrumAnalyzer( context, audiobus.visualisation.SpectrumAnalyzer.TYPE_TIME_DOMAIN );
			//var analyser:audiobus.visualisation.SpectrumAnalyzer = new audiobus.visualisation.SpectrumAnalyzer( context, audiobus.visualisation.SpectrumAnalyzer.TYPE_FREQUENCY );
			var canvas = analyser.createCanvas( window.innerWidth / 2,  window.innerHeight / 2, 'visualiserjumbo' );
			var rainbow:Array<audiobus.visualisation.colour.Colour> = audiobus.visualisation.colour.Rainbows.colour();
			//var rainbow:Array<audiobus.visualisation.colour.Colour> = audiobus.visualisation.colour.Rainbows.colour(0.3,0.3,0.3, 0,2,4, 230,25);
			//console.error(rainbow);
			this.harmongraph = new audiobus.visualisation.visualisers.Harmongraph();
			this.harmongraph.red = 0;
			this.harmongraph.green = 255;
			this.harmongraph.blue = 120;

			analyser.connect( context.destination, volume );
			analyser.append( this.harmongraph );

			var counter:number = 1;
			analyser.onanalysis = (spectrum:Uint8Array) => {
				// and send the updates to the visualiser
				this.harmongraph.zRatio = 1+(counter++/1208)%1200;
				this.harmongraph.xPhase += 0.0003;//
				this.harmongraph.yPhase += 0.0002;//
				this.harmongraph.zPhase += 0.0001;
				//console.log( "analyser::", spectrum );


				var index:number = Math.round(counter*0.5)%255;
				var colour:audiobus.visualisation.colour.Colour = rainbow[index];
				if (!colour)
				{
					alert('rainbow fail!');
				}
				this.harmongraph.red = colour.red;
				this.harmongraph.green = colour.green;
				this.harmongraph.blue = colour.blue;
	        };
			analyser.start();


			// Interactions :
			// -----------------------------------------------
			// Attach key event
			document.onkeydown = (event:KeyboardEvent) => {
	            this.onKeyDown(event);
	        };
			document.onkeyup = (event:KeyboardEvent) => {
	            this.onKeyUp(event);
	        };
			document.onmousemove = (event:MouseEvent) => {
				this.onMouse(event);
			};
			document.onmousedown = (event:MouseEvent) => {
	            this.onMouse(event);
	        };


			document.onmouseup = (event:MouseEvent) => {
	            this.onMouse(event);
	        };
			document.ontouchstart = (event:TouchEvent) => {
	            this.onTouch(event);
	        };
			document.ontouchmove = (event:TouchEvent) => {
				this.onTouch(event);
			};

			document.ontouchend = (event:TouchEvent) => {
	            this.onTouch(event);
	        };
		}
		// EVENT : Some kind of mouse interaction
		private onTouch(e:TouchEvent)
		{
			var type:string = e.type;
			var touches:TouchList = e.touches;
			switch(type)
			{
				case "touchstart":
					//var randomBeat:number = Math.round(Math.random() * 100 );
					//this.drums.trigger(randomBeat);

					// so we want it so that when played in landscape mode, yoou
					//
					var touch:Touch = touches.item[0];
					var y:number = touch.clientY;
					var fingers:number = 3 * y / (window.innerHeight);
					var finger:number = Math.round( fingers );

					 console.log(e,fingers,finger,y,window.innerHeight);

					 switch(finger)
					{
						case 0:
							this.drums.bassdrum.start( 750 + Math.random() * 100,Math.random() * 100 );
							this.harmongraph.zRatio = Math.random() * 30;
							break;
						case 1:
							this.drums.conga.start( 1200 + Math.random() * 100 );
							this.harmongraph.zRatio = Math.random() * 800;
							break;
						case 2:
							this.drums.snare.start( 2050 + Math.random() * 100 );
							this.harmongraph.zRatio = Math.random() * 1100;
							break;
						case 3:
							this.drums.tom.start( Math.random() * 10 + 55, Math.random() * 20 + 55 );
							this.harmongraph.zRatio = Math.random() * 1800;
							break;
					}

					break;

				case "touchend":

					break;

				case "touchmove":

					break;

			}
		}
		private onMouse(e:MouseEvent)
		{
			var type:string = e.type;
			switch(type)
			{
				case "mousedown":
					//var randomBeat:number = Math.round(Math.random() * 100 );
					//this.drums.trigger(randomBeat);

					// so we want it so that when played in landscape mode, yoou
					var buttonHeight = window.innerHeight * 0.25;
					var y:number = e.clientY ||  e.offsetY;
					var precentageY = y / window.innerHeight;
					var fingers:number = 3 * precentageY;	// we want a number between 0 and 3
					var finger:number = 1+Math.floor( fingers );

					 console.log(e,fingers,finger,precentageY);

					 switch(finger)
				 	{
						case 1:
							this.drums.bassdrum.start( 750 + Math.random() * 100,Math.random() * 100 );
							this.harmongraph.zRatio = Math.random() * 30;
							break;
						case 2:
							this.drums.conga.start( 1200 + Math.random() * 100 );
							this.harmongraph.zRatio = Math.random() * 800;
							break;
						case 3:
							this.drums.snare.start( 2050 + Math.random() * 100 );
							this.harmongraph.zRatio = Math.random() * 1100;
							break;
						case 4:
							this.drums.tom.start( Math.random() * 10 + 55, Math.random() * 20 + 55 );
							this.harmongraph.zRatio = Math.random() * 1800;
							break;
					}

					break;

				case "mouseup":
				//	console.error(e);
					break;

				case "mousemove":
					if (this.harmongraph)
					{
						this.harmongraph.xPhase = 0.6 * e.clientX / window.innerWidth;
						this.harmongraph.yPhase = 0.5 * e.clientY / window.innerHeight;
					}
					break;

			}
		}

		private onKeyDown(e:KeyboardEvent)
		{
			//if (!e)	{ e = window.event; };
			switch( e.keyCode )
			{
				//keyCode 37 is left arrow
				case 37:
					this.drums.trigger(0);
					break;

				case 38:
				//keyCode 38 is up arrow
					this.drums.trigger(6);
					break;

				case 39:
				//keyCode 39 is right arrow
					this.drums.trigger(9);
					break;

				case 40:
				//keyCode 40 is down arrow
					this.drums.tom.start();

					//this.drums.trigger(12);
					break;

				default:
					this.drums.trigger( e.keyCode );
			}
		}

		// EVENT : A User has pressed a key
		private onKeyUp(e:KeyboardEvent)
		{
			//if (!e)	{ e = window.event; };
			switch( e.keyCode )
			{
				default:

			}
		}

	}
}