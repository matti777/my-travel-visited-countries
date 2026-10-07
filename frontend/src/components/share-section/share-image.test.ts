import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  renderShareImage,
  SHARE_IMAGE_HEIGHT,
  SHARE_IMAGE_WIDTH,
} from "./share-image";

const emptyStats = {
  areas: [],
  uniqueVisitedCodes: new Set<string>(),
  uniqueVisitedCount: 0,
};

function setupCanvas(): {
  drawnText: Array<{ text: string; x: number; y: number }>;
  context: CanvasRenderingContext2D;
  restore: () => void;
} {
  const originalDocument = globalThis.document;
  const originalImage = globalThis.Image;
  const originalCreateObjectURL = URL.createObjectURL;
  const drawnText: Array<{ text: string; x: number; y: number }> = [];

  const context = {
    fillStyle: "",
    filter: "",
    font: "",
    shadowBlur: 0,
    shadowColor: "",
    shadowOffsetY: 0,
    textAlign: "",
    textBaseline: "",
    beginPath() {},
    roundRect() {},
    fill() {},
    drawImage() {},
    fillRect() {},
    fillText(text: string, x: number, y: number) {
      drawnText.push({ text, x, y });
    },
    measureText(text: string) {
      return { width: text.length * 8 };
    },
    restore() {},
    save() {},
  } as unknown as CanvasRenderingContext2D;

  const canvas = {
    height: 0,
    width: 0,
    getContext: () => context,
    toBlob(callback: BlobCallback, type: string) {
      callback(new Blob(["image"], { type }));
    },
  };

  class TestImage {
    decoding = "auto";
    naturalHeight = SHARE_IMAGE_HEIGHT;
    naturalWidth = SHARE_IMAGE_WIDTH;
    src = "";

    async decode(): Promise<void> {}
  }

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: () => canvas },
  });
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: TestImage,
  });
  URL.createObjectURL = () => "blob:test-share-image";

  return {
    drawnText,
    context,
    restore: () => {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: originalDocument,
      });
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        value: originalImage,
      });
      URL.createObjectURL = originalCreateObjectURL;
    },
  };
}

describe("renderShareImage", () => {
  it("renders the exact footer in a 1080 by 1350 canvas", async () => {
    const { drawnText, restore } = setupCanvas();
    try {
      const result = await renderShareImage({
        mode: "statistics",
        stats: emptyStats,
      });

      assert.equal(SHARE_IMAGE_WIDTH, 1080);
      assert.equal(SHARE_IMAGE_HEIGHT, 1350);
      assert.equal(result.jpegBlob.type, "image/jpeg");
      assert.equal(result.pngBlob.type, "image/png");
      assert.deepEqual(
        drawnText.find(({ text }) => text.startsWith("Shared from")),
        {
          text: "Shared from countriesof.earth",
          x: SHARE_IMAGE_WIDTH / 2,
          y: SHARE_IMAGE_HEIGHT - 48,
        },
      );
    } finally {
      restore();
    }
  });

  it("renders wish list title, subtitle, and rows in saved order", async () => {
    const { drawnText, restore } = setupCanvas();
    try {
      await renderShareImage({
        mode: "wishList",
        stats: emptyStats,
        wishListRows: [
          { countryCode: "FI", name: "Finland", description: "Saunas" },
          { countryCode: "SE", name: "Sweden", description: "" },
        ],
      });

      assert.deepEqual(
        drawnText
          .map(({ text }) => text)
          .filter((text) =>
            [
              "Wish List",
              "Countries I would like to visit",
              "Finland",
              "Saunas",
              "Sweden",
            ].includes(text),
          ),
        [
          "Wish List",
          "Countries I would like to visit",
          "Finland",
          "Saunas",
          "Sweden",
        ],
      );
    } finally {
      restore();
    }
  });

  it("truncates a long wish list description", async () => {
    const { drawnText, restore } = setupCanvas();
    try {
      const long = "A".repeat(200);
      await renderShareImage({
        mode: "wishList",
        stats: emptyStats,
        wishListRows: [
          { countryCode: "FI", name: "Finland", description: long },
        ],
      });

      const descLine = drawnText.find(({ text }) => text.endsWith("…"));
      assert.ok(descLine);
      assert.ok(descLine.text.length < long.length);
    } finally {
      restore();
    }
  });

  it("renders at most five wish list rows", async () => {
    const { drawnText, restore } = setupCanvas();
    try {
      const rows = Array.from({ length: 6 }, (_, i) => ({
        countryCode: "FI",
        name: `Country ${i + 1}`,
        description: "",
      }));
      await renderShareImage({
        mode: "wishList",
        stats: emptyStats,
        wishListRows: rows,
      });

      const names = drawnText.filter(({ text }) => text.startsWith("Country "));
      assert.equal(names.length, 5);
    } finally {
      restore();
    }
  });
});
