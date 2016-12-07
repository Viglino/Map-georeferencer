wapp.img = function(name, dataURL, mapimg, map)
{	
	// Image transformation
	this.transformation =  new ol.transform.Helmert();

	this.controlPoints = [];
	this.lastPoint = {};

	// Source map layer
	this.sourceLayer = this.addSource(name, dataURL, mapimg);
	mapimg.getView().setZoom(7)
	mapimg.getView().setCenter([0,0])
		
	// Projection layer
	this.destLayer = this.addDest(dataURL, map);
	
	/** Activate/deactivate image
	*/
	this.activate = function(b) 
	{	imgmap.removeLayer(name, this.sourceLayer.image);
		imgmap.removeLayer(this.sourceLayer.vector);
	};
}

/** Add a source image
*/
wapp.img.prototype.addSource = function(name, dataURL, map)
{	var self = this;
	var layers = {};

	layers.image = new ol.layer.Image(
	{	name: name.replace(/\.jpg$|\.png$|\.jpeg$/i,""),
		opacity: 1,
		source: new ol.source.GeoImage(
		{	url: dataURL,
			imageCenter: [0,0],
			imageScale: [1,1],
			projection: pixelProjection
		})
	})
	// Add Layer
	map.getLayers().insertAt(0,layers.image);

	// Controls points
	var features = new ol.Collection();
	var vector = layers.vector =  new ol.layer.Vector(
	{	name: 'Vecteur',
		source: new ol.source.Vector({ features: new ol.Collection() }),
		style: this.getStyle
	})
	map.addLayer(vector);

	// Add a new control point
	vector.getSource().on("addfeature", function(e)
	{	if (e.feature.getGeometry().getType()=="Point") self.addControlPoint(e.feature, true);
	});

	// Add interaction
	layers.iclick = new ol.interaction.Draw({
		type: 'Point',
		source: vector.getSource(),
		style: this.getStyle()
	});
	map.addInteraction(layers.iclick);


	// Interaction mask
	layers.imask = new ol.interaction.Draw({
		type: 'Polygon',
		source: vector.getSource(),
	});
	map.addInteraction(layers.imask);
	layers.imask.setActive(false);
	// Mask control tool
	var mk = new ol.control.Toggle(
		{	html: "<i class='fa fa-crop'></i>",
			'className': "ol-mask",
			toggleFn: function(b) 
			{	if (!self.maskFeature) 
				{	layers.imask.setActive(true);
					layers.iclick.setActive(false);
				}
			}
		});
	map.addControl(mk);
	// New mask added
	vector.getSource().on('addfeature', function(e)
	{	if (layers.imask.getActive())
		{	this.maskFeature = e.feature;
			layers.imask.setActive(false);
			map.removeControl(mk);
			if (!this.lastPoint.img) layers.iclick.setActive(true);
			this.calc();
		}
	}, this);

	// Modification => calc new transform
	var modify = new ol.interaction.Modify(
	{	features: vector.getSource().getFeaturesCollection(),
		deleteCondition: function(event) 
		{	return ol.events.condition.shiftKeyOnly(event) &&
				ol.events.condition.singleClick(event);
		 }
	});
	map.addInteraction(modify);
	modify.on("modifyend", function()
	{	self.calc();
	});

	return layers;
}



wapp.img.prototype.getStyle = function(feature)
{	if (!feature) return [ 
		new ol.style.Style ({
			image: new ol.style.Circle(
			{	radius: 8,
				stroke: new ol.style.Stroke(
				{	color: "#fff",
					width: 3
				})
			})
		}),
		new ol.style.Style ({
			image: new ol.style.Circle(
			{	radius: 8,
				stroke: new ol.style.Stroke(
				{	color: "#000",
					width: 1
				})
			})
	})];
	
	if (feature.get("isimg")) 
	{	return [ new ol.style.Style ({
			image: new ol.style.RegularShape(
			{	radius: 10,
				points: 4,
				stroke: new ol.style.Stroke(
				{	color: "orange",
					width: 2
				})
			})
		})];
	}

	return [ new ol.style.Style ({
		image: new ol.style.Circle(
		{	radius: 8,
			stroke: new ol.style.Stroke(
			{	color: "red",
				width: 2
			})
		}),
		stroke: new ol.style.Stroke(
		{	color: "red",
			width: 2
		})
	})];
}

