/// <reference path="Dependencies.ts" />
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Rack
==============
Abstract    - A simpler way to add groiups of nodes in a single sequence
Description - Allows for linear collections of audio nodes and filters.
Use         - Set the type and use raw or layer multiple waves together
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
module audiobus
{
	export class Rack
    {
        public context:AudioContext;

		constructor( context:AudioContext )
        {
            this.context = context;
        }

        public createFilter()
        {
            
        }
    }
}