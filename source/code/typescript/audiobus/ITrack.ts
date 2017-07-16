interface ITrack
{
  toJSON():string;
  fromJSON(json:string):void;  
}

export default ITrack;
