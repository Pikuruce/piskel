/**
 * @provide pskl.tools.drawing.selection.BaseSelect
 *
 * @require pskl.utils
 */
(function () {
  var ns = $.namespace("pskl.tools.drawing.selection");

  ns.BaseSelect = function () {
    this.secondaryToolId = pskl.tools.drawing.Move.TOOL_ID;

    // Select's first point coordinates (set in applyToolAt)
    this.startCol = null;
    this.startRow = null;

    this.lastMoveCol = null;
    this.lastMoveRow = null;

    this.selection = null;
    this.hasSelection = false;
    this.rotationHandle_ = null;
    this.rotationSourcePixels_ = null;

    this.tooltipDescriptors = [
      {
        description:
          "Drag the selection to move it. You may switch to other layers and frames."
      },
      { key: "ctrl+c", description: "Copy the selected area" },
      { key: "ctrl+v", description: "Paste the copied area" },
      { key: "shift", description: "Hold to move the content" }
    ];

    $.subscribe(
      Events.SELECTION_DISMISSED,
      this.onSelectionDismissed_.bind(this)
    );
  };

  pskl.utils.inherit(ns.BaseSelect, pskl.tools.drawing.BaseTool);

  /**
   * @override
   */
  ns.BaseSelect.prototype.applyToolAt = function (
    col,
    row,
    frame,
    overlay,
    event
  ) {
    this.startCol = col;
    this.startRow = row;

    this.lastMoveCol = col;
    this.lastMoveRow = row;

    // The select tool can be in two different state.
    // If the initial click of the tool is not on a selection, we go in 'select'
    // mode to create a selection.
    // If the initial click is on a previous selection, we go in 'moveSelection'
    // mode to allow to move the selection by drag'n dropping it.
    if (this.isInRotationHandle(col, row)) {
      this.mode = "rotateSelection";
      this.startRotation_(col, row, frame, overlay, event);
    } else if (!this.isInSelection(col, row)) {
      this.mode = "select";
      this.onSelectStart_(col, row, frame, overlay);
    } else {
      this.mode = "moveSelection";
      if (event.shiftKey && !this.isMovingContent_) {
        this.isMovingContent_ = true;
        $.publish(Events.CLIPBOARD_CUT);
        this.drawSelectionOnOverlay_(overlay);
      }
      this.onSelectionMoveStart_(col, row, frame, overlay);
    }
  };

  /**
   * @override
   */
  ns.BaseSelect.prototype.moveToolAt = function (
    col,
    row,
    frame,
    overlay,
    event
  ) {
    if (this.mode == "select") {
      this.onSelect_(col, row, frame, overlay);
    } else if (this.mode == "moveSelection") {
      this.onSelectionMove_(col, row, frame, overlay);
    } else if (this.mode == "rotateSelection") {
      this.onSelectionRotate_(col, row, overlay);
    }
  };

  /**
   * @override
   */
  ns.BaseSelect.prototype.releaseToolAt = function (
    col,
    row,
    frame,
    overlay,
    event
  ) {
    if (this.mode == "select") {
      this.onSelectEnd_(col, row, frame, overlay);
    } else if (this.mode == "moveSelection") {
      this.onSelectionMoveEnd_(col, row, frame, overlay);
    } else if (this.mode == "rotateSelection") {
      this.onSelectionRotateEnd_(col, row, overlay);
    }
  };

  /**
   * If we mouseover the selection draw inside the overlay frame, show the 'move' cursor
   * instead of the 'select' one. It indicates that we can move the selection by dragndroping it.
   * @override
   */
  ns.BaseSelect.prototype.moveUnactiveToolAt = function (
    col,
    row,
    frame,
    overlay,
    event
  ) {
    document.body.classList.remove("selection-rotate");
    if (this.isInRotationHandle(col, row)) {
      document.body.classList.add("selection-rotate");
      document.body.classList.remove(this.secondaryToolId);
      document.body.classList.remove(this.toolId);
    } else if (overlay.containsPixel(col, row)) {
      document.body.classList.remove("selection-rotate");
      if (this.isInSelection(col, row)) {
        // We're hovering the selection, show the move tool:
        document.body.classList.add(this.secondaryToolId);
        document.body.classList.remove(this.toolId);
      } else {
        // We're not hovering the selection, show create selection tool:
        document.body.classList.add(this.toolId);
        document.body.classList.remove(this.secondaryToolId);
      }
    }

    if (!this.hasSelection) {
      pskl.tools.drawing.BaseTool.prototype.moveUnactiveToolAt.apply(
        this,
        arguments
      );
    }
  };

  ns.BaseSelect.prototype.isInSelection = function (col, row) {
    return (
      this.selection &&
      this.selection.pixels.some(function (pixel) {
        return pixel.col === col && pixel.row === row;
      })
    );
  };

  ns.BaseSelect.prototype.isInRotationHandle = function (col, row) {
    var handle = this.getRotationHandle_();
    return !!handle && this.isWithinRotationHandle_(col, row, handle);
  };

  ns.BaseSelect.prototype.getRotationHandle_ = function () {
    if (this.rotationHandle_) {
      return this.rotationHandle_;
    }
    if (!this.selection || !this.selection.pixels.length) {
      return null;
    }

    var bounds = this.selection.getBounds();
    var handleRadius = this.getRotationHandleRadius_();
    return {
      col: Math.floor((bounds.left + bounds.right) / 2),
      row: Math.max(0, bounds.top - handleRadius - 2)
    };
  };

  ns.BaseSelect.prototype.startRotation_ = function (
    col,
    row,
    frame,
    overlay,
    event
  ) {
    if (event.shiftKey && !this.isMovingContent_) {
      this.isMovingContent_ = true;
      $.publish(Events.CLIPBOARD_CUT);
    }
    this.rotationSourcePixels_ = JSON.parse(
      JSON.stringify(this.selection.pixels)
    );
    var bounds = this.selection.getBounds(this.rotationSourcePixels_);
    this.rotationPivot_ = {
      x: (bounds.left + bounds.right + 1) / 2,
      y: (bounds.top + bounds.bottom + 1) / 2
    };
    this.rotationStartAngle_ = Math.atan2(
      row + 0.5 - this.rotationPivot_.y,
      col + 0.5 - this.rotationPivot_.x
    );
    this.rotationHandle_ = this.getRotationHandle_();
    this.drawSelectionOnOverlay_(overlay);
  };

  ns.BaseSelect.prototype.onSelectionRotate_ = function (col, row, overlay) {
    var angle =
      Math.atan2(
        row + 0.5 - this.rotationPivot_.y,
        col + 0.5 - this.rotationPivot_.x
      ) - this.rotationStartAngle_;
    this.selection.rotateFrom(this.rotationSourcePixels_, angle);
    this.rotationHandle_ = { col: col, row: row };
    overlay.clear();
    this.drawSelectionOnOverlay_(overlay);
  };

  ns.BaseSelect.prototype.onSelectionRotateEnd_ = function (col, row, overlay) {
    this.onSelectionRotate_(col, row, overlay);
    this.rotationSourcePixels_ = null;
    this.rotationHandle_ = null;
    overlay.clear();
    this.drawSelectionOnOverlay_(overlay);
  };

  /**
   * Protected method, should be called when the selection is committed,
   * typically by clicking outside of the selected area.
   */
  ns.BaseSelect.prototype.commitSelection = function () {
    if (this.isMovingContent_) {
      $.publish(Events.CLIPBOARD_PASTE);
      this.isMovingContent_ = false;
    }

    // Clean previous selection:
    $.publish(Events.SELECTION_DISMISSED);
  };

  /**
   * Protected method, should be called when the selection is dismissed.
   */
  ns.BaseSelect.prototype.onSelectionDismissed_ = function () {
    var overlay = pskl.app.drawingController.overlayFrame;
    overlay.clear();
    this.hasSelection = false;
    this.rotationHandle_ = null;
    this.rotationSourcePixels_ = null;
    this.rotationPivot_ = null;
    document.body.classList.remove("selection-rotate");
  };

  /**
   * For each pixel in the selection draw it in white transparent on the tool overlay
   * @protected
   */
  ns.BaseSelect.prototype.drawSelectionOnOverlay_ = function (overlay) {
    var pixels = this.selection.pixels;
    for (var i = 0, l = pixels.length; i < l; i++) {
      var pixel = pixels[i];
      var hasColor = pixel.color && pixel.color !== Constants.TRANSPARENT_COLOR;
      var color = hasColor
        ? this.getTransparentVariant_(pixel.color)
        : Constants.SELECTION_TRANSPARENT_COLOR;

      overlay.setPixel(pixels[i].col, pixels[i].row, color);
    }

    var handle = this.getRotationHandle_();
    if (handle) {
      var pivot = this.rotationPivot_ || this.getSelectionPivot_();
      var line = pskl.PixelUtils.getLinePixels(
        Math.round(pivot.x - 0.5),
        handle.col,
        Math.round(pivot.y - 0.5),
        handle.row
      );
      line.forEach(function (pixel) {
        overlay.setPixel(pixel.col, pixel.row, "rgba(255, 215, 0, 0.8)");
      });
      this.drawRotationHandlePixels_(overlay, handle);
    }
  };

  ns.BaseSelect.prototype.getSelectionPivot_ = function () {
    var bounds = this.selection.getBounds();
    return {
      x: (bounds.left + bounds.right + 1) / 2,
      y: (bounds.top + bounds.bottom + 1) / 2
    };
  };

  ns.BaseSelect.prototype.getTransparentVariant_ =
    pskl.utils.FunctionUtils.memo(function (colorStr) {
      var color = window.tinycolor(colorStr);
      color = window.tinycolor.lighten(color, 10);
      color.setAlpha(0.5);
      return color.toRgbString();
    }, {});

  // The list of callbacks to implement by specialized tools to implement the selection creation behavior.
  /** @protected */
  ns.BaseSelect.prototype.onSelectStart_ = function (
    col,
    row,
    frame,
    overlay
  ) {};
  /** @protected */
  ns.BaseSelect.prototype.onSelect_ = function (col, row, frame, overlay) {};
  /** @protected */
  ns.BaseSelect.prototype.onSelectEnd_ = function (col, row, frame, overlay) {};

  // The list of callbacks that define the drag'n drop behavior of the selection.
  /** @private */

  ns.BaseSelect.prototype.onSelectionMoveStart_ = function (
    col,
    row,
    frame,
    overlay
  ) {};

  /** @private */
  ns.BaseSelect.prototype.onSelectionMove_ = function (
    col,
    row,
    frame,
    overlay
  ) {
    var deltaCol = col - this.lastMoveCol;
    var deltaRow = row - this.lastMoveRow;

    this.selection.move(deltaCol, deltaRow);
    this.rotationPivot_ = null;
    this.rotationHandle_ = null;

    overlay.clear();
    this.drawSelectionOnOverlay_(overlay);

    this.lastMoveCol = col;
    this.lastMoveRow = row;
  };

  /** @private */
  ns.BaseSelect.prototype.onSelectionMoveEnd_ = function (
    col,
    row,
    frame,
    overlay
  ) {
    this.onSelectionMove_(col, row, frame, overlay);
  };
})();