/** Add a destination image
*/
wapp.img.prototype.addDest = function(dataURL, map)
{	var self = this;
	var layers = {};

	//	Helmert ctrl
	var hc = new ol.control.Toggle(
		{	on: !this.getSimilarity(), 
			html: "H",
			'className': "ol-helmert",
			toggleFn: function(b) { self.setSimilarity(!b) }
		});
	map.addControl(hc);

	// Show/hide overlay
	var ov = new ol.control.Toggle(
		{	html: "<i class='fa fa-eye fa-eye-slash'></i>",
			'className': "ol-overview",
			toggleFn: function(b) 
			{	if (layers.image) layers.image.setVisible(!layers.image.getVisible());
			}
		});
	map.addControl(ov);
	map.getLayerGroup().on('change', function(e)
	{	if (!layers.image) return;
		if (layers.image.getVisible()) $("i", ov.element).removeClass("fa-eye-slash");
		else $("i", ov.element).addClass("fa-eye-slash");
	}, this);


	// Controls points
	var vector = layers.vector = new ol.layer.Vector(
	{	name: 'Vecteur',
		source: new ol.source.Vector({ features: new ol.Collection() }),
		style: this.getStyle,
		// render map control points first
		renderOrder: function(f1,f2) { if (f1.get('isimg')) return false; else return true; },
		displayInLayerSwitcher: false
	})
	map.addLayer(vector);

	// Draw links
	vector.on("precompose", function(e)
	{	if (!self.transformation.hasControlPoints) return;
		var ctx = e.context;
		ctx.beginPath();
		ctx.strokeStyle = "blue";
		ctx.strokeWidth = 3;
		var ratio = e.frameState.pixelRatio;

		for (var i=0; i<self.controlPoints.length; i++)
		{	var pt = map.getPixelFromCoordinate(self.controlPoints[i].map.getGeometry().getCoordinates());
			var pt2 = map.getPixelFromCoordinate(self.controlPoints[i].img2.getGeometry().getCoordinates());
			ctx.moveTo(pt[0]*ratio, pt[1]*ratio);
			ctx.lineTo((pt2[0])*ratio, (pt2[1])*ratio);
			ctx.stroke(); 
		}
		ctx.closePath();
	});

	// Add a new control point
	vector.getSource().on("addfeature", function(e)
	{	if (!e.feature.get('isimg')) self.addControlPoint(e.feature, false);
	});

	// Add interaction
	layers.iclick = new ol.interaction.Draw({
		type: 'Point',
		source: vector.getSource(),
		style: this.getStyle()
	});
	map.addInteraction(layers.iclick);

	// Modification => calc new transform
	var modify = new ol.interaction.Modify(
	{	features: vector.getSource().getFeaturesCollection(),
		deleteCondition: function(event) 
		{	return ol.events.condition.shiftKeyOnly(event) &&
				ol.events.condition.singleClick(event);
		}
	});
	map.addInteraction(modify);

	modify.on("modifystart", function(e)
	{	self.lastChanged_ = null;
	});
	modify.on("modifyend", function(e)
	{	if (self.lastChanged_)
		{	for (var i=0; i<self.controlPoints.length; i++)
			{	if (self.controlPoints[i].img2 === self.lastChanged_)
				{	var pt = self.controlPoints[i].img2.getGeometry().getCoordinates();
					self.sourceLayer.vector.getSource().removeFeature(self.controlPoints[i].img);
					self.controlPoints[i].img.setGeometry(new ol.geom.Point(self.revers(pt)));
					self.sourceLayer.vector.getSource().addFeature(self.controlPoints[i].img);
				}
			}
		}
		self.calc();
	});

	return layers;
}

