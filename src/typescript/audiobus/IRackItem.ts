/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Scales
==============
Abstract    - All of the frequencies from the main scales
Description - You can use this class to create harmonius sounding frequencies
Use         - Select from the scales and types
Methods     -

Parameters	-

destination
	The AudioNode you are connecting to.
output Optional
	An index describing which output of the current AudioNode you want to connect to the destination. The index numbers are defined according to the number of output channels (see Audio channels).  If this parameter is out-of-bound, an INDEX_SIZE_ERR exception is thrown. It is possible to connect an AudioNode output to more than one input with multiple calls to connect(). Therefore fan-out is supported.
input Optional
	An index describing which input of the destination you want to connect the current AudioNode to. The index numbers are defined according to the number of input channels (see Audio channels).  If this parameter is out-of-bound, an INDEX_SIZE_ERR exception is thrown. It is possible to connect an AudioNode to another AudioNode, which in turn connects back to the first AudioNode, creating a cycle. This is allowed only if there is at least one DelayNode in the cycle. Otherwise, a NOT_SUPPORTED_ERR exception will be thrown.

Returns		- A reference to the destination AudioNode object.
			  In some browsers older implementations of this interface return void.

//////////////////////////////////////////////////////////////////////////////*/


interface IRackItem {
	connect(destination:IRackItem, output:number, input:number):IRackItem;
}