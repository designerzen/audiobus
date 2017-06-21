import ICommand from '../../ICommand';
import MidiCommand from './MidiCommand';
import MidiCommandFactory from './MidiCommandFactory';
import PromiseQueue from '../../timing/PromiseQueue';

export default class MidiHardware
{
  public static PORT_TYPE_INPUT:string = "input";
  public static PORT_TYPE_OUTPUT:string = "output";

  public static STATE_DISCONNETED:string = "disconnected";

  public static PORT_DEVICE_STATE_CONNECTED:string = "connected";
  public static PORT_DEVICE_STATE_DISCONNECTED:string = "disconnected";

  public static PORT_CONNECTION_STATE_OPEN:string = "open" ;
  public static PORT_CONNECTION_STATE_CLOSED:string = "closed";
  public static PORT_CONNECTION_STATE_PENDING:string = "pending";

  public state:string = MidiHardware.STATE_DISCONNETED;
  
  public connecting:boolean = false;
  public connectionQueue:PromiseQueue;

  // you should piggyback these!
  public onmidiconnected:Function = function(message:MidiCommand){};
  public onmididisconnected:Function = function(message:MidiCommand){};
  public onmidimessage:Function = function(message:MidiCommand){};

  public midiAccess:WebMidi.MIDIAccess;

  private messagePool:Array<MidiCommand>;

  public get available():boolean
  {
    return !!this.midiAccess;
  }

  constructor(  )
  {
    
  }

  public access():Promise<WebMidi.MIDIAccess>
  {
    const promise:Promise<WebMidi.MIDIAccess> = new Promise<WebMidi.MIDIAccess>( (resolve:{(access:WebMidi.MIDIAccess):void}, reject) => {

      //console.error(this.midiAccess);
      
      if (this.midiAccess)
      {
        // we already have!
        //console.error("cached",this.midiAccess);
        resolve(this.midiAccess);

      }else if (this.connecting){

        // check to see if we are waiting for a previous resolution...
        //console.error("pending"); 
        // add promise to the queue...
        if (!this.connectionQueue)
        { 
          this.connectionQueue = new PromiseQueue();
        }
        this.connectionQueue.add( resolve, reject );
        
      }else if (navigator.requestMIDIAccess){

        // fetch it from navigator..
        //console.error("fresh"); 
        this.connecting = true;
        // request MIDI access     
        navigator.requestMIDIAccess({
                      // set to true if you need to send sysex messages
                      sysex: true
                  }).then(
        
                    // Success!
                    (access: WebMidi.MIDIAccess) => {
                      this.midiAccess = access;
                      this.connecting = false;
                      resolve(access);
                      // resolve all of our subsequent queues...
                      this.connectionQueue && this.connectionQueue.resolve(access);
                      this.connectionQueue = null;
                    },
        
                    // Failure
                    (event) => {
                      const message:String = "No MIDI devices located";
                      this.connecting = false;
                      reject(message);
                      // reject all of our subsequent queues...
                      this.connectionQueue && this.connectionQueue.reject(message);
                      this.connectionQueue = null;
                   }
                );
        
        } else {
          
          reject("No MIDI support in this browser");
        }
        
      });
      
      return promise;
  }

  // for chaining it returns itself :)
  public establish():Promise<MidiHardware>
  {
    return new Promise<MidiHardware>((resolve, reject) => {
      
      // much cleaner...
      this.access().then(
        
        (access: WebMidi.MIDIAccess) => {
          // now watch for events...
          console.log("MIDI ESTABLISHED ACES");

          access.onstatechange = (event: WebMidi.MIDIConnectionEvent) => {
            // do something on change?
            console.log("MIDI STATE ",event);
            const port = event.port;
            
          };
          resolve(this);
        
        
        },
        
        // Failure
        (error:string) => {
          console.error('midi hardwarre not found' );
          reject(error);
        }  
      );

    });

  }

