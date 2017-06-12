/// <reference path="../MidiHardware.ts"/>
/// <reference path="../../Dependencies.ts"/>

module audiobus.io.devices
{
    export class KMix extends MidiHardware
    {
        // Input port : [ type:'input' id: '3' manufacturer: 'Microsoft Corporation' name: '3- TB-3' version: '6.1']
        public static PORT_TYPE_INPUT:string = "3- TB-3";

        constructor()
        {
            super();
        }

        public connect():boolean
        {
            return super.connect( KMix.PORT_TYPE_INPUT );
        }
    }
}
