const tau = 2*Math.PI;
//import WaveTable from './wavetable.png';

export default class TB303WaveTable
{
  public static WAVE_TABLE:Float32Array;

  private static extrapolateDataFromPNG( img:HTMLImageElement ):Float32Array
  {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img,0,0);

    const data = ctx.getImageData(0,0,canvas.width,canvas.height);
    return new Float32Array((new Uint8Array(data.data)).buffer);
  }

  public static fetch():Promise<Float32Array>
  {
    // if we have one already...
    return new Promise( (resolve, reject) =>{

      if (TB303WaveTable.WAVE_TABLE)
      {
        resolve( TB303WaveTable.WAVE_TABLE );
      }else{

        const uri = require("./wavetable.png"); // uri:string
        //console.error("TB303:", uri);
        const img = new Image();

        img.onload = () => {
          const wavetable = TB303WaveTable.extrapolateDataFromPNG( img );
          TB303WaveTable.WAVE_TABLE = wavetable;
          resolve( wavetable );
        };
        img.onerror = () =>{
          reject("Could not load "+uri);
        }
        img.src = uri;

      }

    })

  }

  public static load(uri:string):Promise<Float32Array>
  {
    return new Promise( (resolve, reject) =>{
      //require("./template.css!");
      const img:HTMLImageElement = new Image();
    	img.onload = () => {
    		const wavetable = TB303WaveTable.extrapolateDataFromPNG( img );
    		resolve( wavetable );
    	};
      img.onerror = () =>{
        reject("Could not load "+uri);
      }
    	img.src = uri;
    })

  }

  // this needs to be chunked cos it takes forever!!!
  public static generate( sampleRate:number ):Promise<Float32Array>
  {
    return new Promise( (resolve, reject) =>{
    	const wavetable = new Float32Array(2*524288);

    	const stab = new Float32Array(4096);
    	for (let i=0;i<4096;i++)
      {
    		stab[i] = Math.sin(tau*(i/4096.0));
    	}

    	var last = 0;
    	var j,k,h,m,f,invh;

    	for (let i=0,z=2*524288; i<z; ++i)
      {
    		wavetable[i]=0.0;
    	}

    	for (let i=0;i<128;++i)
      {
    		h = Math.round((sampleRate>>1)/(440.0*Math.pow(2.0,(i-69.0)/12.0)));
    		if (h == last)
        {
    			continue;
    		}

    		invh = 1.0/h;
    		for (j=1;j<=h;j++)
        {
    			m = ((m = Math.cos((j-1)*(0.5*Math.PI)/invh))*m)/j;

    			for (k=0;k<4096;k++)
          {
    				f = m*stab[(j*k)&4095];
    				wavetable[1+(k+(i<<12))] += f;

    				if (j&1)
            {
    					wavetable[524288+k+(i<<12)] += f;
    				}
    			}
    		}

    		last = h;
    	}

    	var max0 = 0;
    	var max1 = 0;

      for (let i=0; i<524288; ++i)
      {
    		max0 = Math.max(max0,Math.abs(wavetable[i]));
    		max1 = Math.max(max1,Math.abs(wavetable[524288+i]));
    	}

    	max0 = 1.0/max0;
    	max1 = 1.0/max1;

      for (let i=0; i<524288; ++i)
      {
    		wavetable[i]*=max0;
    		wavetable[524288+i]*=max1;
    	}

      resolve( wavetable );
    });
  }
}
