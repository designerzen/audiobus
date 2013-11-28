package audiobus.models.structure 
{
	public interface ILinkedListCircular extends ILinkedList
	{
		function set next():ILinkedList
		function set previous( $previous:ILinkedList ):void;
	}
	
}