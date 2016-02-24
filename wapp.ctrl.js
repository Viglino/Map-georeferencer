/** A simple toggle control with a callback function
*/

var toggleCtrl = function(options) 
{	var element = $("<div>").addClass(options['class'] + ' ol-unselectable ol-control'+ (options.on ? " ol-active":""));
	
	function toggle(e)
	{	element.toggleClass("ol-active");
		e.preventDefault();  
		options.toggleFn(element.hasClass("ol-active"));
	};
	
	$("<button>").html(options.html || "")
				.on("touchstart", toggle)
				.click (toggle)
				.appendTo(element);
	
	ol.control.Control.call(this, 
	{	element: element.get(0)
	});
}
ol.inherits(toggleCtrl, ol.control.Control);
