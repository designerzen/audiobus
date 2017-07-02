/*

This is a way to handle keyboard (pc one) events in a musical way


*/
import TimeNow from '../timing/TimeNow';

// Model for outputs...
export class KeyEvent
{
  public char:string;
  public keyCode:number;
  public timePressed:number = -1;
  public durationHeld:number = -1;
  public pressed:Array<KeyEvent>;
  public event:KeyboardEvent;

 //keycode, was pressed before, time pressed, array of still pressed keys
 constructor(event:KeyboardEvent)
 {
   this.char = event.char;
   this.keyCode = event.keyCode;
   this.timePressed = TimeNow();
   this.event = event;
 }
 // create a duplicate of this object...
 public clone():KeyEvent
 {
   const copy:KeyEvent = new KeyEvent(this.event);
   Object.assign(copy, this);
   return copy;
 }
}

export default class Keyboard
{

  private keys:Array<KeyEvent>;
  private keysDown:object;
  private callbacks:object;


	public onKeyDown:{ (keyEvent:KeyEvent):void } = (keyEvent:KeyEvent) => {};
	public onKeyUp:{ (keyEvent:KeyEvent):void } = (keyEvent:KeyEvent) => {};

  constructor()
  {
    this.keysDown = {};
    this.callbacks = {};
  }

  public get active():boolean
  {
    // if it is a string... convert to number...
    return this.keys.length > 0;
  }

  public iKeyDown( key:(number|string) ):boolean
  {
    // if it is a string... convert to number...
    return this.keysDown[ key ];
  }

  public setKeyDown( key:(number|string), callback:Function )
  {
    // binds a key to a calback
  }

  public onAnyKeyDown( key:KeyEvent )
  {
    // fetch callback and trigger!s
  }

  public onAnyKeyUp( key:KeyEvent )
  {
    // fetch callback and trigger!s
  }

  public enable()
  {
    window.onkeydown = (event:KeyboardEvent)=>{
      // check for a specific callback for this key...
      const isCurrentlyPressed:boolean = !!this.keysDown[ event.keyCode ];
      // send out global callback with correct nterface...
      if (isCurrentlyPressed)
      {
        console.log("Keyboard handler key down exit early");
        return false;
      }
      // snd out keycode, was pressed before, time pressed, array of other pressed keys
      // create event
      const key:KeyEvent = new KeyEvent(event);
      this.keysDown[ event.keyCode ] = key;
      // now dispatch the event!
      console.log("Keyboard handler key down exit earlyevent", key);
      this.onKeyDown && this.onKeyDown( key );
    }

    window.onkeyup =(event:KeyboardEvent)=>{
      const isCurrentlyPressed:boolean = this.keysDown[ event.keyCode ] !== null;
      if (isCurrentlyPressed)
      {
        const key:KeyEvent = this.keysDown[ event.keyCode ];
        console.log("Keyboard handler key up ", key);
        const clone:KeyEvent = key.clone();

        // check for a specific callback for this key...

        // send out global callback with correct nterface...

        // snd out keycode, was pressed before, time pressed, array of still pressed keys
        this.onKeyUp && this.onKeyUp( key );

        //delete this.keysDown[ event.keyCode ];
        this.keysDown[ event.keyCode ] = null;
      }else{
        console.error("Key up for key down not registers");
      }

    }


  }
}
