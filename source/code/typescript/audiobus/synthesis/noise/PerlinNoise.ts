/**********************************************************************************/

/*
 * A speed-improved perlin and simplex noise algorithms for 2D.
 *
 * Based on example code by Stefan Gustavson (stegu@itn.liu.se).
 * Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
 * Better rank ordering method by Stefan Gustavson in 2012.
 * Converted to Javascript by Joseph Gentle.
 *
 * Version 2012-03-09
 *
 * This code was placed in the public domain by its original author,
 * Stefan Gustavson. You may use it as you see fit, but
 * attribution is appreciated.
 *
 */

// How Perlin noise scales...
class PerlinNoiseGradients
{
  // handy contructor parsing :D
  constructor(public x:number, public y:number, public z:number){}

  public dot2(x:number, y:number) :number
  {
    return this.x*x + this.y*y;
  }

  public dot3(x:number, y:number, z:number) :number
  {
    return this.x*x + this.y*y + this.z*z;
  }
}


// Perlin Noise simulator
export default class PerlinNoise
{
  public static hasSeeded:boolean = false;

  public static grad3:Array<PerlinNoiseGradients> = [
    new PerlinNoiseGradients(1,1,0),new PerlinNoiseGradients(-1,1,0),new PerlinNoiseGradients(1,-1,0),new PerlinNoiseGradients(-1,-1,0),
    new PerlinNoiseGradients(1,0,1),new PerlinNoiseGradients(-1,0,1),new PerlinNoiseGradients(1,0,-1),new PerlinNoiseGradients(-1,0,-1),
    new PerlinNoiseGradients(0,1,1),new PerlinNoiseGradients(0,-1,1),new PerlinNoiseGradients(0,1,-1),new PerlinNoiseGradients(0,-1,-1)
   ];

  public static p:Array<number> = [
    151,160,137,91,90,15,
    131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
    190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
    88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
    77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
    102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
    135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
    5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
    223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
    129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
    251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
    49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
    138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
  ];

  // To remove the need for index wrapping, double the permutation table length
  private static perm = new Array(512);
  private static gradP = new Array(512);

  // Skewing and unskewing factors for 2, 3, and 4 dimensions
  public static F2:number = 0.5*(Math.sqrt(3)-1);
  public static G2:number = (3-Math.sqrt(3))/6;

  // Make sure you seed this static method...
  // This isn't a very good seeding function, but it works ok. It supports 2^16
  // different seed values. Write something better if you need more seeds.
  // seed(Date.now());
  public static seed ( needle:number, thread:number ):void
  {
    if(needle > 0 && needle < 1)
    {
      // Scale the seed out
      needle *= 65536;
    }

    needle = Math.floor(needle);

    if(needle < 256)
    {
      needle |= thread << 8;
    }

    for(let i:number = 0; i < 256; i++)
    {
      let v;
      if (i & 1)
      {
        v = PerlinNoise.p[i] ^ (needle & 255);
      } else {
        v = PerlinNoise.p[i] ^ ((needle>>8) & 255);
      }

      PerlinNoise.perm[i] = PerlinNoise.perm[i + 256] = v;
      PerlinNoise.gradP[i] = PerlinNoise.gradP[i + 256] = PerlinNoise.grad3[v % 12];
    }
    PerlinNoise.hasSeeded = true;
  }

    // var F3 = 1/3;
    // var G3 = 1/6;

    /*
    for(var i=0; i<256; i++) {
      perm[i] = perm[i + 256] = p[i];
      gradP[i] = gradP[i + 256] = PerlinNoise.grad3[perm[i] % 12];
    }*/


    // 2D simplex noise
    public static simplex2 (xin:number, yin:number):number
    {
      if (!PerlinNoise.hasSeeded)
      {
        // we must seed!
        // FIXME SEED THREAD NUMBER GARGH!
        PerlinNoise.seed( Date.now() , 0 );
      }
      let n0:number, n1:number, n2:number; // Noise contributions from the three corners
      // Skew the input space to determine which simplex cell we're in
      let s:number = (xin+yin)*PerlinNoise.F2; // Hairy factor for 2D
      let i:number = Math.floor(xin+s);
      let j:number = Math.floor(yin+s);
      let t:number = (i+j)*PerlinNoise.G2;
      let x0:number = xin-i+t; // The x,y distances from the cell origin, unskewed.
      let y0:number = yin-j+t;

      // For the 2D case, the simplex shape is an equilateral triangle.
      // Determine which simplex we are in.
      let i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords

      if(x0>y0)
      {
        // lower triangle, XY order: (0,0)->(1,0)->(1,1)
        i1=1; j1=0;
      } else {
        // upper triangle, YX order: (0,0)->(0,1)->(1,1)
        i1=0; j1=1;
      }

      // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
      // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
      // c = (3-sqrt(3))/6
      var x1:number = x0 - i1 + PerlinNoise.G2; // Offsets for middle corner in (x,y) unskewed coords
      var y1:number = y0 - j1 + PerlinNoise.G2;

      // TODO: Optimise!
      var x2:number = x0 - 1 + 2 * PerlinNoise.G2; // Offsets for last corner in (x,y) unskewed coords
      var y2:number = y0 - 1 + 2 * PerlinNoise.G2;

      // Work out the hashed gradient indices of the three simplex corners
      i &= 255;
      j &= 255;

      const gi0 = PerlinNoise.gradP[i+PerlinNoise.perm[j]];
      const gi1 = PerlinNoise.gradP[i+i1+PerlinNoise.perm[j+j1]];
      const gi2 = PerlinNoise.gradP[i+1+PerlinNoise.perm[j+1]];

      // Calculate the contribution from the three corners
      var t0:number = 0.5 - x0*x0-y0*y0;
      if(t0<0)
      {
        n0 = 0;
      } else {
        t0 *= t0;
        n0 = t0 * t0 * gi0.dot2(x0, y0);  // (x,y) of grad3 used for 2D gradient
      }

      var t1:number = 0.5 - x1*x1-y1*y1;
      if(t1<0)
      {
        n1 = 0;
      } else {
        t1 *= t1;
        n1 = t1 * t1 * gi1.dot2(x1, y1);
      }

      var t2:number = 0.5 - x2*x2-y2*y2;
      if(t2<0)
      {
        n2 = 0;
      } else {
        t2 *= t2;
        n2 = t2 * t2 * gi2.dot2(x2, y2);
      }
      // Add contributions from each corner to get the final noise value.
      // The result is scaled to return values in the interval [-1,1].
      return 70 * (n0 + n1 + n2);
    };

    public static simplex1 (x:number):number
    {
      return PerlinNoise.simplex2(x*1.2, -x*0.7);
    };
}