  private checkDevice( values:{ id?:string, manufacturer?:string, name?:string, version?:string, type?:string}, requested:{ id?:string, manufacturer?:string, name?:string, version?:string}, type:string ):boolean
  {
    let matched:boolean = false;
    // compare!
    // id first...
    if (values.type === MidiHardware.PORT_TYPE_INPUT)
    {
        return true;
    }
    if (values.id === requested.id)
    {
        return true;
    }
    if (values.name === requested.name)
    {
        return true;
    }
  }

  public findInputDevice(requested:{ id?:string, manufacturer?:string, name?:string, version?:string}):WebMidi.MIDIInput
  {
    const devices:Array<WebMidi.MIDIInput> = [];
    const inputs:WebMidi.MIDIInputMap = this.midiAccess.inputs;
    const inputValues = inputs.values();
    //console.log("MIDI findInputDevice from", inputs,inputValues);


    let values:WebMidi.MIDIInput = requested.id ? inputs.get(requested.id) : undefined; 
    console.error( "Using get id command("+requested.id+")",values );
    if(values)
    {
      return values;
    }
    
    for (let input = inputValues.next(); input && !input.done; input = inputValues.next())
    {
      values = input.value;
      let matched:boolean = false;

      
      //console.log("MIDI findInputDevice..", input,values);
      
      // if (values.type !== MidiHardware.PORT_TYPE_INPUT)
      // {
      //   // this one is of the wrong type!
      //   continue;
      // }
      if (values.id === requested.id)
      {
          matched = true;
      }
      if (values.name === requested.name)
      {
          matched = true;
      }
      
      if (matched)
      {
        devices.push( values );
      }
    }
    // if there are more than one, loop through and make more tests...
    if (devices.length > 1)
    {
      // too many...
      devices.forEach( (device)=>{
        // manufacturer...
        if (requested.manufacturer && device.manufacturer && device.manufacturer.toLowerCase() === requested.manufacturer.toLowerCase())
        {
            return device;
        }
      })

    }else if (devices.length === 0){
      // too few...
      return null;
    }else{
      // just right!
      return devices[0];
    }
  }

  
  public findOutputDevice(requested:{ id?:string, manufacturer?:string, name?:string, version?:string}):WebMidi.MIDIOutput
  {
    const devices:Array<WebMidi.MIDIOutput> = [];
    const outputs:WebMidi.MIDIOutputMap = this.midiAccess.outputs;
    const outputValues = outputs.values();
  
    for (let output = outputValues.next(); output && !output.done; output = outputValues.next())
    {
      const values:WebMidi.MIDIOutput = output.value;
      let matched:boolean = false;
      if (values.id && requested.id && values.id === requested.id)
      {
          matched = true;
      }
      if (values.name && requested.name && values.name === requested.name)
      {
          matched = true;
      }
      
      if (matched)
      {
        devices.push( values );
      }
      //console.log(devices,values.name ,requested.name );
      
    }
    // if there are more than one, loop through and make more tests...
    if (devices.length > 1)
    {
      // too many...
      devices.forEach( (device)=>{
        // manufacturer...
        if (requested.manufacturer && device.manufacturer && device.manufacturer.toLowerCase() === requested.manufacturer.toLowerCase())
        {
            return device;
        }
      })

    }else if (devices.length === 0){
      // too few...
      return null;
    }else{
      // just right!
      return devices[0];
    }
    
  }
  
  // type:'input' id: 'input-0' manufacturer: 'Microsoft Corporation' name
  public getInputDevice( device:{ id?:string, manufacturer?:string, name?:string, version?:string} ):Promise<WebMidi.MIDIInput>
  {
  
    return new Promise<WebMidi.MIDIInput>((resolve, reject) => {
      
      // much cleaner...
      this.access().then(
        
        (access: WebMidi.MIDIAccess) => {

          let input:WebMidi.MIDIInput = this.findInputDevice( device );

          // check to see if we have a device...
          if (input)
          {
            resolve(input);
          }else{
            // ah rats... there isn't a midi device with that name connected yet :(
            // now let's wait on some status updates...
            access.onstatechange = (event: WebMidi.MIDIConnectionEvent) => {
              
              console.log("MIDI State change..", event);
              // check to see if the device is now available!
              const port:WebMidi.MIDIPort = event.port;
              const state:string = port.state;
              const name:string = port.name;
              const type:string = port.type;
              
              
              resolve( input );
              
            };
          }
        
        },
        
        // Failure
        (error:string) => {
          console.error('midi hardwarre not found' );
          reject(error);
        }  
      );

    });
  }
  
