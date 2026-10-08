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
    this.rotationHandle_ = null;
    this.rotationPivot_ = null;
    this.rotationSourceFrames_ = [];
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
    if (this.isInRotationHandle_(col, row, frame)) {
      this.startRotation_(col, row, frame, overlay, event);
      return;
    }

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
    if (this.isRotating_) {
      this.rotateFrames_(col, row, overlay);
      return;
    }

    var colDiff = col - this.startCol;
    var rowDiff = row - this.startRow;
    this.currentFrameReferences_.forEach(
      function (entry) {
        this.shiftFrame(colDiff, rowDiff, entry.frame, entry.reference, event);
      }.bind(this)
    );
  };

  ns.Move.prototype.moveUnactiveToolAt = function (
    col,
    row,
    frame,
    overlay,
    event
  ) {
    var isRotationHandle = this.isInRotationHandle_(col, row, frame);
    if (isRotationHandle) {
      document.body.classList.add("selection-rotate");
      document.body.classList.remove(this.toolId);
    } else {
      document.body.classList.remove("selection-rotate");
      pskl.tools.drawing.BaseTool.prototype.moveUnactiveToolAt.apply(
        this,
        arguments
      );
    }
    this.drawRotationHandle_(overlay, frame);
  };

  ns.Move.prototype.getRotationPivot_ = function (frame) {
    return {
      x: frame.getWidth() / 2,
      y: frame.getHeight() / 2
    };
  };

  ns.Move.prototype.getRotationHandle_ = function (frame) {
    if (this.rotationHandle_) {
      return this.rotationHandle_;
    }
    return {
      col: Math.floor(frame.getWidth() / 2),
      row: Math.max(
        0,
        Math.floor(frame.getHeight() / 2) - this.getRotationHandleRadius_() - 2
      )
    };
  };

  ns.Move.prototype.isInRotationHandle_ = function (col, row, frame) {
    var handle = this.getRotationHandle_(frame);
    return this.isWithinRotationHandle_(col, row, handle);
  };

  ns.Move.prototype.drawRotationHandle_ = function (overlay, frame) {
    var handle = this.getRotationHandle_(frame);
    var pivot = this.rotationPivot_ || this.getRotationPivot_(frame);
    overlay.clear();
    pskl.PixelUtils.getLinePixels(
      Math.round(pivot.x - 0.5),
      handle.col,
      Math.round(pivot.y - 0.5),
      handle.row
    ).forEach(function (pixel) {
      overlay.setPixel(pixel.col, pixel.row, "rgba(255, 215, 0, 0.8)");
    });
    this.drawRotationHandlePixels_(overlay, handle);
  };

  ns.Move.prototype.startRotation_ = function (
    col,
    row,
    frame,
    overlay,
    event
  ) {
    var ctrlKey = pskl.utils.UserAgent.isMac ? event.metaKey : event.ctrlKey;
    var currentFrameIndex = pskl.app.piskelController.getCurrentFrameIndex();
    var targetLayers = pskl.tools.ToolsHelper.getTargetLayers(ctrlKey);
    this.rotationSourceFrames_ = pskl.tools.ToolsHelper.getFramesForLayers(
      targetLayers,
      event.shiftKey,
      currentFrameIndex
    ).map(function (targetFrame) {
      return { frame: targetFrame, reference: targetFrame.clone() };
    });
    this.rotationPivot_ = this.getRotationPivot_(frame);
    this.rotationHandle_ = this.getRotationHandle_(frame);
    this.rotationStartAngle_ = Math.atan2(
      row + 0.5 - this.rotationPivot_.y,
      col + 0.5 - this.rotationPivot_.x
    );
    this.isRotating_ = true;
    this.drawRotationHandle_(overlay, frame);
  };

  ns.Move.prototype.rotateFrames_ = function (col, row, overlay) {
    var angle =
      Math.atan2(
        row + 0.5 - this.rotationPivot_.y,
        col + 0.5 - this.rotationPivot_.x
      ) - this.rotationStartAngle_;
    this.rotationSourceFrames_.forEach(
      function (entry) {
        this.rotateFrame_(entry.frame, entry.reference, angle);
      }.bind(this)
    );
    this.rotationHandle_ = { col: col, row: row };
    overlay.clear();
    this.drawRotationHandle_(overlay);
    this.rotationAngle_ = angle;
  };

  ns.Move.prototype.rotateFrame_ = function (frame, reference, angle) {
    var width = frame.getWidth();
    var height = frame.getHeight();
    var cos = Math.cos(angle);
    var sin = Math.sin(angle);
    var pivot = this.rotationPivot_ || this.getRotationPivot_(frame);
    var transparent = pskl.utils.colorToInt(Constants.TRANSPARENT_COLOR);
    var rotatedPixels = new Uint32Array(width * height);
    rotatedPixels.fill(transparent);

    for (var col = 0; col < width; col++) {
      for (var row = 0; row < height; row++) {
        var x = col + 0.5 - pivot.x;
        var y = row + 0.5 - pivot.y;
        var sourceCol = Math.floor(pivot.x + x * cos + y * sin);
        var sourceRow = Math.floor(pivot.y - x * sin + y * cos);
        if (reference.containsPixel(sourceCol, sourceRow)) {
          rotatedPixels[row * width + col] = reference.getPixel(
            sourceCol,
            sourceRow
          );
        }
      }
    }
    frame.setPixels(rotatedPixels);
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
    if (this.isRotating_) {
      this.rotateFrames_(col, row, overlay);
      this.raiseSaveStateEvent({
        rotationAngle: this.rotationAngle_,
        isRotation: true,
        ctrlKey: pskl.utils.UserAgent.isMac ? event.metaKey : event.ctrlKey,
        shiftKey: event.shiftKey
      });
      this.isRotating_ = false;
      this.rotationSourceFrames_ = [];
      this.rotationHandle_ = null;
      this.rotationPivot_ = null;
      this.drawRotationHandle_(overlay, frame);
      return;
    }

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
    if (replayData.isRotation) {
      var currentFrameIndex = pskl.app.piskelController.getCurrentFrameIndex();
      pskl.tools.ToolsHelper.getFramesForLayers(
        pskl.tools.ToolsHelper.getTargetLayers(replayData.ctrlKey),
        replayData.shiftKey,
        currentFrameIndex
      ).forEach(
        function (targetFrame) {
          this.rotateFrame_(
            targetFrame,
            targetFrame.clone(),
            replayData.rotationAngle
          );
        }.bind(this)
      );
      return;
    }

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
