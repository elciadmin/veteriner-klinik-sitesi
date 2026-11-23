import test from "node:test";
import assert from "node:assert/strict";
import { safeRemoteMediaUrl } from "../netlify/functions/_shared/publisher-media-url.mjs";

test("public HTTPS video URL remains unchanged",()=>{
  assert.equal(safeRemoteMediaUrl("https://cdn.example.org/media/video.mp4?token=abc"),"https://cdn.example.org/media/video.mp4?token=abc");
});

test("reject unsafe schemes, credentials, ports and local addresses",()=>{
  for(const url of [
    "http://example.org/video.mp4",
    "file:///etc/passwd",
    "https://user:pass@example.org/video.mp4",
    "https://example.org:8080/video.mp4",
    "https://localhost/video.mp4",
    "https://localhost./video.mp4",
    "https://127.0.0.1/video.mp4",
    "https://169.254.169.254/video.mp4",
    "https://[::1]/video.mp4",
    "https://service.internal/video.mp4",
    "https://metadata.google.internal/video.mp4",
    "not a URL"
  ]) assert.throws(()=>safeRemoteMediaUrl(url),undefined,url);
});
