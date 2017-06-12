import IMixerItem from './IMixerItem';

export default class Channel implements IMixerItem
{
  public name:string;
  private items:Array<IMixerItem>;
  private amplitude:number = 1;

  public set volume( vol:number )
  {
      this.amplitude = vol;
  }

  public get volume( ):number
  {
      return this.amplitude;
  }

  constructor( initialVolume:number = 1 )
  {
      this.amplitude = initialVolume;
      this.items = new Array();
  }

  public add( item:IMixerItem ):void
  {
      this.items.push( item );
  }

  public remove( item:IMixerItem ):void
  {
      var index:number = this.items.indexOf( item );
      if (index > -1) { this.items.splice(index, 1); };
  }

  public mute():boolean
  {
      return true;
  }

}