  // type:'input' id: 'input-0' manufacturer: 'Microsoft Corporation' name
  public getOutputDevice( device:{ id?:string, manufacturer?:string, name?:string, version?:string} ):Promise<WebMidi.MIDIOutput>
  {
  
    return new Promise<WebMidi.MIDIOutput>((resolve, reject) => {
      // much cleaner...
      this.access().then(
        
        (access: WebMidi.MIDIAccess) => {
          let output:WebMidi.MIDIOutput = this.findOutputDevice( device );
          
          // check to see if we have a device...
          if (output)
          {
            resolve(output);
          }else{
            // ah rats... there isn't a midi device with that name connected yet :(
            // now let's wait on some status updates...
            access.onstatechange = (event: WebMidi.MIDIConnectionEvent) => {
              
              console.log("MIDI State change..", event);
              // check to see if the device is now available!
              const port:WebMidi.MIDIPort = event.port;
              const state:string = port.state;
              const name:string = port.name;
              const type:string = port.type;
              
              
              resolve( output );
              
            };
          }
        
        },
        
        // Failure
        (error:string) => {
          console.error('midi hardware not found' );
          reject(error);
        }  
      );

    });
  }
  // 
  // public connect( requestedInputDevice:string=undefined, requestedOutputDevice:string=undefined, wait:boolean=true ):Promise<Array<WebMidi.MIDIInput>>
  // {
  //     if (requestedInputDevice)
  //     {
  //       console.log('looking for midi input device '+requestedInputDevice );
  //     }else{
  //       console.log('looking for all midi input devices' );
  //     }
  //     if (requestedOutputDevice)
  //     {
  //       console.log('looking for midi output device '+requestedOutputDevice );
  //     }else{
  //       console.log('looking for all midi output devices' );
  //     }
  // 
  //     return new Promise<Array<WebMidi.MIDIInput>>((resolve, reject) => {
  // 
  //       // request MIDI access
  //       if (navigator.requestMIDIAccess)
  //       {
  //           navigator.requestMIDIAccess({
  //               sysex: false
  //           }).then(
  // 
  //             // Success!
  //             (access: WebMidi.MIDIAccess) => {
  // 
  //               this.onMIDISuccess( access );
  //               
  //               // if we requested a specific device... let us search for it...
  //               if (requestedOutputDevice)
  //               {
  //                 // this.connectedOutput = this.getOutput( requestedInputDevice );
  //                 // if (this.connectedOutput)
  //                 // {
  //                 // 
  //                 // }
  //               }
  //               // Now connect to out input port if possible
  //               if (requestedInputDevice)
  //               {
  //                   this.connectedInput = this.getInput( requestedInputDevice );
  //                   
  //                   // we can check to see if this has succeeded or not
  //                   if (this.connectedInput)
  //                   {
  //                     // success, device located... monitor for inputs?
  //                     this.connectedInput.onmidimessage = (event: WebMidi.MIDIMessageEvent)=>{
  //                         this.onMIDIMessage(event);
  //                     };
  //                     
  //                     console.log('midi input hardware located and connected to',this.connectedInput );
  //                     resolve( [this.connectedInput] );
  //                   }else{
  //                     console.error('midi hardware not found' );
  //                     //reject("No MIDI devices found with the name "+requestedInputDevice);
  //                   }
  //                   
  //                   
  //                   // listen for connect/disconnect message(s) and react differently
  //                   // depending on whether we are still waiting for the device to become
  //                   // available...
  //                   if (!this.connectedInput && wait)
  //                   {
  //                     // now wait for the device to become available...
  //                     this.midiAccess.onstatechange = (event: WebMidi.MIDIConnectionEvent) => {
  //                       console.log("MIDI State change..", event);
  //                       // check to see if the device is now available!
  //                       const port:WebMidi.MIDIPort = event.port;
  //                       const nowAvailable:boolean = this.checkConnectionStatus( port, requestedInputDevice );
  //                       this.onStateChange (event);
  // 
  //                       if (nowAvailable)
  //                       {
  //                         resolve( [this.connectedInput] );
  //                       }
  //                     };
  //                   }
  //                   
  //               }else{
  //                 
  //                 // as no specific device was specified, we instead return all
  //                   const allInputs = this.getInputs();
  //                   if (allInputs.length)
  //                   {
  //                     console.log('midi hardware :',allInputs );
  //                     resolve( allInputs );
  //                   }else{
  //                     // gah, no devices...
  //                     reject("No MIDI devices plugged in");
  //                   }
  // 
  //               }
  // 
  //             },
  // 
  //             // Failure
  //             (event) => {
  //               this.onMIDIFailure(event);
  //               console.error('midi hardwarre not found' );
  //               reject("No MIDI devices located");
  //            }
  //         );
  // 
  //       } else {
  // 
  //           this.onMIDIFailure(null);
  //           console.error('midi in browser not supported' );
  //           reject("No MIDI support in this browser");
  //       }
  // 
  //     });
  //   }