wapp.img.prototype.addControlPoint = function(feature, img)
{	if (feature.get('id')) return;
	var id = this.lastID_ || 1;

	if (img)
	{	this.sourceLayer.iclick.setActive(false);
		this.lastPoint.img = feature;
		feature.set('id',id);
		var pt = this.transform (feature.getGeometry().getCoordinates());
		if (pt) 
		{	wapp.map.getView().setCenter(pt);
			this.lastPoint.map = new ol.Feature({ id:id, geometry: new ol.geom.Point(pt) });
			this.destLayer.vector.getSource().addFeature(this.lastPoint.map);
		}
	}
	else
	{	this.destLayer.iclick.setActive(false);
		this.lastPoint.map = feature;
		feature.set('id',id);
		var pt = this.revers (feature.getGeometry().getCoordinates());
		if (pt) 
		{	wapp.mapimg.getView().setCenter(pt);
			this.lastPoint.img = new ol.Feature({ id:id, geometry: new ol.geom.Point(pt) });
			this.sourceLayer.vector.getSource().addFeature(this.lastPoint.img);
		}
	}

	// Add a new Point
	if (this.lastPoint.map && this.lastPoint.img)
	{	this.lastPoint.img2 = new ol.Feature({ isimg:true, id:id, geometry: new ol.geom.Point([0,0]) });
		this.destLayer.vector.getSource().addFeature(this.lastPoint.img2);
		var self = this;
		this.lastPoint.img2.on ("change", function(e)
		{	self.lastChanged_ = e.target;
		});
		
		this.lastPoint.id = id;
		this.controlPoints.push(this.lastPoint);
		this.lastID_ = ++id;

		this.lastPoint = {};
		this.calc();
		this.sourceLayer.iclick.setActive(true);
		this.destLayer.iclick.setActive(true);
	}
}

/** Calc a new transformation
*/
wapp.img.prototype.calc = function()
{	if (!this.controlPoints) return;

	if (this.controlPoints.length > 1)
	{	
		var xy=[], XY=[];
		for (var i=0; i<this.controlPoints.length; i++)
		{	//var p = this.controlPoints[i].img.getGeometry().getCoordinates();
			xy.push (this.controlPoints[i].img.getGeometry().getCoordinates());
			//p = this.controlPoints[i].map.getGeometry().getCoordinates();
			XY.push (this.controlPoints[i].map.getGeometry().getCoordinates());
		}
		
		this.transformation.setControlPoints(xy,XY);

		var sc = this.transformation.getScale();
		var a = this.transformation.getRotation();
		var t = this.transformation.getTranslation();

		if (!this.destLayer.image)
		{	this.destLayer.image = new ol.layer.Image(
			{	name: this.sourceLayer.image.get("name"),
				opacity: 1,
				source: new ol.source.GeoImage(
				{	image: this.sourceLayer.image.getSource().getImage(),
					imageCenter: t,
					imageScale: sc,
					imageRotate: a,
					//projection: pixelProjection
				})
			})
			wapp.map.getLayers().insertAt(wapp.map.getLayers().getLength()-2,this.destLayer.image);
			this.destLayer.image.getSource().setCrop()
		}
		else
		{	this.destLayer.image.getSource().setRotation(a);
			this.destLayer.image.getSource().setScale(sc);
			this.destLayer.image.getSource().setCenter(t);
		}
		wapp.mapimg.getView().setRotation(a);
		if (this.transformation.hasControlPoints) for (var i=0; i<this.controlPoints.length; i++)
		{	var pt = this.controlPoints[i].img.getGeometry().getCoordinates();
			this.destLayer.vector.getSource().removeFeature(this.controlPoints[i].img2);
			this.controlPoints[i].img2.getGeometry().setCoordinates(this.transform(pt));
			this.destLayer.vector.getSource().addFeature(this.controlPoints[i].img2);
		}

		if (this.maskFeature) 
		{	var c = this.maskFeature.getGeometry().getCoordinates()[0];
			for (var i=0; i<c.length; i++) c[i] = this.transform(c[i]);
			this.destLayer.image.getSource().setMask (c);
		}
	}
}

wapp.img.prototype.transform = function(xy)
{	return this.transformation.hasControlPoints ? this.transformation.transform(xy) : false;
}
wapp.img.prototype.revers = function(xy)
{	return this.transformation.hasControlPoints ? this.transformation.revers(xy) : false;
}

/** Transform as Helmert or similarity
*/
wapp.img.prototype.setSimilarity = function(b)
{	this.transformation.similarity = (b!==false);
	this.calc();
}


wapp.img.prototype.getSimilarity = function()
{	return this.transformation.similarity;
}


