(() => {
  const $ = selector => document.querySelector(selector);
  const login = $("#login");
  const app = $("#app");
  const channelsEl = $("#channels");
  const statusEl = $("#channelStatus");
  const resultsEl = $("#results");
  const historyEl = $("#history");
  const icons = {
    website:"fa-solid fa-globe",
    facebook:"fa-brands fa-facebook-f",
    instagram:"fa-brands fa-instagram",
    youtube:"fa-brands fa-youtube",
    gmb:"fa-brands fa-google"
  };
  let user = null;
  let status = {};
  let connectionState = {};
  let rules = {};
  let channelTexts = {};
  let channelTitles = {};
  let draftLoaded = false;
  let pendingPublish = false;
  let draftTimer = null;
  const DRAFT_KEY = "elci-yayin-merkezi-draft-v1";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[char]));

  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.remove("hidden");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.add("hidden"), 4200);
  }

  function selectedChannels() {
    return Array.from(document.querySelectorAll('input[name="channel"]:checked')).map(input => input.value);
  }

  function formSnapshot() {
    return {
      title:$("#title")?.value || "",
      text:$("#text")?.value || "",
      mediaUrl:$("#mediaUrl")?.value || "",
      youtubePrivacy:$("#youtubePrivacy")?.value || "public",
      channels:selectedChannels(),
      channelTexts:{...channelTexts},
      channelTitles:{...channelTitles},
      savedAt:new Date().toISOString()
    };
  }

  function updateCounters() {
    $("#titleCount").textContent = String(($("#title")?.value || "").length);
    $("#textCount").textContent = String(($("#text")?.value || "").length);
  }

  function saveDraft(silent=false) {
    try {
      const data=formSnapshot();
      localStorage.setItem(DRAFT_KEY,JSON.stringify(data));
      const stateEl=$("#draftState");
      if (stateEl) stateEl.textContent = "Taslak kaydedildi · " + new Date().toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
      if (!silent) toast("Taslak kaydedildi.");
    } catch {
      if (!silent) toast("Taslak bu tarayıcıda kaydedilemedi.");
    }
  }

  function scheduleDraftSave() {
    clearTimeout(draftTimer);
    draftTimer=setTimeout(()=>saveDraft(true),700);
  }

  function restoreDraft() {
    if (draftLoaded) return;
    draftLoaded=true;
    try {
      const raw=localStorage.getItem(DRAFT_KEY);
      if (!raw) { updateCounters(); return; }
      const data=JSON.parse(raw);
      if (data && typeof data==="object") {
        if ($("#title") && !$("#title").value) $("#title").value=data.title || "";
        if ($("#text") && !$("#text").value) $("#text").value=data.text || "";
        if ($("#mediaUrl") && !$("#mediaUrl").value) $("#mediaUrl").value=data.mediaUrl || "";
        if ($("#youtubePrivacy") && data.youtubePrivacy) $("#youtubePrivacy").value=data.youtubePrivacy;
        channelTexts=data.channelTexts && typeof data.channelTexts === "object" ? data.channelTexts : {};
        channelTitles=data.channelTitles && typeof data.channelTitles === "object" ? data.channelTitles : {};
        if (Array.isArray(data.channels)) {
          document.querySelectorAll('input[name="channel"]').forEach(input => {
            if (!input.disabled) input.checked=data.channels.includes(input.value);
          });
        }
        const stateEl=$("#draftState");
        if (stateEl && data.savedAt) stateEl.textContent="Kayıtlı taslak geri yüklendi · " + new Date(data.savedAt).toLocaleString("tr-TR");
      }
    } catch {}
    updateCounters();
    syncApplicability();
  }


  const charCount = value => Array.from(String(value || "")).length;
  const byteCount = value => new TextEncoder().encode(String(value || "")).length;
  const channelText = key => Object.hasOwn(channelTexts,key) ? channelTexts[key] : ($("#text")?.value || "");
  const channelTitle = key => Object.hasOwn(channelTitles,key) ? channelTitles[key] : ($("#title")?.value || "");
  const measure = (value,rule) => rule.maxTextBytes ? byteCount(value) : charCount(value);

  function ruleFeedback(key,field,value) {
    const rule=rules[key] || {};
    const limit=field === "title" ? rule.maxTitleChars : (rule.maxTextBytes || rule.maxTextChars);
    if (!limit) return "";
    const count=field === "title" ? charCount(value) : measure(value,rule);
    const unit=field === "text" && rule.maxTextBytes ? "bayt (UTF-8)" : "karakter";
    return {text:count + "/" + limit + " " + unit,className:count > limit ? "invalid" : ""};
  }

  function renderChannelRules() {
    const root=$("#channelRules");
    if (!root) return;
    const chosen=selectedChannels();
    if (!chosen.length) {
      root.textContent="Önce yayın yapılacak kanalları seçin.";
      return;
    }
    root.innerHTML=chosen.map(key => {
      const rule=rules[key];
      if (!rule) return '<div class="rule-notice">' + esc(key) + ' için kurallar henüz yüklenmedi.</div>';
      const text=channelText(key);
      const title=channelTitle(key);
      const feedback=ruleFeedback(key,"text",text);
      const titleFeedback=ruleFeedback(key,"title",title);
      const media=mediaKindFromInputs();
      const mediaOk=rule.media.includes(media);
      return '<div class="platform-rule" data-rule="' + esc(key) + '">' +
        '<div class="platform-rule-head"><strong>' + esc(rule.label) + '</strong><small>' + esc(rule.source || "Kural kontrolü") + '</small></div>' +
        (rule.maxTitleChars ? '<label>Bu platformun başlığı' +
          '<input type="text" data-channel-edit="' + esc(key) + '" data-edit-field="title" value="' + esc(title) + '">' +
          '<span class="rule-count ' + (titleFeedback?.className || "") + '" data-count="title">' + esc(titleFeedback?.text || "") + '</span></label>' : '') +
        '<label>Bu platformun açıklaması' +
          '<textarea data-channel-edit="' + esc(key) + '" data-edit-field="text">' + esc(text) + '</textarea>' +
          '<span class="rule-count ' + (feedback?.className || "") + '" data-count="text">' + esc(feedback?.text || "") + '</span>' +
        '</label>' +
        ((rule.maxTextChars || rule.maxTextBytes) ? '<button type="button" class="rule-shortener" data-shorten="' + esc(key) + '">Kısaltma taslağı öner</button>' : '') +
        (!mediaOk ? '<div class="rule-notice">Medya uyumsuz: ' + esc(media) + '. Bu platform için farklı bir medya seçilmesi gerekiyor.</div>' : '') +
        (media==="image" && window.ElciMediaFit?.targets[key] ?
          '<div class="rule-note">Kırpmasız görsel: ' + esc(window.ElciMediaFit.targets[key].label) + ' (' +
          window.ElciMediaFit.targets[key].width + '×' + window.ElciMediaFit.targets[key].height +
          '). Görselin tamamı korunur; kalan alan bulanık arka planla doldurulur.</div>' : '') +
        '<small>Metin yalnızca bu kanalda kullanılır. Son onaydan önce klinik ve tıbbi doğruluğunu kontrol edin.</small>' +
      '</div>';
    }).join("");
  }

  function validateLocal(chosen=selectedChannels()) {
    const issues=[];
    const kind=mediaKindFromInputs();
    for (const key of chosen) {
      const rule=rules[key];
      if (!rule) {issues.push("Platform kuralları henüz yüklenmedi: "+key);continue;}
      const text=channelText(key),title=channelTitle(key);
      if (!text.trim() || !title.trim()) issues.push(rule.label+": başlık ve açıklama boş olamaz");
      if (!rule.media.includes(kind)) issues.push(rule.label+": seçilen medya türü uygun değil");
      if (rule.maxTextChars && charCount(text) > rule.maxTextChars) issues.push(rule.label+": açıklama "+rule.maxTextChars+" karakteri aşıyor");
      if (rule.maxTextBytes && byteCount(text) > rule.maxTextBytes) issues.push(rule.label+": açıklama "+rule.maxTextBytes+" baytı aşıyor");
      if (rule.maxTitleChars && charCount(title) > rule.maxTitleChars) issues.push(rule.label+": başlık "+rule.maxTitleChars+" karakteri aşıyor");
    }
    return issues;
  }

  // Non-AI draft helper: never publishes its own suggestions and cannot guarantee clinical completeness.
  function shortenSuggestion(raw,rule) {
    const max=rule.maxTextBytes || rule.maxTextChars;
    const count=value => measure(value,rule);
    const text=String(raw || "").trim().replace(/\s+/g," ");
    if (!max || count(text) <= max) return text;
    const sentences=text.match(/[^.!?]+[.!?]?/g) || [];
    let result="";
    for (const sentence of sentences) {
      const candidate=(result + " " + sentence.trim()).trim();
      if (count(candidate) > max) break;
      result=candidate;
    }
    if (result) return result;
    let part="";
    for (const char of Array.from(text)) {
      if (count(part + char + "…") > max) break;
      part+=char;
    }
    return part.replace(/\s+\S*$/u,"").trim() + "…";
  }

  function previewMediaMarkup() {
    const file=$("#mediaFile")?.files && $("#mediaFile").files[0];
    const url=file ? URL.createObjectURL(file) : ($("#mediaUrl")?.value || "").trim();
    const kind=mediaKindFromInputs();
    if (!url) return '<div class="preview-media empty">Medya eklenmedi</div>';
    if (kind==="image") return '<div class="preview-media"><img src="' + esc(url) + '" alt="Yayın görseli önizlemesi"></div>';
    if (kind==="video") return '<div class="preview-media"><video src="' + esc(url) + '" controls preload="metadata"></video></div>';
    return '<div class="preview-media empty">Medya bağlantısı önizlenemiyor; yayın sırasında bağlantı kullanılacak.</div>';
  }

  function renderPreview() {
    const title=($("#title")?.value || "").trim();
    const text=($("#text")?.value || "").trim();
    const selected=selectedChannels();
    if (!title || !text) { toast("Önizleme için başlık ve yayın metni gerekli."); return false; }
    if (!selected.length) { toast("Önizleme için en az bir hazır kanal seçin."); return false; }
    const issues=validateLocal(selected);
    if (issues.length) { toast(issues[0]); return false; }
    const badges=selected.map(key => {
      const item=status[key] || {label:key};
      return '<span class="preview-channel"><i class="' + (icons[key] || "fa-solid fa-share-nodes") + '"></i>' + esc(item.label) + '</span>';
    }).join("");
    $("#previewContent").innerHTML =
      '<div class="preview-channels">' + badges + '</div>' +
      '<article class="preview-post">' +
        previewMediaMarkup() +
        '<div class="preview-copy"><h3>' + esc(title) + '</h3><p>' + esc(text).replace(/\n/g,"<br>") + '</p>' +
          selected.map(key => '<div class="platform-preview"><h4>' + esc((rules[key] || {}).label || key) + '</h4>' +
            '<strong>' + esc(channelTitle(key)) + '</strong><p>' + esc(channelText(key)) + '</p></div>').join("") +
        '</div>' +
      '</article>';
    $("#previewModal").classList.remove("hidden");
    return true;
  }

  function closePreview() {
    $("#previewModal").classList.add("hidden");
    pendingPublish=false;
  }

  async function authHeaders() {
    const token = await (user && user.jwt ? user.jwt() : null);
    return token ? {Authorization:"Bearer " + token} : {};
  }

  async function oauthApi(method, action, body) {
    const response = await fetch("/.netlify/functions/publisher-oauth?action=" + encodeURIComponent(action), {
      method:method || "GET",
      cache:"no-store",
      credentials:"same-origin",
      headers:Object.assign(
        {},
        await authHeaders(),
        {Accept:"application/json"},
        body ? {"Content-Type":"application/json"} : {}
      ),
      body:body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || "Bağlantı işlemi başarısız"),{code:data.code||""});
    return data;
  }

  async function api(method, body) {
    const response = await fetch("/.netlify/functions/publisher", {
      method:method || "GET",
      cache:"no-store",
      credentials:"same-origin",
      headers:Object.assign(
        {},
        await authHeaders(),
        {Accept:"application/json"},
        body ? {"Content-Type":"application/json"} : {}
      ),
      body:body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "İşlem başarısız");
    return data;
  }

  async function uploadMedia(file) {
    const allowed = ["image/jpeg","image/png","image/webp","video/mp4","video/webm","video/quicktime","video/x-m4v"];
    if (!allowed.includes(file.type)) throw new Error("Yalnız JPG, PNG, WEBP, MP4, MOV, M4V veya WEBM yüklenebilir.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Medya dosyası en fazla 5 MB olabilir.");
    const form = new FormData();
    form.append("file",file,file.name);
    const response = await fetch("/.netlify/functions/publisher-media",{
      method:"POST",
      credentials:"same-origin",
      headers:await authHeaders(),
      body:form
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Görsel yüklenemedi");
    return data;
  }

  function mediaKindFromInputs() {
    const file = $("#mediaFile")?.files && $("#mediaFile").files[0];
    if (file) return String(file.type || "").startsWith("video/") ? "video" : "image";
    const rawUrl = String($("#mediaUrl")?.value || "");
    let value = rawUrl.toLowerCase().split("?")[0];
    try {
      const parsed = new URL(rawUrl);
      if (parsed.pathname === "/.netlify/functions/publisher-media") {
        const uploadedId = parsed.searchParams.get("id") || "";
        if (/^[0-9a-z._-]{8,180}$/i.test(uploadedId)) value = uploadedId.toLowerCase();
      }
    } catch {}
    if (/\.(mp4|mov|m4v|webm)$/.test(value)) return "video";
    if (/\.(jpg|jpeg|png|webp)$/.test(value)) return "image";
    return rawUrl ? "unknown" : "none";
  }

  function isApplicable(channel) {
    const kind = mediaKindFromInputs();
    if (channel === "youtube") return kind === "video";
    if (channel === "instagram") return kind === "image" || kind === "video";
    return true;
  }

  function syncApplicability() {
    document.querySelectorAll('input[name="channel"]').forEach(input => {
      const item = status[input.value];
      if (!item?.ready) return;
      const applicable = isApplicable(input.value);
      input.disabled = !applicable;
      input.closest(".channel-choice")?.classList.toggle("disabled",!applicable);
      const note = input.closest(".channel-choice")?.querySelector("small");
      if (note) note.textContent = applicable ? "Yayına hazır" : "Bu medya türü için uygun değil";
      if (!applicable) input.checked = false;
    });
  }

  function renderConnections(data) {
    connectionState = data || {};
    const root = $("#connections");
    const google = data.google || {};
    const meta = data.meta || {};
    const setup = data.appSetup || {};

    const googleText = google.connected
      ? (google.gbpReady ? "YouTube + Google İşletme bağlı" : "YouTube bağlı · Google İşletme erişimi bekleniyor")
      : (setup.google ? "Bağlanmaya hazır" : "Google OAuth uygulama bilgileri eksik");
    const metaText = meta.connected
      ? (meta.selectedPage ? meta.selectedPage.name + (meta.selectedPage.instagramUsername ? " · @" + meta.selectedPage.instagramUsername : "") : "Hesap bağlı · Facebook Sayfası seçilmeli")
      : (setup.meta ? "Bağlanmaya hazır" : "Meta uygulama bilgileri eksik");

    root.innerHTML =
      '<div class="connection-row">' +
        '<i class="fa-brands fa-meta"></i>' +
        '<div><strong>Facebook + Instagram</strong><small>' + esc(metaText) + '</small></div>' +
        (meta.connected
          ? '<button type="button" class="disconnect-btn" data-disconnect="meta">Ayır</button>'
          : '<button type="button" class="connect-btn" data-connect="meta" ' + (setup.meta ? "" : "disabled") + '>Meta’yı Bağla</button>') +
      '</div>' +
      (meta.connected ? '<button type="button" class="connect-btn" id="refreshMetaPages" style="margin:8px 0">Facebook sayfalarını yeniden tara</button>' : '') +
      '<div class="connection-row">' +
        '<i class="fa-brands fa-google"></i>' +
        '<div><strong>YouTube + Google İşletme</strong><small>' + esc(googleText) + '</small></div>' +
        (google.connected
          ? '<button type="button" class="disconnect-btn" data-disconnect="google">Ayır</button>'
          : '<button type="button" class="connect-btn" data-connect="google" ' + (setup.google ? "" : "disabled") + '>Google’ı Bağla</button>') +
      '</div>' +
      (!setup.encryption ? '<p class="connection-note">OAuth şifreleme anahtarı eksik; bağlantılar güvenli şekilde saklanamaz.</p>' : '') +
      (setup.callbackUrl ? '<p class="connection-note"><strong>OAuth dönüş adresi:</strong><br><code>' + esc(setup.callbackUrl) + '</code></p>' : '');

    const picker = $("#metaPagePicker");
    if (meta.connected && !meta.selectedPage && Array.isArray(meta.pages) && meta.pages.length) {
      picker.classList.remove("hidden");
      picker.innerHTML =
        '<strong>Hangi Facebook Sayfası kullanılacak?</strong>' +
        '<select id="metaPageSelect">' +
          meta.pages.map(page => '<option value="' + esc(page.id) + '">' + esc(page.name + (page.instagramUsername ? " · @" + page.instagramUsername : "")) + '</option>').join("") +
        '</select>' +
        '<button type="button" class="select-page-btn" id="selectMetaPage">Bu sayfayı kullan</button>';
    } else {
      picker.classList.add("hidden");
      picker.innerHTML = "";
    }

    if (data.lastError?.message) toast(data.lastError.message);
  }

  async function refreshConnections() {
    try {
      const data = await oauthApi("GET","status");
      renderConnections(data);
    } catch (error) {
      $("#connections").innerHTML = '<div class="connection-placeholder">' + esc(error.message) + '</div>';
    }
  }

  async function startOAuth(provider) {
    const data = await oauthApi("POST","start",{provider});
    if (!data.url) throw new Error("Yetkilendirme adresi alınamadı");
    window.location.assign(data.url);
  }

  function renderStatus() {
    const rows = Object.entries(status);
    statusEl.innerHTML = rows.map(([key,item]) => {
      return '<div class="status-row">' +
        '<i class="' + (icons[key] || "fa-solid fa-share-nodes") + '"></i>' +
        '<div><strong>' + esc(item.label) + '</strong><small>' + esc(item.detail) + '</small></div>' +
        '<span class="badge ' + (item.ready ? "ready" : "wait") + '">' + (item.ready ? "HAZIR" : "BEKLİYOR") + '</span>' +
      '</div>';
    }).join("");

    channelsEl.innerHTML = rows.map(([key,item]) => {
      return '<label class="channel-choice ' + (item.ready ? "" : "disabled") + '">' +
        '<input type="checkbox" name="channel" value="' + esc(key) + '" ' + (item.ready ? "checked" : "") + ' ' + (item.ready ? "" : "disabled") + '>' +
        '<i class="' + (icons[key] || "fa-solid fa-share-nodes") + '"></i>' +
        '<span><strong>' + esc(item.label) + '</strong><small>' + esc(item.ready ? "Yayına hazır" : item.detail) + '</small></span>' +
      '</label>';
    }).join("");

    $("#readyCount").textContent = rows.filter(([,item]) => item.ready).length + "/" + rows.length;
    syncApplicability();
    renderChannelRules();
  }

  function renderResults(results) {
    if (!results || !results.length) {
      resultsEl.className = "results empty";
      resultsEl.textContent = "Henüz yayın yapılmadı.";
      return;
    }
    resultsEl.className = "results";
    resultsEl.innerHTML = results.map(row => {
      const item = status[row.channel] || {label:row.channel};
      const badgeClass = row.ok ? "ready" : (row.skipped ? "wait" : "fail");
      const label = row.ok ? "YAYINLANDI" : (row.skipped ? "ATLANDI" : "HATA");
      const detail = row.ok ? (row.id ? "ID: " + row.id : "Başarılı") : (row.error || "İşlem tamamlanamadı");
      return '<div class="result-row">' +
        '<i class="' + (icons[row.channel] || "fa-solid fa-share-nodes") + '"></i>' +
        '<div><strong>' + esc(item.label) + '</strong><small>' + esc(detail) + '</small></div>' +
        '<span class="badge ' + badgeClass + '">' + label + '</span>' +
      '</div>';
    }).join("");
  }

  function renderHistory(history) {
    if (!history || !history.length) {
      historyEl.className = "history empty";
      historyEl.textContent = "Henüz yayın geçmişi yok.";
      return;
    }
    historyEl.className = "history";
    historyEl.innerHTML = history.map(row => {
      const failed = (row.results || []).filter(item => !item.ok).map(item => item.channel);
      const channelBadges = (row.results || []).map(item => {
        const itemStatus = status[item.channel] || {label:item.channel};
        return '<span class="badge ' + (item.ok ? "ready" : (item.skipped ? "wait" : "fail")) + '">' + esc(itemStatus.label) + '</span>';
      }).join("");
      const retry = failed.length
        ? '<div class="history-actions"><button class="retry" type="button" data-retry="' + esc(row.id) + '" data-channels="' + encodeURIComponent(JSON.stringify(failed)) + '"><i class="fa-solid fa-rotate-right"></i> Başarısızları yeniden dene</button></div>'
        : "";
      const when = row.createdAt ? new Date(row.createdAt).toLocaleString("tr-TR") : "";
      return '<article class="history-item">' +
        '<div class="history-item-head"><div><strong>' + esc(row.payload?.title || "Yayın") + '</strong><small>' + esc(when) + (row.retryOf ? " · yeniden deneme" : "") + '</small></div>' +
        '<span class="badge ' + (row.complete ? "ready" : "wait") + '">' + (row.complete ? "TAMAM" : "KISMİ") + '</span></div>' +
        '<div class="history-channels">' + channelBadges + '</div>' +
        retry +
      '</article>';
    }).join("");
  }

  async function refresh() {
    try {
      const data = await api("GET");
      status = data.channels || {};
      rules = data.rules || {};
      renderStatus();
      renderHistory(data.history || []);
    } catch (error) {
      toast(error.message);
    }
  }

  $("#selectReady").addEventListener("click", () => {
    syncApplicability();
    document.querySelectorAll('input[name="channel"]:not(:disabled)').forEach(input => {
      input.checked = true;
    });
    renderChannelRules();
    scheduleDraftSave();
  });

  $("#refresh").addEventListener("click", refresh);
  $("#refreshConnections").addEventListener("click", async () => {
    await refreshConnections();
    await refresh();
  });

  $("#connections").addEventListener("click", async event => {
    const rescan = event.target.closest("#refreshMetaPages");
    if (rescan) {
      rescan.disabled = true;
      try {
        const result = await oauthApi("POST","refresh-meta",{});
        toast(result.message || (result.count + " Facebook sayfası bulundu."));
        await refreshConnections();
        await refresh();
      } catch (error) {
        toast(error.message);
        rescan.disabled = false;
      }
      return;
    }
    const connect = event.target.closest("[data-connect]");
    if (connect) {
      connect.disabled = true;
      try { await startOAuth(connect.dataset.connect); }
      catch (error) { toast(error.message); connect.disabled = false; }
      return;
    }
    const disconnect = event.target.closest("[data-disconnect]");
    if (disconnect) {
      // Disconnecting revokes the stored account link and must be intentional.
      if (!window.confirm("Bu hesabın Elçi Yayın Merkezi bağlantısını ayırmak istediğinizden emin misiniz?")) return;
      disconnect.disabled = true;
      try {
        await oauthApi("POST","disconnect",{provider:disconnect.dataset.disconnect});
        toast("Hesap bağlantısı kaldırıldı.");
        await refreshConnections();
        await refresh();
      } catch (error) {
        toast(error.message);
        disconnect.disabled = false;
      }
    }
  });

  $("#metaPagePicker").addEventListener("click", async event => {
    if (!event.target.closest("#selectMetaPage")) return;
    const pageId = $("#metaPageSelect")?.value;
    if (!pageId) return;
    event.target.disabled = true;
    try {
      await oauthApi("POST","select-meta",{pageId});
      toast("Facebook Sayfası seçildi.");
      await refreshConnections();
      await refresh();
    } catch (error) {
      toast(error.message);
      event.target.disabled = false;
    }
  });

  $("#mediaUrl").addEventListener("input", () => { syncApplicability(); renderChannelRules(); scheduleDraftSave(); });
  $("#title").addEventListener("input", () => { updateCounters(); renderChannelRules(); scheduleDraftSave(); });
  $("#text").addEventListener("input", () => { updateCounters(); renderChannelRules(); scheduleDraftSave(); });
  $("#youtubePrivacy").addEventListener("change", scheduleDraftSave);
  $("#channels").addEventListener("change", () => { renderChannelRules(); scheduleDraftSave(); });
  $("#saveDraft").addEventListener("click", () => saveDraft(false));
  $("#previewButton").addEventListener("click", () => { pendingPublish=false; renderPreview(); });
  $("#closePreview").addEventListener("click", closePreview);
  $("#cancelPreview").addEventListener("click", closePreview);
  $("#previewModal").addEventListener("click", event => { if (event.target === $("#previewModal")) closePreview(); });

  $("#mediaFile").addEventListener("change", () => {
    const file = $("#mediaFile").files && $("#mediaFile").files[0];
    const help = $("#mediaHelp");
    if (!file) {
      help.textContent = "JPG, PNG, WEBP, MP4, MOV, M4V veya WEBM · en fazla 5 MB. Dosya seçerseniz yayın sırasında otomatik yüklenir.";
      help.classList.remove("uploading");
      return;
    }
    help.textContent = file.name + " · " + Math.max(1,Math.round(file.size/1024)) + " KB · yayın sırasında otomatik yüklenecek";
    help.classList.add("uploading");
    syncApplicability();
    renderChannelRules();
    scheduleDraftSave();
  });


  $("#channelRules").addEventListener("input", event => {
    const field=event.target.closest("[data-channel-edit]");
    if (!field) return;
    const key=field.dataset.channelEdit;
    if (!Object.hasOwn(rules,key)) return;
    const type=field.dataset.editField;
    if (type === "title") channelTitles[key]=field.value;
    else channelTexts[key]=field.value;
    const feedback=ruleFeedback(key,type,field.value);
    const counter=field.closest("label")?.querySelector('[data-count="'+type+'"]');
    if (counter && feedback) {
      counter.textContent=feedback.text;
      counter.classList.toggle("invalid",Boolean(feedback.className));
    }
    scheduleDraftSave();
  });

  $("#generateAiVariants").addEventListener("click", async () => {
    const selected=selectedChannels();
    const title=($("#title")?.value || "").trim();
    const text=($("#text")?.value || "").trim();
    const target=$("#aiFeedback"),button=$("#generateAiVariants");
    if (!title || !text || !selected.length) {
      toast("Önce ana başlığı, metni ve yayın kanallarını seçin.");
      return;
    }
    button.disabled=true;
    button.textContent="Metin önerileri hazırlanıyor…";
    target.textContent="";
    try {
      const response=await fetch("/.netlify/functions/publisher-ai",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{...await authHeaders(), "Content-Type":"application/json",Accept:"application/json"},
        body:JSON.stringify({title,text,channels:selected})
      });
      const result=await response.json().catch(()=>({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "Yapay zekâ önerisi alınamadı");
      for(const row of result.variants || []) {
        if (!selected.includes(row.channel)) continue;
        channelTexts[row.channel]=row.text;
        channelTitles[row.channel]=row.title;
      }
      renderChannelRules();
      const warnings=(result.warnings || []).map(x=>'<li>'+esc(x)+'</li>').join("");
      const facts=(result.keyFacts || []).map(x=>'<li>'+esc(x)+'</li>').join("");
      target.innerHTML='<strong>Önemli noktalar</strong><ul>'+facts+'</ul>'+
        (warnings ? '<strong>Kontrol gerektirenler</strong><ul>'+warnings+'</ul>' : "") +
        '<p>Öneriler düzenlenebilir. Veteriner hekim onayından önce yayınlanmaz.</p>';
      scheduleDraftSave();
      toast("Platform metinleri önerildi; tüm taslakları inceleyin.");
    }catch(error){
      target.textContent=error.message;
      toast(error.message);
    }finally{
      button.disabled=false;
      button.textContent="Yapay zekâyla platform metinleri hazırla";
    }
  });

  $("#channelRules").addEventListener("click", event => {
    const button=event.target.closest("[data-shorten]");
    if (!button) return;
    const key=button.dataset.shorten,rule=rules[key];
    if (!rule) return;
    channelTexts[key]=shortenSuggestion(channelText(key),rule);
    renderChannelRules();
    scheduleDraftSave();
    toast("Kısaltma taslağı hazır. Eksilen tıbbi bilgileri ve anlamı kontrol ederek onaylayın.");
  });

  async function publishNow() {
    const button = $("#publishButton");
    const confirmButton=$("#confirmPublish");
    const selected = selectedChannels();
    if (!selected.length) {
      toast("En az bir hazır kanal seçin.");
      return;
    }
    button.disabled = true;
    confirmButton.disabled=true;
    button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>YAYINLANIYOR…</span>';
    confirmButton.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> Yayınlanıyor…';
    try {
      let mediaUrl = $("#mediaUrl").value.trim();
      const channelMediaUrls = {};
      const file = $("#mediaFile").files && $("#mediaFile").files[0];
      if (file) {
        const help = $("#mediaHelp");
        help.textContent = "Medya uygun platform boyutlarına hazırlanıyor…";
        help.classList.add("uploading");
        if (file.type.startsWith("image/") && window.ElciMediaFit) {
          for (const channel of selected) {
            const adapted=await window.ElciMediaFit.adaptImage(file,channel);
            if (!adapted) {
              // Unrecognized image channel: do not silently deliver the wrong image.
              throw new Error("Bu platform için görsel boyutu tanımlanmamış: "+channel);
            }
            help.textContent=channel+" görseli yükleniyor ("+adapted.width+"×"+adapted.height+")…";
            const uploaded=await uploadMedia(adapted.file);
            channelMediaUrls[channel]=uploaded.url;
            mediaUrl ||= uploaded.url;
          }
        } else {
          // Video remains unchanged; 5 MB direct upload / external URL policy still applies.
          const uploaded = await uploadMedia(file);
          mediaUrl = uploaded.url;
        }
        help.textContent = "Medya kanallara uygun hazırlandı ✓";
      }
      const data = await api("POST", {
        title:$("#title").value,
        text:$("#text").value,
        mediaUrl,
        youtubePrivacy:$("#youtubePrivacy").value,
        channelTexts:{...channelTexts},
        channelTitles:{...channelTitles},
        channelMediaUrls,
        channels:selected
      });
      renderResults(data.results || []);
      $("#previewModal").classList.add("hidden");
      pendingPublish=false;
      if (data.ok) {
        localStorage.removeItem(DRAFT_KEY);
        const stateEl=$("#draftState");
        if (stateEl) stateEl.textContent="Son yayın işlendi; yeni içerik için taslak alanı hazır.";
      } else {
        saveDraft(true);
      }
      toast(data.complete ? "Tüm seçili kanallara yayınlandı." : "Yayın tamamlandı; bazı kanalları kontrol edin.");
      await refresh();
    } catch (error) {
      toast(error.message);
      saveDraft(true);
    } finally {
      button.disabled = false;
      confirmButton.disabled=false;
      button.innerHTML = '<i class="fa-solid fa-paper-plane"></i><span>HER YERDE YAYINLA</span>';
      confirmButton.innerHTML='<i class="fa-solid fa-paper-plane"></i> Onayla ve yayınla';
    }
  }

  $("#publishForm").addEventListener("submit", event => {
    event.preventDefault();
    pendingPublish=true;
    if (!renderPreview()) pendingPublish=false;
  });

  $("#confirmPublish").addEventListener("click", async () => {
    if (!pendingPublish) {
      pendingPublish=true;
    }
    await publishNow();
  });

  historyEl.addEventListener("click", async event => {
    const button = event.target.closest("[data-retry]");
    if (!button) return;
    let channels = [];
    try { channels = JSON.parse(decodeURIComponent(button.dataset.channels || "")); } catch {}
    if (!channels.length) return;
    // Retry is a real publication, not a dry run: always ask for approval.
    if (!window.confirm("Başarısız kanallarda yeniden GERÇEK yayın denemesi yapılacak. Onaylıyor musunuz?")) return;
    button.disabled = true;
    const original = button.innerHTML;
    button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Yeniden deneniyor…';
    try {
      const data = await api("POST",{retryPublicationId:button.dataset.retry,channels});
      renderResults(data.results || []);
      toast(data.complete ? "Başarısız kanallar tamamlandı." : "Yeniden deneme tamamlandı; sonucu kontrol edin.");
      await refresh();
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  });

  $("#loginButton").addEventListener("click", () => {
    if (window.netlifyIdentity) window.netlifyIdentity.open("login");
  });
  $("#logoutButton").addEventListener("click", () => {
    if (window.netlifyIdentity) window.netlifyIdentity.logout();
  });

  function showApp(nextUser) {
    user = nextUser;
    $("#userEmail").textContent = (user && user.email) || "";
    login.classList.add("hidden");
    app.classList.remove("hidden");
    refresh().then(restoreDraft);
    refreshConnections();
    updateCounters();
    const params = new URLSearchParams(location.search);
    if (params.get("oauth") === "ok") {
      const provider = params.get("provider");
      toast(provider === "meta" ? "Meta hesabı bağlandı." : "Google hesabı bağlandı.");
      history.replaceState({}, "", location.pathname);
    } else if (params.get("oauth") === "cancelled") {
      toast("Hesap bağlantısı iptal edildi.");
      history.replaceState({}, "", location.pathname);
    } else if (params.get("oauth") === "error") {
      toast("Hesap bağlantısı tamamlanamadı; bağlantı durumunu kontrol edin.");
      history.replaceState({}, "", location.pathname);
    }
  }

  function showLogin() {
    user = null;
    app.classList.add("hidden");
    login.classList.remove("hidden");
  }

  const identity = window.netlifyIdentity;
  if (!identity) {
    showLogin();
    return;
  }
  identity.on("init", current => current ? showApp(current) : showLogin());
  identity.on("login", current => {
    identity.close();
    showApp(current);
  });
  identity.on("logout", showLogin);
  identity.init({APIUrl:window.location.origin + "/.netlify/identity"});
})();
