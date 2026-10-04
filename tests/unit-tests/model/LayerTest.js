describe("Layer model test", function() {

  beforeEach(function() {});
  afterEach(function() {});

  it("has proper defaults", function() {
    var layer = new pskl.model.Layer('layerName');

    expect(layer.getOpacity()).toBe(1);
    expect(layer.getFrames().length).toBe(0);
    expect(layer.getName()).toBe('layerName');
    expect(layer.getParentLayer()).toBeNull();
  });

  it("supports parent layers without allowing cycles", function() {
    var parent = new pskl.model.Layer('parent');
    var child = new pskl.model.Layer('child');
    var grandchild = new pskl.model.Layer('grandchild');

    expect(child.setParentLayer(parent)).toBe(true);
    expect(grandchild.setParentLayer(child)).toBe(true);
    expect(parent.setParentLayer(grandchild)).toBe(false);
    expect(child.setParentLayer(child)).toBe(false);
    expect(grandchild.getParentLayer()).toBe(child);
  });

  it("can set opacity", function() {
    var layer = new pskl.model.Layer('layerName');

    layer.setOpacity(0.5);
    expect(layer.getOpacity()).toBe(0.5);
  });

  it("ignores bad opacity", function() {
    var layer = new pskl.model.Layer('layerName');

    layer.setOpacity(0.3);
    expect(layer.getOpacity()).toBe(0.3);

    layer.setOpacity('Yep I\'m an opacity, let me in !');
    expect(layer.getOpacity()).toBe(0.3);

    layer.setOpacity(9000);
    expect(layer.getOpacity()).toBe(0.3);

    layer.setOpacity(-1);
    expect(layer.getOpacity()).toBe(0.3);

    layer.setOpacity(null);
    expect(layer.getOpacity()).toBe(0.3);
  });
});