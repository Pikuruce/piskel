describe("BaseSelection rotation test", function () {
  it("rotates selected pixels around the center and preserves transparent cells", function () {
    var selection = new pskl.selection.BaseSelection();
    var red = "#ff0000";
    var blue = "#0000ff";
    selection.pixels = [
      { col: 1, row: 1, color: red },
      { col: 2, row: 1, color: blue },
      { col: 1, row: 2, color: red },
      { col: 2, row: 2, color: Constants.TRANSPARENT_COLOR }
    ];
    selection.hasPastedContent = true;

    var sourcePixels = JSON.parse(JSON.stringify(selection.pixels));
    selection.rotateFrom(sourcePixels, Math.PI / 2);

    expect(selection.hasPastedContent).toBe(true);
    expect(selection.hasTransformedContent).toBe(true);

    var rotated = {};
    selection.pixels.forEach(function (pixel) {
      rotated[pixel.col + ":" + pixel.row] = pixel.color;
    });
    expect(rotated["2:1"]).toBe(red);
    expect(rotated["2:2"]).toBe(blue);
    expect(rotated["1:1"]).toBe(red);
    expect(rotated["1:2"]).toBe(Constants.TRANSPARENT_COLOR);
  });

  it("marks copied pixel data as transformed when the selection moves", function () {
    var selection = new pskl.selection.BaseSelection();
    selection.pixels = [{ col: 1, row: 1, color: "#ff0000" }];
    selection.hasPastedContent = true;

    selection.move(2, 1);

    expect(selection.pixels[0].col).toBe(3);
    expect(selection.pixels[0].row).toBe(2);
    expect(selection.hasTransformedContent).toBe(true);
  });

  it("rotates only the selection mask until content is explicitly copied", function () {
    var selection = new pskl.selection.BaseSelection();
    selection.pixels = [
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 1, row: 2 }
    ];

    selection.rotateFrom(JSON.parse(JSON.stringify(selection.pixels)), Math.PI / 2);

    expect(selection.hasPastedContent).toBe(false);
    expect(selection.hasTransformedContent).toBe(false);
    expect(selection.pixels.every(function (pixel) {
      return typeof pixel.color === "undefined";
    })).toBe(true);
  });
});