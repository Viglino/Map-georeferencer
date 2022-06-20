/** HTML5 Georeferencing Image on a map
*/


/** jQuery plugin : load an image as dataURL
*/
(function($){

jQuery.fn.loadDataURL = function (callback, scope) {
  return this.on ('change', function(e) {
    // Loop through the FileList 
    for (var i=0, f; f=e.target.files[i]; i++) {
      // Only process image files.
      if (!f.type.match('image.*')) continue;

      var reader = new FileReader();

      // Closure to capture the file information.
      reader.onload = (function(file) {
        return function(e) {
          callback.call (scope, file.name, e.target.result);
        };
      })(f);

      // Read in the image file as a data URL.
      reader.readAsDataURL(f);
    }
  });
};
})(jQuery)


var pixelProjection = new ol.proj.Projection({
  code: 'pixel',
  units: 'pixels',
  extent: [-100000, -100000, 100000, 100000]
});


/** The webapp
*/
var wapp = {
  /** Synchronize maps
  */
  synchro: true,

  /** Initialize webapp
  */
  initialize: function() {
    // Initialize loader
    $("#loader input[type=file]").loadDataURL( wapp.load, wapp );
    $("#loader button").click( function() {
      var f = $("#loader input[type=text]").val();
      var n = f.split("/").pop();
      n = n.substr(0, n.lastIndexOf('.')) || n;
      wapp.load(n, $("#loader input[type=text]").val());
    });

    // Set the maps
    this.setMap();
    this.setImageMap();
    
    // Decode source
    var p={}, hash = document.location.search;
    if (hash) {
      hash = hash.replace(/(^#|^\?)/,"").split("&");
      for (var i=0; i<hash.length;  i++) {
        var t = hash[i].split("=");
        p[t[0]] =decodeURIComponent(t[1]);
      }
    }
    if (p.lon && p.lat) {
      wapp.map.getView().setCenter(ol.proj.fromLonLat([Number(p.lon),Number(p.lat)]));
    }
    if (p.photo) {
      var n = p.photo.split("/").pop();
      n = n.substr(0, n.lastIndexOf('.')) || n;
      wapp.load(n, p.photo);
      
      var d = wapp.distProj(0.001);
      var r = Number(p.res)*d/2.54;
      wapp.map.getView().setResolution(r);

      wapp.mapimg.getView().setRotation((180-Number(p.ori))*Math.PI/180)
      
    }
  }
};

(function(){

/** Distance projetee par rapport au centre 
*/
wapp.distProj = function(dist, c) {
  if (!c) c = this.map.getView().getCenter();
  var c2 = [c[0], c[1]+1]

  return (dist / l.sphere.getistance(
    ol.proj.transform(c, 'EPSG:3857', 'EPSG:4326'),
    ol.proj.transform(c2, 'EPSG:3857', 'EPSG:4326')));

  /* old version
  // Sphere pour le calcul des mesures geodesiques 

  var wgs84Sphere = new ol.Sphere(6378137);
  if (!c) c = this.map.getView().getCenter();
  var c2 = [c[0], c[1]+1]

  return (dist / wgs84Sphere.haversineDistance(
    ol.proj.transform(c, 'EPSG:3857', 'EPSG:4326'),
    ol.proj.transform(c2, 'EPSG:3857', 'EPSG:4326')));
  */
}
})();

$(document).ready(function(){ wapp.initialize(); });

/** Define the reference map
*/
wapp.setMap = function()
{	// Layers to draw on the map
  var layers = 
  [	new ol.layer.Group(
    {	name:"baseLayer",
      layers: [
        // OSM
        new ol.layer.Tile(
        {	name: "OSM",
          source: new ol.source.OSM(),
          baseLayer: true,
          visible: false
        }),
        // IGN's map
        new ol.layer.Geoportail("GEOGRAPHICALGRIDSYSTEMS.MAPS", 
          { baseLayer:true, visible:false }),
        // Photo / mixte
        new ol.layer.Geoportail("ORTHOIMAGERY.ORTHOPHOTOS",
          { baseLayer:true, visible:true }),
        new ol.layer.Geoportail("TRANSPORTNETWORKS.ROADS",
          { baseLayer:false, visible:false })
      ],
      baseLayer: true,
      openInLayerSwitcher: true
    }),
    // Roads
    new ol.layer.Geoportail("TRANSPORTNETWORKS.ROADS",
      { visible:true })
  ];

  // New map
  var map = this.map = new ol.Map({
    target: 'map',
    view: new ol.View({
      zoom: 12,
      center: [259694, 6251211]
    }),
    controls: ol.control.defaults().extend([
      new ol.control.LayerSwitcher()
    ]),
    layers: layers
  });
  map.addControl(new ol.control.SearchNominatim({centerOnSelect:true}));
  
  // Synchronize views
  map.getView().on("change:center", function(e) {
    if (wapp.synchro) return;
    wapp.synchro = true;
    var pt = wapp.current.revers(e.target.getCenter());
    if (pt) wapp.mapimg.getView().setCenter(pt)
    wapp.synchro = false;
  });
    
  var mousePositionControl = new ol.control.MousePosition({
    coordinateFormat: ol.coordinate.createStringXY(4),
    undefinedHTML: ""
  });
  this.map.addControl(mousePositionControl);

  map.addControl(new ol.control.Permalink({visible: false}));
  // Add a new layer
  var drop = new ol.interaction.DropFile()
  window.drop = drop
  drop.on('loadstart', function (e) {
    if (/.carte$/.test(e.file.name)) {
      console.log (e.file)
      var reader = new FileReader();
      reader.onload = function() {
        var carte = JSON.parse(reader.result);
        carte.layers.forEach(function(l) {
          if (l.type==='GeoImage') {
            var source = new ol.source.GeoImage (l);
            map.addLayer(new ol.layer.Image({ title: l.name, source: source }));
          }
        });
      };
      reader.readAsText(e.file);
    }
  })
  map.addInteraction(drop);

  map.on('click', function(e) {
    if (ol.events.condition.altKeyOnly(e)) {
      var features = wapp.map.getFeaturesAtPixel(e.pixel);
      for (var i=0, f; f=features[i]; i++) {
        f = f.get('features')[0];
        if (f && f.get('id')) {
          wapp.current.delControlPoint(f.get('id'))
          break;
        }
      }
    }
  })
};


/** Add a map for the image
*/
wapp.setImageMap = function() {
  // Map for the image
  var map = this.mapimg = new ol.Map ({	
    target: 'img',
    view: new ol.View ({
      projection: pixelProjection,
      zoom: 7,
      center: [0,0]
    }),
    controls: ol.control.defaults( { rotate:false,  attribution:false } ),
    interactions: ol.interaction.defaults( { altShiftDragRotate:false, pinchRotate:false } )
  });

  this.mapimg.addControl(new ol.control.Toggle({
    'className': "ol-fullpage",
    toggleFn: function(b) {
      $("body").toggleClass("fullpage");
      wapp.map.updateSize();
      wapp.mapimg.updateSize();
      wapp.synchro = false;
    }
  }));
  
  this.mapimg.addControl(new ol.control.Toggle({
    'className': "ol-info",
    html: "&phi;",
    toggleFn: function(b) {
      var info = $("#info .inner textarea");
      $("#info").removeClass("hidden");
      if (!wapp.current.destLayer.image) {
        info.val("No georef yet!")
        return;
      }
      var source = wapp.current.destLayer.image.getSource();
      var options = {
        url: /^data/.test(source.getGeoImage().src) ? undefined : source.getGeoImage().src ,
        imageCenter: source.getCenter(),
        imageRotate: source.getRotation(),
        imageScale: source.getScale(),
        //crop: source.getCrop(),
        imageMask: source.getMask()
      };
      info.val(JSON.stringify(options).replace(/\,"/g,",\n\"").replace(/:/g,": ").replace(/^\{/,"").replace(/\}$/,""));
    }
  }));
  
  // Synchronize views
  map.getView().on("change:center", function(e) {
    if (wapp.synchro) return;
    wapp.synchro = true;
    var pt = wapp.current.transform(e.target.getCenter());
    if (pt) wapp.map.getView().setCenter(pt)
    wapp.synchro = false;
  });
  
  var mousePositionControl = new ol.control.MousePosition({
    coordinateFormat: function(xy) {
      if (wapp.imglayer && wapp.imglayer.getSource().imageSize) {
        var p = [	
          xy[0] + wapp.imglayer.getSource().imageSize[0]/2,
          wapp.imglayer.getSource().imageSize[1]/2 - xy[1]
        ];
        return (Math.round(10*p[0])/10)
          +", "+ (Math.round(10*p[1])/10);
      }
      return ""; 
    },
    undefinedHTML: ""
  });
  this.mapimg.addControl(mousePositionControl);
};


/** Load a new file
*/
wapp.load = function (name, dataURL) {
  $(".dialog").addClass("hidden");
  this.current = new wapp.img(name, dataURL, this.mapimg, this.map);
  $("#loading").removeClass("hidden");
  $("#loading img").attr('src', dataURL);
  // console.log(dataURL)
  wapp.current.sourceLayer.image.getSource().once ("change", function() {
    $("#loading").addClass("hidden");
  });
};

/** Export as map file
 */
wapp.exportMap = function() {
  var lonlat = ol.proj.toLonLat(wapp.map.getView().getCenter());
  var carte = {
    "param": {
      "lon": lonlat[0],
      "lat": lonlat[1],
      "rot": null,
      "zoom": wapp.map.getView().getZoom(),
      "titre": "Sans titre",
      "description": "",
      "status": "brouillon",
      "controlParams": {"limitGeo": "1","zoomBtn": "1","selectLayer": "1","contextMap": "0","legend": "0","scaleLine": "1","pSearchBar": "0","coords": "1","attribution": "1"},
      "proj": {"valeur": "EPSG:4326","unite": "ds"}
    },
    "layers": [{
        "type": "Geoportail",
        "name": "Plan IGN",
        "titre": "sans-titre",
        "visibility": true,
        "layer": "GEOGRAPHICALGRIDSYSTEMS.PLANIGN"
      },
    ],
    "symbolLib": { },
    "legende": { "legend": "","legendPos": "bottom-left","legendWidth": 295,"legendVisible": false,"legendtitle": "Ma légende","legendParam": {"lineHeight": 55,"width": 295} }	  
  };
  wapp.map.getLayers().forEach(function(l) {
    if (l.getSource && l.getSource() instanceof ol.source.GeoImage) {
      var source = l.getSource();
      var layer = {	
        "name": l.get('title') || l.get('name'),
        "visibility": true,
        "type": "GeoImage",
        url: /^data/.test(source.getGeoImage().src) ? undefined : source.getGeoImage().src ,
        imageCenter: source.getCenter(),
        imageRotate: source.getRotation(),
        imageScale: source.getScale(),
        //crop: source.getCrop(),
        imageMask: source.getMask()
      };
      carte.layers.push(layer);
    }
  });
  carte.layers.push({
    "dessin": true,
    "type": "Vector",
    "name": "Dessin",
    "titre": "sans-titre",
    "visibility": true,
    "opacity": 1,
    "popupContent": {},
    "style": {},
    "features": []
  });
  var file = new File([JSON.stringify(carte)], "map.carte", {type: "text/plain;charset=utf-8"});
  saveAs(file);
};
