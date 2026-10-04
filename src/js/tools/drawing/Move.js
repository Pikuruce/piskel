/**
 * @provide pskl.tools.drawing.Move
 *
 * @require pskl.utils
 */
(function () {
  var ns = $.namespace("pskl.tools.drawing");

  ns.Move = function () {
    this.toolId = ns.Move.TOOL_ID;
    this.helpText = "Move tool";
    this.shortcut = pskl.service.keyboard.Shortcuts.TOOL.MOVE;

    this.tooltipDescriptors = [
      { key: "ctrl", description: "Apply to all layers" },
      { key: "shift", description: "Apply to all frames" },
      { key: "alt", description: "Wrap canvas borders" }
    ];

    // Stroke's first point coordinates (set in applyToolAt)
    this.startCol = null;
    this.startRow = null;
    this.currentFrameReferences_ = [];
  };

  /**
   * The move tool id is used by the ToolController and the BaseSelect and needs to be
   * easliy accessible
   */
  ns.Move.TOOL_ID = "tool-move";

  pskl.utils.inherit(ns.Move, ns.BaseTool);

  /**
   * @override
   */
  ns.Move.prototype.applyToolAt = function (col, row, frame, overlay, event) {
    this.startCol = col;
    this.startRow = row;
    var ctrlKey = pskl.utils.UserAgent.isMac ? event.metaKey : event.ctrlKey;
    var currentFrameIndex = pskl.app.piskelController.getCurrentFrameIndex();
    this.currentFrameReferences_ = pskl.tools.ToolsHelper.getTargetLayers(
      ctrlKey
    ).map(function (layer) {
      var targetFrame = layer.getFrameAt(currentFrameIndex);
      return { frame: targetFrame, reference: targetFrame.clone() };
    });
  };

  ns.Move.prototype.moveToolAt = function (col, row, frame, overlay, event) {
    var colDiff = col - this.startCol;
    var rowDiff = row - this.startRow;
    this.currentFrameReferences_.forEach(
      function (entry) {
        this.shiftFrame(colDiff, rowDiff, entry.frame, entry.reference, event);
      }.bind(this)
    );
  };

  ns.Move.prototype.shiftFrame = function (
    colDiff,
    rowDiff,
    frame,
    reference,
    event
  ) {
    var color;
    var w = frame.getWidth();
    var h = frame.getHeight();
    for (var col = 0; col < w; col++) {
      for (var row = 0; row < h; row++) {
        var x = col - colDiff;
        var y = row - rowDiff;
        if (event.altKey) {
          x = (x + w) % w;
          y = (y + h) % h;
        }
        if (reference.containsPixel(x, y)) {
          color = reference.getPixel(x, y);
        } else {
          color = Constants.TRANSPARENT_COLOR;
        }
        frame.setPixel(col, row, color);
      }
    }
  };

  /**
   * @override
   */
  ns.Move.prototype.releaseToolAt = function (col, row, frame, overlay, event) {
    var colDiff = col - this.startCol;
    var rowDiff = row - this.startRow;

    var ctrlKey = pskl.utils.UserAgent.isMac ? event.metaKey : event.ctrlKey;
    var targetLayers = pskl.tools.ToolsHelper.getTargetLayers(ctrlKey);
    var currentFrameIndex = pskl.app.piskelController.getCurrentFrameIndex();
    pskl.tools.ToolsHelper.getFramesForLayers(
      targetLayers,
      event.shiftKey,
      currentFrameIndex
    ).forEach(
      function (f) {
        var savedFrame = this.currentFrameReferences_.find(function (entry) {
          return entry.frame === f;
        });
        var reference = savedFrame ? savedFrame.reference : f.clone();
        this.shiftFrame(colDiff, rowDiff, f, reference, event);
      }.bind(this)
    );

    this.raiseSaveStateEvent({
      colDiff: colDiff,
      rowDiff: rowDiff,
      ctrlKey: ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey
    });
  };

  ns.Move.prototype.replay = function (frame, replayData) {
    var event = {
      shiftKey: replayData.shiftKey,
      altKey: replayData.altKey,
      ctrlKey: replayData.ctrlKey
    };
    var targetLayers = pskl.tools.ToolsHelper.getTargetLayers(event.ctrlKey);
    var currentFrameIndex = pskl.app.piskelController.getCurrentFrameIndex();
    pskl.tools.ToolsHelper.getFramesForLayers(
      targetLayers,
      event.shiftKey,
      currentFrameIndex
    ).forEach(
      function (frame) {
        this.shiftFrame(
          replayData.colDiff,
          replayData.rowDiff,
          frame,
          frame.clone(),
          event
        );
      }.bind(this)
    );
  };

  ns.Move.prototype.supportsAlt = function () {
    return true;
  };
})();
