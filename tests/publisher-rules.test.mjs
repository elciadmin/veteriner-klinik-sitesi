import test from "node:test";
import assert from "node:assert/strict";
import { PUBLISHER_RULES, effectiveChannelPayload, validatePublisherPayload } from "../netlify/functions/_shared/publisher-rules.mjs";

const sample={title:"Veteriner bilgilendirmesi",text:"Kedilerde ağız sağlığı konusunda bilgilendirme.",mediaUrl:""};
const kind=url=>/\.jpe?g$/.test(url)?"image":/\.mp4$/.test(url)?"video":"unknown";

test("Google Play and X are not connected publication channels",()=>{
  assert.deepEqual(Object.keys(PUBLISHER_RULES).sort(),["website","facebook","instagram","youtube","gmb"].sort());
});

test("web and Facebook can accept text without media",()=>{
  assert.deepEqual(validatePublisherPayload(sample,["website","facebook"],kind),[]);
});

test("Instagram needs an image or video and enforces description length",()=>{
  assert.ok(validatePublisherPayload(sample,["instagram"],kind).some(x=>x.field==="media"));
  const long={...sample,channelTexts:{instagram:"x".repeat(2201)},mediaUrl:"post.jpg"};
  assert.ok(validatePublisherPayload(long,["instagram"],kind).some(x=>x.field==="text"));
});

test("YouTube validates title characters and description UTF-8 bytes",()=>{
  const payload={...sample,mediaUrl:"video.mp4",channelTitles:{youtube:"x".repeat(101)},channelTexts:{youtube:"Ş".repeat(2501)}};
  const errors=validatePublisherPayload(payload,["youtube"],kind);
  assert.ok(errors.some(x=>x.field==="title"));
  assert.ok(errors.some(x=>x.field==="text"));
});

test("channel-specific media is used without cutting the original text",()=>{
  const payload={...sample,mediaUrl:"photo.jpg",
    channelTexts:{instagram:"Kısa ve doğru açıklama."},
    channelMediaUrls:{website:"wide.jpg",instagram:"portrait.jpg",youtube:"video.mp4"}};
  assert.equal(effectiveChannelPayload(payload,"instagram").mediaUrl,"portrait.jpg");
  assert.equal(effectiveChannelPayload(payload,"instagram").text,"Kısa ve doğru açıklama.");
  assert.deepEqual(validatePublisherPayload(payload,["website","instagram","youtube"],kind),[]);
});

test("unknown channels are rejected and cannot be silently published",()=>{
  assert.ok(validatePublisherPayload(sample,["x"],kind).some(x=>x.field==="channel"));
});

test("Google Business description limit is validated",()=>{
  const payload={...sample,channelTexts:{gmb:"x".repeat(1501)}};
  assert.ok(validatePublisherPayload(payload,["gmb"],kind).some(x=>x.field==="text"));
});
