///<reference path="../definitions/waa.d.ts" />
///<reference path="Instrument.ts" />
///<reference path="../ISoundControl.ts" />
module audiobus.instruments
{
	// Original Theremin JS Sound by Luke from Femur Design
    export class Theremin extends Instrument implements ISoundControl
    {
		private osc:OscillatorNode;
		
		// create
		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			super( audioContext, outputTo );
			this.create();
		}
		
		private create():void
		{
			// Synthesize!
			this.osc = this.context.createOscillator();
			this.osc.type = 0; // sine wave
			this.osc.connect( this.gain );
			
			this.gain = audioContext.createGain();
			h.volume = a.createGain ? a.createGain() : a.createGainNode(), 
			h.oscVolume = a.createGain ? a.createGain() : a.createGainNode(), 
			h.finalVolume = a.createGain ? a.createGain() : a.createGainNode(), 
			h.scuzzVolume = a.createGain ? a.createGain() : a.createGainNode(),
			h.filter = a.createBiquadFilter(),
			h.delay = a.createDelay ? a.createDelay() : a.createDelayNode(),
			h.feedbackGain = a.createGain ? a.createGain() : a.createGainNode(),
			h.compressor = a.createDynamicsCompressor(), 
			
			
		}
		
		public setFilterFrequency(b):void
		{
			var c = 40,
				e = a.sampleRate / 2,
				f = Math.log(e / c) / Math.LN2,
				g = Math.pow(2, f * (2 / d.clientHeight * (d.clientHeight - b) - 1));
			h.filter.frequency.value = e * g
		}
		
		public start( frequency:number ):void
		{
			//console.log("Sine commencing at f:"+frequency );
			var t:number = this.context.currentTime;
			
			this.osc.frequency.value = frequency;
			//this.osc.frequency.setValueAtTime(1200, t);
			//this.osc.frequency.linearRampToValueAtTime(800, t + 0.005);
			
			//this.gain.gain.cancelScheduledValues( t );
			this.gain.gain.cancelScheduledValues( t );
				
			if ( this.isPlaying )
			{
				// this note is already playing so don't tweak it.
				this.gain.gain.value = .5;
			}else{
				// freshly playing so ADSR it
				//this.gain.gain.value = .5;
				//this.gain.gain.setValueAtTime(0.0001, t);
    			// An exception will be thrown if this value is less than or equal to 0,
				// or if the value at the time of the previous event is less than or equal to 0.
				//this.gain.gain.exponentialRampToValueAtTime( 0.5, t + 0.001 );
				//this.gain.gain.value = .5;
					
				//this.gain.gain.setValueAtTime(0.0000000000001, t);	
				this.gain.gain.exponentialRampToValueAtTime( 0.5, t + this.durationFadeIn );
				
				console.log( 'trying to start '+this.isPlaying+ ' state:' + this.osc.playbackState );
			}
			
			//console.log( 'hasInitialised '+this.hasInitialised+ ' state:' + this.osc.playbackState );
			if ( !this.hasInitialised ) this.osc.start(t);	
			super.start();
		}
		
		public stop():void
		{
			if ( !this.hasInitialised ) return;
			console.log( 'stop playing? '+this.isPlaying + ' state:' + this.osc.playbackState );
			//this.osc.stop( 0 );
			super.stop();
		}
		
	}
	
}

var a, b, c, d, e, f, g, h = {},
	i = !1,
	j = !1,
	k = "#342800",
	l = 1,
	m = 1,
	n = 10,
	o = (-1 !== navigator.userAgent.indexOf("Safari"), window.innerWidth ||
		document.documentElement.clientWidth || document.getElementsByTagName(
			"body")[0]);
