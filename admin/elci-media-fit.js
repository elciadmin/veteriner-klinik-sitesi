/* Elçi Yayın Merkezi — crop-free image adaptation (canvas, browser-side). */
(() => {
  "use strict";
  // Design targets, not claims that these are the platforms' exclusive allowed dimensions.
  const targets = Object.freeze({
    instagram:{width:1080,height:1350,label:"Instagram akışı · 4:5"},
    facebook:{width:1200,height:1200,label:"Facebook akışı · 1:1"},
    gmb:{width:1200,height:900,label:"Google İşletme · 4:3"},
    website:{width:1200,height:900,label:"Web sitesi · 4:3"}
  });
  const MAX_BYTES = 5*1024*1024; // Current upload endpoint; never bypass limits client-side.

  async function decodeImage(file) {
    const url=URL.createObjectURL(file);
    const img=new Image();
    try {
      img.src=url;
      await img.decode();
      if(!img.naturalWidth||!img.naturalHeight) throw new Error("Görsel boyutları alınamadı");
      return img;
    }finally { URL.revokeObjectURL(url); }
  }
  function drawContain(ctx,img,width,height){
    const scale=Math.min(width/img.naturalWidth,height/img.naturalHeight);
    const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
    ctx.drawImage(img,(width-w)/2,(height-h)/2,w,h);
  }
  function drawCover(ctx,img,width,height){
    const scale=Math.max(width/img.naturalWidth,height/img.naturalHeight);
    const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
    ctx.drawImage(img,(width-w)/2,(height-h)/2,w,h);
  }
  async function blobFor(canvas,maxBytes){
    for(const quality of [.91,.85,.77,.66,.55,.42]){
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
      if(!blob) throw new Error("Uyarlanmış görsel oluşturulamadı");
      if(blob.size<=maxBytes) return blob;
    }
    throw new Error("Görsel mevcut güvenli yükleme sınırına sığmadı; daha düşük çözünürlüklü dosya kullanın.");
  }
  async function adaptImage(file,channel,options={}){
    const target=targets[channel];
    if(!target) return null;
    if(!file?.type?.startsWith("image/")) throw new Error("Uyarlama için JPG, PNG veya WEBP görsel seçin.");
    const img=await decodeImage(file);
    const canvas=document.createElement("canvas");
    canvas.width=target.width;
    canvas.height=target.height;
    const ctx=canvas.getContext("2d");
    if(!ctx) throw new Error("Bu tarayıcıda görsel dönüştürme kullanılamıyor.");
    const mode=options.mode === "solid" ? "solid" : "blur";
    if(mode==="solid"){
      ctx.fillStyle=/^#[0-9a-f]{6}$/i.test(options.color||"") ? options.color : "#ffffff";
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }else{
      // Background may be a blurred, expanded copy; the MAIN image below is never cropped.
      ctx.save();
      ctx.filter="blur(32px) brightness(.9)";
      drawCover(ctx,img,canvas.width,canvas.height);
      ctx.restore();
      ctx.fillStyle="rgba(255,255,255,.20)";
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    drawContain(ctx,img,canvas.width,canvas.height);
    const blob=await blobFor(canvas,MAX_BYTES);
    const original=String(file.name||"gorsel").replace(/\.[^.]+$/,"").replace(/[^a-zA-Z0-9_-]+/g,"-").slice(0,70)||"gorsel";
    return {
      file:new File([blob],original+"-"+channel+".jpg",{type:"image/jpeg"}),
      width:canvas.width,height:canvas.height,
      label:target.label,
      size:blob.size
    };
  }
  window.ElciMediaFit=Object.freeze({targets,adaptImage});
})();
