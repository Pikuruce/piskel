describe("Serialization/Deserialization test", function() {

  beforeEach(function() {
    pskl.app.piskelController = {
      getFPS: function () {
        return 1;
      }
    };
  });

  afterEach(function() {
    delete pskl.app.piskelController;
  });

  it("serializes frames correctly", function (done) {
    // Create piskel.
    var descriptor = new pskl.model.piskel.Descriptor('piskelName', 'piskelDesc');
    var piskel = new pskl.model.Piskel(1, 1, 1, descriptor);
    // Add layer.
    piskel.addLayer(new pskl.model.Layer('layer1'));
    // Add frame.
    piskel.getLayerAt(0).addFrame(pskl.model.Frame.fromPixelGrid(test.testutils.toFrameGrid([
      ["red", "black"],
      ["blue", "green"]
    ])));

    // Verify the frame is successfully added in the layer.
    expect(piskel.getLayerAt(0).getFrames().length).toBe(1);

    var serializedPiskel = pskl.utils.serialization.Serializer.serialize(piskel);

    var deserializer = pskl.utils.serialization.Deserializer;
    deserializer.deserialize(JSON.parse(serializedPiskel), function (p) {
      // Check the frame has been properly deserialized
      expect(p.getLayerAt(0).getFrames().length).toBe(1);
      var frame = p.getLayerAt(0).getFrameAt(0);
      test.testutils.frameEqualsGrid(frame, [
        ["red", "black"],
        ["blue", "green"]
      ]);
      done();
    });
  });

  it("serializes layer opacity", function(done) {
    var descriptor = new pskl.model.piskel.Descriptor('piskelName', 'piskelDesc');
    var piskel = new pskl.model.Piskel(1, 1, 1, descriptor);

    piskel.addLayer(new pskl.model.Layer('layer1'));
    piskel.addLayer(new pskl.model.Layer('layer2'));
    piskel.addLayer(new pskl.model.Layer('layer3'));

    piskel.getLayerAt(0).setOpacity(0);
    piskel.getLayerAt(1).setOpacity(0.3);
    piskel.getLayerAt(2).setOpacity(0.9);
    piskel.getLayerAt(1).setParentLayer(piskel.getLayerAt(0));

    var frame = new pskl.model.Frame(1, 1);
    piskel.getLayers().forEach(function (layer) {
      layer.addFrame(frame);
    });

    var serializedPiskel = pskl.utils.serialization.Serializer.serialize(piskel);

    var deserializer = pskl.utils.serialization.Deserializer;
    deserializer.deserialize(JSON.parse(serializedPiskel), function (p) {
      expect(p.getLayerAt(0).getOpacity()).toBe(0);
      expect(p.getLayerAt(1).getOpacity()).toBe(0.3);
      expect(p.getLayerAt(2).getOpacity()).toBe(0.9);
      expect(p.getLayerAt(1).getParentLayer()).toBe(p.getLayerAt(0));

      // Check the serialization was successful
      expect(p.getLayerAt(0).getFrames().length).toBe(1);
      done();
    });
  });

  it("preserves parent layers in history snapshots", function(done) {
    var descriptor = new pskl.model.piskel.Descriptor('piskelName', 'piskelDesc');
    var piskel = new pskl.model.Piskel(1, 1, 1, descriptor);
    var parent = new pskl.model.Layer('parent');
    var child = new pskl.model.Layer('child');
    parent.addFrame(new pskl.model.Frame(1, 1));
    child.addFrame(new pskl.model.Frame(1, 1));
    child.setParentLayer(parent);
    piskel.addLayer(parent);
    piskel.addLayer(child);

    var snapshot = pskl.utils.serialization.arraybuffer.ArrayBufferSerializer.serialize(piskel);
    pskl.utils.serialization.arraybuffer.ArrayBufferDeserializer.deserialize(
      snapshot,
      function (restoredPiskel) {
        expect(restoredPiskel.getLayerAt(1).getParentLayer()).toBe(
          restoredPiskel.getLayerAt(0)
        );
        done();
      }
    );
  });
});
