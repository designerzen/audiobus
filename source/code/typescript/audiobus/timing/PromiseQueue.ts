
// how this works... add as many promises as you like of the same type...
// when one resolves, the other's resolve but only one call is ever made!

export default class PromiseQueue
{
  public get pending():number
  {
    return this.resolveQueue.length;
  }
  
  public resolveQueue:Array<Function>;
  public rejectQueue:Array<Function>;

  constructor()
  {
    this.reset();
  }

  public add( resolve:Function, reject:Function )
  {
    this.resolveQueue.unshift( resolve ); // prepend
    this.rejectQueue.unshift( reject );
  }

  public resolve(  data:any )
  {
    this.resolveQueue.forEach( ( resolution )=>{
      resolution(data);
      console.error("fresh:resolve", resolution); 
      
    });
    this.reset();
  }

  public reject( data:any )
  {
    this.rejectQueue.forEach( (rejection)=>{
      rejection(data);
      console.error("fresh:rejection", rejection); 
    });
    this.reset();
  }

  public reset()
  {
    this.resolveQueue = [];
    this.rejectQueue = [];
  }
}
