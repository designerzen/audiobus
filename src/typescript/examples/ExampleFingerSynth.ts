/// <reference path="../audiobus/Dependencies.ts"/>
module examples
{
	export class ExampleFingerSynth extends Example
	{
		private bass1:audiobus.instruments.basics.SineWave;
		private bass2:audiobus.instruments.basics.SineWave;
		private bass3:audiobus.instruments.basics.SineWave;
		private bass4:audiobus.instruments.basics.SineWave;
		private bass:Array<audiobus.instruments.basics.SineWave>;

		private visualiser:audiobus.visualisation.ExampleVisualiser;

		private lastX:number;
		private lastY:number;
		private lastZ:number;
		private lastMotionTime:Date;

		private shakeThreshold:number = 15; 	// default velocity threshold for shake to register;
		private shakeTimeOut:number = 1000; 	// default interval between events

		// Begin here
		constructor(  )
		{
			super();
			var context:AudioContext = audiobus.Engine.create(window);
			var volume:GainNode = context.createGain();
			//var destination = context.destination;
			//volume.connect( context.destination );

			// Instruments :
			// -----------------------------------------------
            this.bass1 = new audiobus.instruments.basics.SineWave( context, volume );
            this.bass2 = new audiobus.instruments.basics.SineWave( context, volume );
            this.bass3 = new audiobus.instruments.basics.SineWave( context, volume );
            this.bass4 = new audiobus.instruments.basics.SineWave( context, volume );
			this.bass = [ this.bass1,this.bass2, this.bass3, this.bass4 ];


			// Visualisations :
			// -----------------------------------------------
			this.visualiser = new audiobus.visualisation.ExampleVisualiser( context, volume, audiobus.visualisation.SpectrumAnalyzer.TYPE_TIME_DOMAIN );
			this.visualiser.start();

			// Interactions :
			// -----------------------------------------------
			// Attach mouse events
			this.addMouseListeners();

			// Attach touch events
			this.addTouchListeners();

			this.addMotionListeners();
		}


		// EVENT : Some kind of mouse interaction
		public onTouch(e:TouchEvent):void
		{
			super.onTouch(e);

			if (!this.usingTouch)
			{
				// stop touch event
			    return;
			}

            var type:string = e.type;
			var fingers:TouchList = e.touches;

			// loop through fingers here...
			for ( var f:number=0, l=fingers.length; f<l; ++f)
			{
				//console.log( fingers[f] );
				var finger:Touch = fingers[f];
				var percentageY:number = 1 - this.getScreenPercentageY( finger.clientY );
				var percentageX:number = 0.5 + this.getScreenPercentageX( finger.clientX ) - 1;
	            var vibratoRange:number = 220;
	            var note:number = (percentageX * vibratoRange) + (percentageY * 660);
				var instrument = this.bass[f];

				switch(type)
				{
					case "touchstart":
						instrument.start(note);
						break;


					case "touchmove":
						instrument.note(note);
						break;

					case "touchend":
					default:
						instrument.stop();
						break;

				}
			}
		}

		public onMouse(e:MouseEvent):void
		{
			super.onMouse(e);

			var type:string = e.type;
            var percentageY:number = 1 - this.getScreenPercentageY( e.clientY );
			var percentageX:number = 0.5 + this.getScreenPercentageX( e.clientX ) - 1;
            var vibratoRange:number = 220;
            var note:number = (percentageX * vibratoRange) + (percentageY * 660);

			switch(type)
			{
				case "mousedown":
					this.bass1.start(note);
					break;

				case "mouseup":
                    this.bass1.stop();
					this.visualiser.next();
					break;

                default:
				case "mousemove":
					this.bass1.note(note);
					break;

			}
		}

		public onShake():void
		{
			// do something
			this.visualiser.next();
		}

		public onMotion(event:DeviceMotionEvent):void
		{
			var current:DeviceAcceleration = event.accelerationIncludingGravity;

			if ((this.lastX === null) && (this.lastY === null) && (this.lastZ === null))
			{
	            this.lastX = current.x;
	            this.lastY = current.y;
	            this.lastZ = current.z;
	            return;
	        }

			// Accelerometer
			// var aX:number = current.x*1;
			// var aY:number = current.y*1;
			// var aZ:number = current.z*1;

			var deltaX:number = Math.abs(this.lastX - current.x);
			var deltaY:number = Math.abs(this.lastY - current.y);
			var deltaZ:number = Math.abs(this.lastZ - current.z);

			//The following two lines are just to calculate a
			// tilt. Not really needed.
			// xPosition = Math.atan2(aY, aZ);
			// yPosition = Math.atan2(aX, aZ);

	        if (((deltaX > this.shakeThreshold) && (deltaY > this.shakeThreshold)) || ((deltaX > this.shakeThreshold) && (deltaZ > this.shakeThreshold)) || ((deltaY > this.shakeThreshold) && (deltaZ > this.shakeThreshold)))
			{
	            // calculate time in milliseconds since last shake registered
				var currentTime:Date = new Date();
	            var timeDifference:number = currentTime.getTime() - this.lastMotionTime.getTime();

	            if (timeDifference > this.shakeTimeOut)
				{
					// SHAKE JUNT!
	                //window.dispatchEvent(this.event);
					this.onShake();
	                this.lastMotionTime = new Date();
	            }
	        }

	        this.lastX = current.x;
	        this.lastY = current.y;
	        this.lastZ = current.z;
		}

	}
}