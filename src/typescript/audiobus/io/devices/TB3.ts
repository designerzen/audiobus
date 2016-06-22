/// <reference path="../Midi.ts"/>
/// <reference path="../../Dependencies.ts"/>

module audiobus.io.devices
{
    export class TB3 extends Midi
    {
        // Input port : [ type:'input' id: '3' manufacturer: 'Microsoft Corporation' name: '3- TB-3' version: '6.1']
        public static PORT_TYPE_INPUT:string = "3- TB-3";

        constructor()
        {
            super();
        }
        public connect():boolean
        {
            return super.connect( TB3.PORT_TYPE_INPUT );
        }
    }
}
