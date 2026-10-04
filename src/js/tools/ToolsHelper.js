var ns = $.namespace("pskl.tools");

ns.ToolsHelper = {
  /**
   * Retrieve a list of frames containing either :
   * - only the current frame (useAllLayers = false, useAllFrames = false)
   * - only the frames of the current layer (useAllLayers = false, useAllFrames = true)
   * - only the frames at the currentIndex in each layer  (useAllLayers = true, useAllFrames = false)
   * - all frames  (useAllLayers = true, useAllFrames = true)
   *
   * @param  {Boolean} useAllLayers true if frames from all layers should be returned
   * @param  {Boolean} useAllFrames true if frames at any index should be returned
   * @return {Array[Frame]} list of Frame instances, can be empty
   */
  getTargetFrames: function (useAllLayers, useAllFrames) {
    var currentFrameIndex = pskl.app.piskelController.getCurrentFrameIndex();
    var layers = useAllLayers
      ? pskl.app.piskelController.getLayers()
      : [pskl.app.piskelController.getCurrentLayer()];
    return this.getFramesForLayers(layers, useAllFrames, currentFrameIndex);
  },

  getFramesForLayers: function (layers, useAllFrames, frameIndex) {
    return layers.reduce(function (previous, layer) {
      var frames = useAllFrames
        ? layer.getFrames()
        : [layer.getFrameAt(frameIndex)];
      return previous.concat(frames);
    }, []);
  },

  getTargetLayers: function (useAllLayers) {
    var controller = pskl.app.piskelController;
    var allLayers = controller.getLayers();
    if (useAllLayers) {
      return allLayers;
    }

    var targetLayers = [controller.getCurrentLayer()];
    for (var index = 0; index < targetLayers.length; index++) {
      var parentLayer = targetLayers[index];
      allLayers.forEach(function (layer) {
        if (
          layer.getParentLayer() === parentLayer &&
          targetLayers.indexOf(layer) === -1
        ) {
          targetLayers.push(layer);
        }
      });
    }
    return targetLayers;
  }
};
