const fs = require("fs");
const os = require("os");
const path = require("path");
const { verifyUploadedFile } = require("../src/middleware/upload");

describe("uploaded file signature validation", () => {
  let directory;
  beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), "teacherhub-upload-test-")); });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  function file(name, mimetype, bytes) {
    const filePath = path.join(directory, name);
    fs.writeFileSync(filePath, bytes);
    return { path: filePath, mimetype, originalname: name };
  }

  test("rejects arbitrary text that claims to be a PDF", () => {
    expect(verifyUploadedFile(file("spoof.pdf", "application/pdf", Buffer.from("plain text, not a PDF")))).toBe(false);
  });

  test("accepts a PDF signature preceded by whitespace within the allowed header window", () => {
    const input = file("valid-header.pdf", "application/pdf", Buffer.from(`${" ".repeat(20)}%PDF-1.7\n`));
    expect(verifyUploadedFile(input)).toBe(true);
  });

  test("rejects an image whose content does not match its declared MIME type", () => {
    expect(verifyUploadedFile(file("spoof.png", "image/png", Buffer.from("not a PNG file")))).toBe(false);
  });
});