    // INPUT -------------------------------------------------------------    

    // try and retrieve an existing input (or null)
    public getInput(name:string):WebMidi.MIDIInput
    {
        const inputs:WebMidi.MIDIInputMap = this.midiAccess.inputs;
        const inputValues = inputs.values();
        // loop through all inputs
        for (let input = inputValues.next(); input && !input.done; input = inputValues.next())
        {
            const values:WebMidi.MIDIInput = input.value;
            if (values.name === name)
            {
                return values;
            }
        }
        return null;
    }

    public getInputs():Array<WebMidi.MIDIInput>
    {
        const inputs:WebMidi.MIDIInputMap = this.midiAccess.inputs;
        const inputValues = inputs.values();
        const devices:Array<WebMidi.MIDIInput> = [];

        console.log(inputs,inputValues);
        // Things you can do with the MIDIAccess object:
        //  var inputs = this.midiAccess.inputs; // inputs = MIDIInputMaps, you can retrieve the inputs with iterators
        //  var outputs = this.midiAccess.outputs; // outputs = MIDIOutputMaps, you can retrieve the outputs with iterators

        // loop through all inputs
        for (let input = inputValues.next(); input && !input.done; input = inputValues.next())
        {
            const values:WebMidi.MIDIInput = input.value;
            console.log("Input port : [ type:'" + values.type + "' id: '" + values.id +
                "' manufacturer: '" + values.manufacturer + "' name: '" + values.name +
                "' version: '" + values.version + "']");

            // listen for midi messages
            // input.value.onmidimessage = (event: WebMidi.MIDIMessageEvent)=>{
            //     this.onMIDIMessage(event);
            // };
            devices.push( values );
        }
        return devices;
    }
    // success
    private onMIDISuccess( access: WebMidi.MIDIAccess ):void
    {
        this.messagePool = new Array();
        this.midiAccess = access;
    
    
        /*
        // now do outputs!
        var values = output.value;
        console.log("Input port : [ type:'" + values.type + "' id: '" + values.id +
            "' manufacturer: '" + values.manufacturer + "' name: '" + values.name +
            "' version: '" + values.version + "']");
        */
    
    }