return 580 > o ? (l = 1.3, m = 1.3) : 700 > o ? (l = 1.2, m += 1, n +=
	1) : 900 > o ? (l = 1, m += 2, n += 2) : 1070 > o ? (l = 1, m += 3,
	n += 2) : 1200 > o ? (l = 1, m += 3.85, n += 3) : 1400 > o ? (l = 1,
	m += 4.2, n += 4) : (l = 1, m += 4.5, n += 4),
{
	init: function()
	{
		var c = document,
			f = window.AudioContext || window.webkitAudioContext || window.mozAudioContext ||
			window.oAudioContext || window.msAudioContext;
		f ? a = new f : alert(
				"Boo hiss! Sorry but this will not work in your browser. Please upgrade to the latest Chrome or Safari and have another try."
			), c.getElementById("waveform")
			.addEventListener("change", theremin.setWaveform, !1), 
			c.getElementById("delay")
			.addEventListener("input", theremin.sliderChange, !1), 
			c.getElementById("feedback")
			.addEventListener("input", theremin.sliderChange, !1), 
			c.getElementById("scuzzVolume")
			.addEventListener("input", theremin.sliderChange, !1), 
			c.getElementById("mainVolume")
			.addEventListener("input", theremin.sliderChange, !1), 
			d = c.querySelector(".surface"), 
			e = c.querySelector(".finger"), 
			
			h.volume = a.createGain ? a.createGain() : a.createGainNode(), 
			h.oscVolume = a.createGain ? a.createGain() : a.createGainNode(), 
			h.finalVolume = a.createGain ? a.createGain() : a.createGainNode(), 
			h.scuzzVolume = a.createGain ? a.createGain() : a.createGainNode(),
			h.filter = a.createBiquadFilter(),
			h.delay = a.createDelay ? a.createDelay() : a.createDelayNode(),
			h.feedbackGain = a.createGain ? a.createGain() : a.createGainNode(),
			h.compressor = a.createDynamicsCompressor(), 
			
			b = a.createAnalyser(),
			b.smoothingTimeConstant = .85, 
			theremin.updateOutputs(),
			theremin.animateSpectrum(), 
			
			d.addEventListener("mousedown",
				theremin.play, !1), 
				
			d.addEventListener("touchstart", theremin.play, !
				1), c.querySelector(".surface")
			.addEventListener("touchmove", function(a)
			{
				a.preventDefault()
			})
	},
	routeSounds: function()
	{
		var c = document;
		theremin.setWaveform(c.getElementById("waveform")), 
		h.filter.type = "lowpass", 
		h.feedbackGain.gain.value = c.getElementById("feedback").value, 
		h.delay.delayTime.value = c.getElementById("delay").value, 
		h.scuzzVolume.gain.value = c.getElementById("scuzzVolume").value, 
		h.volume.gain.value = .6, 
		h.oscVolume.gain.value = 0, 
		h.finalVolume.gain.value = c.getElementById("mainVolume").value, 
		
		g = a.createOscillator(), 
		g.frequency.value = 400, 
		g.type = "sine", 
		g.connect(h.scuzzVolume), 
		h.scuzzVolume.connect(f.detune),
		
		f = a.createOscillator(), 
		f.connect(h.oscVolume), 
		
		h.oscVolume.connect(h.filter), 
		h.filter.connect(h.compressor), 
		h.filter.connect(h.delay), 
		h.delay.connect(h.feedbackGain),
		h.delay.connect(h.compressor), 
		h.feedbackGain.connect(h.delay),
		h.compressor.connect(h.volume), 
		h.volume.connect(h.finalVolume),
		h.finalVolume.connect(b), 
		
		b.connect(a.destination), 
		
		g.start || (g.start = g.noteOn), 
		g.start(0), 
		f.start || (f.start = f.noteOn),
		f.start(0)
	},
	play: function(a)
	{
		var b, c;
		if (j || (theremin.routeSounds(), j = !0), "touchstart" === a.type)
			i = !0;
		else if ("mousedown" === a.type && i) return;
		b = a.pageX - d.offsetLeft, c = a.pageY - d.offsetTop, h.oscVolume
			.gain.value = 1, f.frequency.value = b * l, theremin.setFilterFrequency(
				c), e.style.webkitTransform = e.style.MozTransform = e.style.msTransform =
			e.style.OTransform = e.style.transform = "translate3d(" + b +
			"px," + c + "px, 0)", e.classList.add("active"), d.addEventListener(
				"touchmove", theremin.effect, !1), d.addEventListener(
				"touchend", theremin.stop, !1), d.addEventListener(
				"touchcancel", theremin.stop, !1), d.addEventListener(
				"mousemove", theremin.effect, !1), d.addEventListener("mouseup",
				theremin.stop, !1)
	},
	stop: function(a)
	{
		var b = a.pageX - d.offsetLeft,
			c = a.pageY - d.offsetTop;
		return "mouseup" === a.type && i ? void(i = !1) : (j && (f.frequency
			.value = b * l, theremin.setFilterFrequency(c), h.oscVolume.gain
			.value = 0), e.classList.remove("active"), d.removeEventListener(
			"mousemove", theremin.effect, !1), d.removeEventListener(
			"mouseup", theremin.stop, !1), d.removeEventListener(
			"touchmove", theremin.effect, !1), d.removeEventListener(
			"touchend", theremin.stop, !1), void d.removeEventListener(
			"touchcancel", theremin.stop, !1))
	},
	effect: function(a)
	{
		var b = a.pageX - d.offsetLeft,
			c = a.pageY - d.offsetTop;
		"mousemove" === a.type && i || (j && (f.frequency.value = b * l,
				theremin.setFilterFrequency(c)), e.style.webkitTransform = e.style
			.MozTransform = e.style.msTransform = e.style.OTransform = e.style
			.transform = "translate3d(" + b + "px," + c + "px, 0)")
	},
	updateOutputs: function()
	{
		var a = document;
		a.getElementById("delay-output")
			.value = Math.round(1e3 * a.getElementById("delay")
				.value) + " ms", a.getElementById("feedback-output")
			.value = Math.round(10 * a.getElementById("feedback")
				.value), a.getElementById("scuzzVolume-output")
			.value = a.getElementById("scuzzVolume")
			.value, a.getElementById("mainVolume-output")
			.value = Math.round(10 * a.getElementById("mainVolume")
				.value)
	},
	setWaveform: function(a)
	{
		var b = a.value || this.value,
			c = ["sine", "square", "sawtooth", "triangle"] || [0, 1, 2, 3];
		f.type = c[b]
	},
	sliderChange: function(a)
	{
		j && (f.stop || (f.stop = f.noteOff), f.stop(0), j = !1, "delay" ===
			a.id ? h.delay.delayTime.value = a.value : "feedback" === a.id ?
			h.feedbackGain.gain.value = a.value : "scuzzVolume" === a.id ?
			h.scuzzVolume.gain.value = a.value : "mainVolume" === a.id && (
				h.mainVolume.gain.value = a.value)), theremin.updateOutputs()
	},
	setFilterFrequency: function(b)
	{
		var c = 40,
			e = a.sampleRate / 2,
			f = Math.log(e / c) / Math.LN2,
			g = Math.pow(2, f * (2 / d.clientHeight * (d.clientHeight - b) -
				1));
		h.filter.frequency.value = e * g
	},


	animateSpectrum: function()
	{
		c = requestAnimationFrame(theremin.animateSpectrum, document.querySelector(
			"canvas")), theremin.drawSpectrum()
	},
	drawSpectrum: function()
	{
		var a, c, d, e, f = document.querySelector("canvas"),
			g = f.getContext("2d"),
			h = o + 30,
			i = h,
			j = h;
		for (f.width = h - 20, f.height = h - 10, g.clearRect(0, 0, i, j),
			g.fillStyle = k, a = new Uint8Array(b.frequencyBinCount), b.getByteFrequencyData(
				a), c = Math.round(i / n), e = 0; c > e; e += 1) d = a[e], g.fillRect(
			n * e * 1.6, j, n, -d * m)
	}
}