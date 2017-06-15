import Timer from './Timer';
import ICommand from '../ICommand';

export default class Sequencer
{
	// where are we up to in the sequence in ms?
	protected position:number = 0;
	protected lastTimeStamp:number = 0;

	// how long is this sequence in ms
	// NB. if < 0, means unknown length
	protected length:number = -1;

	// place to store our commands...
	public tracks:Array<ICommand> = [];
	public positions:object = {};

	private timer:Timer= new Timer();

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

	public add( command:ICommand )
	{
		// sets the cue
		//this.commands.push( command );
		// and stores an instance in the dictionary with the time key
		//this.timings[command.] = command;
		if (!this.positions[command.deltaTime])
		{
			this.positions[command.deltaTime] = [command];
		}else{
			this.positions[command.deltaTime].push(command);
		}

		this.tracks.push(command);
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
			// now send
		}

	}
}
