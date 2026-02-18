// @ts-nocheck
/**
 * This is a Sequence containing all Audio Commands
 * and a series of super helpful methods to read them
 * and ultimately let you fetch data from parts of a track
 */
export default class AudioTrack
{
	// :Array<MIDICommands>
	tracks = []
	commands = []
	instruments = []
	noteOnCommands = []

	trackName = ""
	meta = ""
	copyrightNotice = "Copyright held by respective owners"
	lyrics = ""

	trackPosition = 0
	commandPosition = 0
	duration = 0

	mimeType = "audio/"

	firstCommand = null
	finalCommand = null

	get ticksPerBeat(){
		// return 
	}

	get tempo(){
		
	}

	get timeSignature(){
		return [4,4]
	}

	get name() {
		return this.trackName
	}

	getMatchingCommands( types=[MIDICommands.COMMAND_NOTE_ON], type="channel" )
	{
		// check if array or string and if string make array
		if (typeof types === String)
		{
			types = [types]
		}
		return this.commands.filter( value => {
			//console.log("getMatchingCommands",value.type === type,value)
			
			if (value.type === type)
			{
				const typePosition = types.indexOf(value.subtype)
				//console.log("typePosition > -1", typePosition > -1, types, value.subType)
				return typePosition > -1
			}else{
				//console.log("getMatchingCommands",value.type,value)
			}
			
			return false
		})
	}

	getNextNoteCommand(){

		const commands = []
		let track = this.tracks[++this.trackPosition]
		while ( track && track.subtype !== MIDICommands.COMMAND_NOTE_ON || track.subtype !== MIDICommands.COMMAND_NOTE_OFF  )
		{
			track = this.tracks[++this.trackPosition]
		}

		while ( track && ( track.subtype === MIDICommands.COMMAND_NOTE_ON || track.subtype === MIDICommands.COMMAND_NOTE_OFF )  )
		{
			commands.push(track)
			track = this.tracks[++this.trackPosition]
		}
		
		return commands
	}

	getNextNoteOnCommand(){

		const commands = []
		let track = this.tracks[++this.trackPosition]
	
		while ( track && track.subtype === MIDICommands.COMMAND_NOTE_ON )
		{
			commands.push(track)
			track = this.tracks[ ++this.trackPosition ]
		}
		
		return commands
	}

	getNextNoteOnCommand(){
		return this.noteOnCommands[ ++this.commandPosition ]
	}

	// Next array of commands
	getNextCommands(){
		return this.tracks[ ++this.trackPosition ]
	}

	getDurationUntilNextCommand(){
		const r = this.tracks[ this.trackPosition + 1 ]
		return r ? r.deltaTime : -1
	}

	/**
	 * If you want all of the events to also be stretchable
	 * we can condense an entire track into 1 second and
	 * move all of the events proportionally so that the 
	 * timings align with whatever you would like to fit it too
	 * @param {MIDICommand} command 
	 */
	convertTimeToFraction( command ){
		return command.time / this.duration
	}

	copyCommand( command ) {
		return Object.assign){}, command )
	}

	addInstrument(instrumentName){
		// check to see if the instrument has already been added
		if (this.instruments.indexOf(instrumentName) === -1)
		{
			this.instruments.push( instrumentName )	
			return true
		}
		return false
	}

	constructor( defaultOptions={} )
	{
		
		for (let i in defaultOptions)
		{
			// check to see if they are one of our subclasses...
			switch (i)
			{
				// case "header": 
				// 	this.header = defaultOptions[i]
				// 	break

				// case "commands":
				// case "noteOnCommands":
				// 	this[i] = defaultOptions[i].map( command => this.copyCommand(command) )
				// 	break

				// default:
				// 	// check if is command
				// 	this[i] = defaultOptions[i]
				// 	console.log(i, this[i] )
			}
			
		}
	}


	/**
	 * This will loop through all events and add a new section
	 * that is a factor of total duration
	 */
	addTimePositionPercentage(){

	}

	// A way of adding an event and multiple events to track
	addEvent( index, audioCommand )
	{
		// there are no commands! so add the first and save a pointer to it
		if (!this.firstCommand)
		{
			this.firstCommand = audioCommand
		}

		if (this.finalCommand)
		{
			this.finalCommand.next = audioCommand
			audioCommand.previous = this.finalCommand
		}
		this.finalCommand = audioCommand

		// current previous event
		const currentFinalCommand = this.commands[this.commands.length - 1]
		
		// check to see if there is an pocket already open
		// open a new pocket
		if (audioCommand.type === MIDICommands.TYPE_META)
		{
			switch( audioCommand.subtype )
			{
				case "trackName":
					if (audioCommand.text && audioCommand.text !== "Untitled" )
					{
						this[audioCommand.subtype] = audioCommand.text	
						
					}
					break
				
				case "text":
				case "copyrightNotice":
				case "lyrics":
					if (audioCommand.text)
					{
						this[audioCommand.subtype] += audioCommand.text	
					}
					break;

				default:
					if (audioCommand.text)
					{
						this.meta += audioCommand.text	
					}
					
			}
		}else{

			// Deal with instrument changes
			switch( audioCommand.subtype )
			{
				case MIDICommands.COMMAND_PROGRAM_CHANGE:
					const instrumentName = GENERAL_MIDI_INSTRUMENTS[audioCommand.programNumber]
					this.addInstrument(instrumentName)
					break
			}

		
			switch( audioCommand.subtype )
			{
				case MIDICommands.COMMAND_NOTE_ON:
				case MIDICommands.COMMAND_NOTE_OFF:
				case MIDICommands.COMMAND_CONTROLLER:
				case MIDICommands.COMMAND_PITCH_BEND:
				case MIDICommands.COMMAND_PROGRAM_CHANGE:
				case MIDICommands.COMMAND_CHANNEL_AFTER_TOUCH:
				default:

					// add multidimnsionally?
					if (!currentFinalCommand)
					{
						// first command!
						//console.log( "Adding command", {currentFinalCommand, midiCommand} )
						this.tracks.push([audioCommand])

					}else{

						if (audioCommand.deltaTime === 0)
						{
							const previousDeltaTime = currentFinalCommand.timeCode
							audioCommand.timeCode = previousDeltaTime
							audioCommand.time = this.duration

							// modify command to contain correct timecode
							const commandsAtLocation = this.tracks[ this.tracks.length - 1 ]
							commandsAtLocation.push(audioCommand)
							
							//console.log( "Appending deltaTime 0", {commandsAtLocation, currentFinalCommand, midiCommand} )
							
						}else{

							// add to duration
							this.duration += audioCommand.deltaTime || 0 

							audioCommand.timeCode = audioCommand.deltaTime
							audioCommand.time = this.duration
							
							//console.log( "Adding", {currentFinalCommand, midiCommand} )
							this.tracks.push([audioCommand])
						}
					}

					this.commands.push(audioCommand)
			}

			switch( audioCommand.subtype )
			{
				case MIDICommands.COMMAND_NOTE_ON:
					this.noteOnCommands.push(audioCommand)
			}

		}
	}
	
	toString()
	{
		return `MIDI:Track::${this.commands.map( track => track.toString() ).join(", ")}`
	}


	commandToJSON( command )
	{
		let output = command
	}

	// To load save midi tracks in a web friendlier way, we can serialise it to JSON
	toJSON()
	{
		const o = this.commands.map( command => command.toJSON() )
		return o // `[${this.tracks.map( track => track.toString() ).join(",")}]`
	}
}
