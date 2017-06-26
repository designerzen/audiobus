import Timer from '../timing/Timer';
import ICommand from '../ICommand';
import ITrack from '../ITrack';

export default class Sequencer
{

	// a collection of ITracks to play :)
	// the sequence of these is also the order of playback...
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
	public get isPaused():boolean
	{
		return this.timer.isPaused;
	}

	constructor()
	{

		this.timer.ms = (scope:Timer, startTime:number, time:number)=>{
			// while the sequencer is paused, the timer still updates here but the time code
			// remains the same...


			this.onUpdate( startTime, time );

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

  public pause():void
  {
    this.timer.pause();
  }

  public resume():void
  {

		this.timer.resume();
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

	//public getTimestamp

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
	//
	// // you can specify the type of commands to retrieve...
	// public getCommandsAtIndexByType( index:number, type:string ):Array<ICommand>
	// {
	//
	// }

	// This method takes an index and returns commands with the same time code
	// that match the command with the index. The quantity returned should
	// be added to your external class' rolling index for the next interrogation
	public getCommandsAtIndex( index:number ):Array<ICommand>
	{
		// 1. we fetch the code at the specified index...
		let command:ICommand = this.commands[index];
		// check to see if there are any commands that follow this command that
		// share the same timings...
		let position:number = command.timeCode;
		return this.positions[position];

		// TODO :
		// fuzzy find for commands that are very close...
		// for ( let i=index, l=index+10; i <l; ++i)
		// {
		// 	// this is the next command in the list...
		// 	const subsequentCommand:ICommand = this.positions[i];
		// 	//if (subsequentCommand.deltaTime === )
		// }
		//return commands;
	}

	public getCommandsBetween( startPosition:number, endPosition:number ):Array<ICommand>
	{
		//console.log("Sequencing:getCommandsBetween", startPosition, endPosition );
		// loop through dictionary and find the keys!
		let output:Array<ICommand> = [];
		for ( let position=startPosition; position<endPosition; ++position )
		{
			// check dictionary...
			let matches:Array<ICommand> = this.positions[position];
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

	protected onUpdate(startTime:number, time:number):void
	{

		const elapsed:number = ( time - startTime) >> 0;  // stupid floating points...

		if (this.isPaused)
		{
			// update timestamp to something more recent...
			// now save the last time stamp, ready for the next comparison...
			this.lastTimeStamp = elapsed;
			return;
		}


		// if we are paused, we need to re-adjust the last timestamp here...
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
		// now save the last time stamp, ready for the next comparison...
		this.lastTimeStamp = elapsed;
	}
}
