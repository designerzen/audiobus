export default class TB303Config
{
  public shape = 0.5;
  public resonance  =  0.5;              // 0 -> 1
  public accent  =  0.5;              // 0 -> 1
  public decay  =  0.5*2000;                  // 100 -> 2000
  public threshold  =  0.5;              // 0 -> 1   =  softness
  public cutOff  =  0.5 * 20000;
  public envelopeModulation  =  0.5;
  public tuning  =  0;
};
