interface ICommand {
  channel:number;
  amount:number;
  noteNumber:number;  // if we want a note, what is the freq
  velocity:number;    // how hard the note was hit
  deltaTime:number;
  value:number;
  timeCode:number;
  data:string;
  type:string;        // note on, note off etc
  subtype:string;
  programNumber:number; // midi number of the instrument, or a custom number
  clone():ICommand;
}

export default ICommand;
