(function () {
  var ns = $.namespace("pskl.selection");

  ns.ShapeSelection = function (pixels) {
    ns.BaseSelection.call(this);
    this.pixels = pixels;
  };

  pskl.utils.inherit(ns.ShapeSelection, ns.BaseSelection);
})();
