/// <reference path="../audiobus/Dependencies.ts"/>
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Example
==============
Abstract    - Simple Tutorials to follow to create your own projects
Description - A series of control mechanisms for handling interaction
Use         - Choose your connection type
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
module examples
{
	export class Example
    {
		public isCurrentlyTouching:boolean = false;
		public isCurrentlyMousePressed:boolean = false;

		public usingTouch:boolean = true;
		public hasTouch:boolean = false;

		constructor(  )
        {

        }

		public getScreenPercentageX( x:number ):number
		{
			return x / window.innerWidth;
		}

		public getScreenPercentageY( y:number ):number
		{
			return y / window.innerHeight;
		}

		public addMotionListeners():boolean
		{
			if (window.DeviceOrientationEvent !== undefined)
			{
		        window.addEventListener("devicemotion", (event:DeviceMotionEvent)=>this.onDeviceMotion(event ), true);
				window.addEventListener("deviceorientation", (event:DeviceOrientationEvent)=>this.onDeviceOrientation( event ), true);
				return true;
			}
			return false;
		}

		public addMouseListeners():boolean
		{
			document.onmousemove = (event:MouseEvent) => { this.onMouse(event); };
			document.onmousedown = (event:MouseEvent) => { this.onMouse(event); };
			document.onmouseup = (event:MouseEvent) => { this.onMouse(event); };
			return true;
		}

		public addTouchListeners():boolean
		{
			document.ontouchstart = (event:TouchEvent) => { this.onTouch(event); };
			document.ontouchmove = (event:TouchEvent) => { this.onTouch(event); };
			document.ontouchend = (event:TouchEvent) => { this.onTouch(event); };
			document.ontouchcancel = (event:TouchEvent) => { this.onTouch(event); };
			return true;
		}

		////////////////////////////////////////////////////////////////////////
		// EVENT : Some kind of mouse interaction
		////////////////////////////////////////////////////////////////////////
		public onMouse(e:MouseEvent):void
		{
			console.log("onMouse",e);
			if (this.hasTouch)
			{
				// should we use touch events or mouse events?
				e.stopPropagation();
			    e.preventDefault();
				return;
			}
			var type:string = e.type;
			switch(type)
			{
				case "mousedown":
					this.isCurrentlyMousePressed = true;
					return this.onMouseDown(e);

				case "mouseup":
					this.isCurrentlyMousePressed = false;
					return this.onMouseUp(e);

                case "mousemove":
					return this.onMouseMove(e);
			}
		}

		public onMouseDown(e:MouseEvent):void
		{

		}

		public onMouseUp(e:MouseEvent):void
		{

		}

		public onMouseMove(e:MouseEvent):void
		{

		}

		////////////////////////////////////////////////////////////////////////
		// EVENT : Touch has occurred
		// NB. We store all of these events for use in your own methods
		////////////////////////////////////////////////////////////////////////
		public onTouch(e:TouchEvent):void
		{
			console.log("onTouch",e);
			if (!this.hasTouch)
			{
				this.hasTouch = true;
			}
			if (!this.usingTouch)
			{
				// stop touch event
			    e.stopPropagation();
			    e.preventDefault();
				return;
			}

            var type:string = e.type;
            switch(type)
			{
				case "touchstart":
					this.isCurrentlyTouching = true;
					return this.onTouchStart(e);


				case "touchmove":
					return this.onTouchMove(e);

				case "touchcancel":
				case "touchend":
				default:
					this.isCurrentlyTouching = false;
					return this.onTouchEnd(e);

			}
		}


		public onTouchStart(e:TouchEvent):void
		{

		}

		public onTouchMove(e:TouchEvent):void
		{

		}

		public onTouchEnd(e:TouchEvent):void
		{

		}

		////////////////////////////////////////////////////////////////////////
		// EVENT : Touch has occurred
		// The physical orientation of the device,
		// expressed as a series of rotations from a local coordinate frame
		////////////////////////////////////////////////////////////////////////
		private onDeviceOrientation(event:DeviceOrientationEvent):void
		{
			/*
			// gamma is the left-to-right tilt in degrees, where right is positive
			var tiltLR = event.gamma;

			// beta is the front-to-back tilt in degrees, where front is positive
			var tiltFB = event.beta;

			// alpha is the compass direction the device is facing in degrees
			var dir = event.alpha;
			*/
			this.onOrientation(event);
		}

		public onOrientation(event:DeviceOrientationEvent):void
		{

		}


		////////////////////////////////////////////////////////////////////////
		// EVENT : Touch has occurred
		// the acceleration of the device, expressed in Cartesian coordinates
		// in a coordinate frame defined in the device.
		// It also supplies the rotation rate of the device about a local coordinate frame.
		private onDeviceMotion(event:DeviceMotionEvent)
		{
			// Accelerometer
			var aX = event.accelerationIncludingGravity.x*1;
			var aY = event.accelerationIncludingGravity.y*1;
			var aZ = event.accelerationIncludingGravity.z*1;
			//The following two lines are just to calculate a
			// tilt. Not really needed.
			// xPosition = Math.atan2(aY, aZ);
			// yPosition = Math.atan2(aX, aZ);
		}

		public onMotion(event:DeviceMotionEvent):void
		{

		}
    }
}