    // if we are waiting for a named device to become available...
    private checkConnectionStatus(port: WebMidi.MIDIPort, requestedInputDevice:string=undefined ):boolean
    {
      const state:string = port.state;
      const name:string = port.name;
      const type:string = port.type;
      switch(port.type)
      {
          case MidiHardware.PORT_DEVICE_STATE_CONNECTED:
            console.log("MIDI STATUS CONNECT"+"Device connected!");
            if ( this.available )
            {
                // re-attempt to connect
                const input = this.getInput( requestedInputDevice );
                if (input)
                {
                  return true;
                }else{
                  return false;
                }
            }
            break;

          case MidiHardware.PORT_DEVICE_STATE_DISCONNECTED:
          
              console.log("MIDI STATUS DISCONNECT"+"name", name, "port", port, "state", state);
              if (name === requestedInputDevice)
              {
                  // we have disconnected device!
                  return false;

              }


              break;
      }
      return true;
    }
    
    private onStateChange(event: WebMidi.MIDIConnectionEvent)
    {
        var port:WebMidi.MIDIPort = event.port,
            state:string = port.state,
            name:string = port.name,
            type:string = port.type;

        console.log(event);
        switch(type)
        {
            case MidiHardware.PORT_DEVICE_STATE_CONNECTED:
                console.log("name", name, "port", port, "state", state);
                
                break;

            case MidiHardware.PORT_DEVICE_STATE_DISCONNECTED:
                console.log("name", name, "port", port, "state", state);

                // close the port
                port.close();

                break;
        }
    }


    // EVENT : A MIDI message has been received from the Input
    private onMIDIMessage( event:WebMidi.MIDIMessageEvent )
    {
        const message:MidiCommand = MidiCommandFactory.create( event.data);
        this.onmidimessage.call(this, message);     // now dispatch this event...
        //console.log('data', data, 'cmd', cmd, 'channel', channel);
    }

    // failure
    private onMIDIFailure(e:WebMidi.MIDIMessageEvent):void
    {
        console.log("No access to MIDI devices or your browser doesn't support WebMIDI API. Please use WebMIDIAPIShim " + e);
    }



    // OUTPUT --------------------------------------------------------------
    public getOutput(name:string):WebMidi.MIDIOutput
    {
        var outputs:WebMidi.MIDIOutputMap = this.midiAccess.outputs;
        var outputValues = outputs.values();
        // loop through all inputs
        for (var output = outputValues.next(); output && !output.done; output = outputValues.next())
        {
            var values:WebMidi.MIDIOutput = output.value;
            if (values.name === name)
            {
                return values;
            }
        }
        return null;
    }

    public getOutputs():Array<WebMidi.MIDIOutput>
    {
      const outputs:WebMidi.MIDIOutputMap = this.midiAccess.outputs;
      const outputValues = outputs.values();
      const devices:Array<WebMidi.MIDIOutput> = [];

      console.log(outputs,outputValues);
      // Things you can do with the MIDIAccess object:
      //  var inputs = this.midiAccess.inputs; // inputs = MIDIInputMaps, you can retrieve the inputs with iterators
      //  var outputs = this.midiAccess.outputs; // outputs = MIDIOutputMaps, you can retrieve the outputs with iterators

      // loop through all inputs
      for (let input = outputValues.next(); input && !input.done; input = outputValues.next())
      {
          const values:WebMidi.MIDIOutput = input.value;
          console.log("Input port : [ type:'" + values.type + "' id: '" + values.id +
              "' manufacturer: '" + values.manufacturer + "' name: '" + values.name +
              "' version: '" + values.version + "']");

          // listen for midi messages
          // input.value.onmidimessage = (event: WebMidi.MIDIMessageEvent)=>{
          //     this.onMIDIMessage(event);
          // };
          devices.push( values );
      }
      return devices;
    }

    // use a midi event to send to the hardware
    public send( output:WebMidi.MIDIOutput, command:ICommand )
    {
      // if we are still trying to connect then we defer this until the promise has resolved...
      output.send( [ Number(command.data) ], command.deltaTime * 1000);
    }

}
