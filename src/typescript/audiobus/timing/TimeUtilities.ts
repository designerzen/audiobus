/// <reference path="../Dependencies.ts" />
module audiobus.timing
{
	export class TimeUtilities
    {
        public static NOW:Function = window.performance && window.performance.now ? window.performance.now : Date.now;

        public static now() :number
        {
            if (window.performance && window.performance.now) {
                return window.performance.now();
            } else {
		        return Date.now();
            }
	    }
    }
}