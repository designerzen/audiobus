package audiobus.models.structure 
{
	public interface ILinkedList 
	{
		// Linked List Creators & Setters
		function link( $previous:ILinkedList=null, $next:ILinkedList=null ):ILinkedList;
		function unlink():ILinkedList;		
		
		// Linked List Accessors
		function get previous():ILinkedList;
		function set previous( $previous:ILinkedList ):void;
	}
	
}