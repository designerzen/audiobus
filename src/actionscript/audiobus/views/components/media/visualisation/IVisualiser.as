package audiobus.views.components.media.visualisation 
{
	public interface IVisualiser
	{
		function preProcess():void;
		function process():void;
		function postProcess():void;
	}
	
}