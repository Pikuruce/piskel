(function () {
  var ns = $.namespace("pskl.selection");

  ns.BaseSelection = function () {
    this.reset();
  };

  ns.BaseSelection.prototype.stringify = function () {
    return JSON.stringify({
      pixels: this.pixels,
      time: this.time
    });
  };

  ns.BaseSelection.prototype.parse = function (str) {
    var selectionData = JSON.parse(str);
    this.pixels = selectionData.pixels;
    this.time = selectionData.time;
  };

  ns.BaseSelection.prototype.reset = function () {
    this.pixels = [];
    this.hasPastedContent = false;
    this.hasTransformedContent = false;
    this.time = -1;
  };

  ns.BaseSelection.prototype.move = function (colDiff, rowDiff) {
    if (this.hasPastedContent && (colDiff || rowDiff)) {
      this.hasTransformedContent = true;
    }

    var movedPixels = [];

    for (var i = 0, l = this.pixels.length; i < l; i++) {
      var movedPixel = this.pixels[i];
      movedPixel.col += colDiff;
      movedPixel.row += rowDiff;
      movedPixels.push(movedPixel);
    }

    this.pixels = movedPixels;
  };

  ns.BaseSelection.prototype.getBounds = function (pixels) {
    pixels = pixels || this.pixels;
    if (!pixels.length) {
      return null;
    }

    return pixels.reduce(
      function (bounds, pixel) {
        bounds.left = Math.min(bounds.left, pixel.col);
        bounds.top = Math.min(bounds.top, pixel.row);
        bounds.right = Math.max(bounds.right, pixel.col);
        bounds.bottom = Math.max(bounds.bottom, pixel.row);
        return bounds;
      },
      {
        left: Infinity,
        top: Infinity,
        right: -Infinity,
        bottom: -Infinity
      }
    );
  };

  ns.BaseSelection.prototype.rotateFrom = function (sourcePixels, angle) {
    var preserveColors = this.hasPastedContent;
    var bounds = this.getBounds(sourcePixels);
    if (!bounds) {
      this.pixels = [];
      return;
    }

    var pivotX = (bounds.left + bounds.right + 1) / 2;
    var pivotY = (bounds.top + bounds.bottom + 1) / 2;
    var cos = Math.cos(angle);
    var sin = Math.sin(angle);
    var sourceMap = {};
    sourcePixels.forEach(function (pixel) {
      sourceMap[pixel.col + ":" + pixel.row] = pixel;
    });

    var corners = [
      [bounds.left, bounds.top],
      [bounds.right + 1, bounds.top],
      [bounds.left, bounds.bottom + 1],
      [bounds.right + 1, bounds.bottom + 1]
    ].map(function (corner) {
      var dx = corner[0] - pivotX;
      var dy = corner[1] - pivotY;
      return {
        x: pivotX + dx * cos - dy * sin,
        y: pivotY + dx * sin + dy * cos
      };
    });

    var minCol = Math.floor(
      Math.min.apply(
        null,
        corners.map(function (point) {
          return point.x;
        })
      )
    );
    var maxCol = Math.ceil(
      Math.max.apply(
        null,
        corners.map(function (point) {
          return point.x;
        })
      )
    );
    var minRow = Math.floor(
      Math.min.apply(
        null,
        corners.map(function (point) {
          return point.y;
        })
      )
    );
    var maxRow = Math.ceil(
      Math.max.apply(
        null,
        corners.map(function (point) {
          return point.y;
        })
      )
    );
    var samplesPerAxis = 4;
    var sampleCount = samplesPerAxis * samplesPerAxis;
    var rotatedPixels = [];

    for (var col = minCol; col < maxCol; col++) {
      for (var row = minRow; row < maxRow; row++) {
        var coverage = 0;
        var colorCounts = {};
        var colorValues = {};

        for (var sampleCol = 0; sampleCol < samplesPerAxis; sampleCol++) {
          for (var sampleRow = 0; sampleRow < samplesPerAxis; sampleRow++) {
            var x = col + (sampleCol + 0.5) / samplesPerAxis - pivotX;
            var y = row + (sampleRow + 0.5) / samplesPerAxis - pivotY;
            var sourceCol = Math.floor(pivotX + x * cos + y * sin);
            var sourceRow = Math.floor(pivotY - x * sin + y * cos);
            var sourcePixel = sourceMap[sourceCol + ":" + sourceRow];
            if (sourcePixel) {
              coverage++;
              if (preserveColors) {
                var color = sourcePixel.color || Constants.TRANSPARENT_COLOR;
                var colorKey = String(color);
                colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
                colorValues[colorKey] = color;
              }
            }
          }
        }

        if (coverage >= sampleCount / 2) {
          var dominantColor = Constants.TRANSPARENT_COLOR;
          var dominantCount = 0;
          Object.keys(colorCounts).forEach(function (colorKey) {
            if (colorCounts[colorKey] > dominantCount) {
              dominantCount = colorCounts[colorKey];
              dominantColor = colorValues[colorKey];
            }
          });
          var rotatedPixel = { col: col, row: row };
          if (preserveColors) {
            rotatedPixel.color = dominantColor;
          }
          rotatedPixels.push(rotatedPixel);
        }
      }
    }

    this.pixels = rotatedPixels;
    if (preserveColors) {
      this.hasTransformedContent = true;
    }
  };

  ns.BaseSelection.prototype.fillSelectionFromFrame = function (targetFrame) {
    this.pixels.forEach(function (pixel) {
      var color = targetFrame.getPixel(pixel.col, pixel.row);
      pixel.color = color || Constants.TRANSPARENT_COLOR;
    });

    this.hasPastedContent = true;
    this.hasTransformedContent = false;
    // Keep track of the selection time to compare between local selection and
    // paste event selections.
    this.time = Date.now();
  };
})();
