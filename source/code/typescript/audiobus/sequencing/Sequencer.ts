import Timer from '../timing/Timer';
import ICommand from '../ICommand';
import ITrack from '../ITrack';

export default class Sequencer
{

	// a collection of ITracks to play :)
	protected tracks:Array<ITrack> = [];

	// where are we up to in the sequence in ms?
	protected position:number = 0;
	protected lastTimeStamp:number = 0;

	// how long is this sequence in ms
	// NB. if < 0, means unknown length
	protected length:number = -1;

	// place to store our commands...
	public commands:Array<ICommand> = [];
	public positions:object = {};

	private timer:Timer= new Timer();

	protected onEvents:{ (scope:Sequencer, event:ICommand, elapsed:number):void; } = (scope:Sequencer, event:ICommand, elapsed:number) => {};

	public set onEvent( method:{ (scope:Sequencer, event:ICommand, elapsed:number):void; } )
	{
		this.onEvents = method;
	}

	constructor()
	{

		this.timer.ms = (scope:Timer, startTime:number, time:number)=>{

			const elapsed:number = ( time - startTime) >> 0;  // stupid floating points...

			this.onUpdate( elapsed );

			this.lastTimeStamp = elapsed;
		}
	}

	public start()
	{
		this.timer.start();
	}

	public stop()
	{
		this.timer.stop();
	}

	public to( time:number )
	{
		// sets the playhead to this point in the sequence...
		this.position = time;
		// should this return an array of commands for this moment?
		this.checkCommandsAtPosition( time );
	}

	// midi is added using a running count...
	private previousTime:number = 0;
	
	public add( command:ICommand )
	{
		// sets the cue
		const position:number = this.previousTime + command.deltaTime + 400;
		command.timeCode = position;
		//this.commands.push( command );
		// and stores an instance in the dictionary with the time key
		//this.timings[command.] = command;
		if (!this.positions[position])
		{
			this.positions[position] = [command];
		}else{
			this.positions[position].push(command);
		}
		// if (!this.positions[command.deltaTime])
		// {
		// 	this.positions[command.deltaTime] = [command];
		// }else{
		// 	this.positions[command.deltaTime].push(command);
		// }

		
		// now as we add each command individually, we can dictate when their
		// appropriate time point is going to be
		//console.log("Command!", command, position );

		this.commands.push(command);
		
		this.previousTime = position;
	}

	public addTracks( commands:Array<ICommand> )
	{
		// loop through and add :)
		for ( let c=0, l=commands.length; c<l; ++c )
		{
			let command:ICommand = commands[c];
			this.add( command );
		}
	}

	protected getCommandsBetween( startPosition:number, endPosition:number ):Array<ICommand>
	{
		//console.log("Sequencing:getCommandsBetween", startPosition, endPosition );
		// loop through dictionary and find the keys!
		let output:Array<ICommand> = [];
		for ( let position=startPosition; position<endPosition; ++position )
		{
			// check dictionary...
			let matches = this.positions[position];
			// if not null append!
			if (matches && matches.length)
			{
				//console.log("Found!", matches );
				output = output.concat( matches );
			}else{
				//console.log("Not Found", this.positions );
			}
		}
		return output;
		//return this.positions[position];
	}


	protected getCommandsAtPosition( position:number ):Array<ICommand>
	{
		return this.positions[position];
	}

	// This is a private method that checks to see if any events
	// should be triggered at this particular moment in time...
	protected checkCommandsAtPosition( time:number )
	{

	}

	protected onUpdate(elapsed:number)
	{
		const startPosition:number = this.lastTimeStamp;
		const endPosition:number = elapsed;

		const commands = this.getCommandsBetween( startPosition, endPosition );
		if (commands && commands.length )
		{
			console.log("Sequencing", elapsed, commands );
			// now send out all of them!
			commands.forEach( (command)=>{
				this.onEvents( this, command, elapsed );
			});
			
		}

	}
}
