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

  async function authHeaders() {
    const token = await (user && user.jwt ? user.jwt() : null);
    return token ? {Authorization:"Bearer " + token} : {};
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

  async function uploadImage(file) {
    const allowed = ["image/jpeg","image/png","image/webp"];
    if (!allowed.includes(file.type)) throw new Error("Yalnız JPG, PNG veya WEBP görsel yüklenebilir.");
    if (file.size > 4 * 1024 * 1024) throw new Error("Görsel en fazla 4 MB olabilir.");
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
      renderStatus();
      renderHistory(data.history || []);
    } catch (error) {
      toast(error.message);
    }
  }

  $("#selectReady").addEventListener("click", () => {
    document.querySelectorAll('input[name="channel"]:not(:disabled)').forEach(input => {
      input.checked = true;
    });
  });

  $("#refresh").addEventListener("click", refresh);

  $("#mediaFile").addEventListener("change", () => {
    const file = $("#mediaFile").files && $("#mediaFile").files[0];
    const help = $("#mediaHelp");
    if (!file) {
      help.textContent = "JPG, PNG veya WEBP · en fazla 4 MB. Görsel seçerseniz yayın sırasında otomatik yüklenir.";
      help.classList.remove("uploading");
      return;
    }
    help.textContent = file.name + " · " + Math.max(1,Math.round(file.size/1024)) + " KB · yayın sırasında otomatik yüklenecek";
    help.classList.add("uploading");
  });

  $("#publishForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = $("#publishButton");
    const selected = Array.from(document.querySelectorAll('input[name="channel"]:checked')).map(input => input.value);
    if (!selected.length) {
      toast("En az bir hazır kanal seçin.");
      return;
    }
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>YAYINLANIYOR…</span>';
    try {
      let mediaUrl = $("#mediaUrl").value.trim();
      const file = $("#mediaFile").files && $("#mediaFile").files[0];
      if (file) {
        const help = $("#mediaHelp");
        help.textContent = "Görsel güvenli alana yükleniyor…";
        help.classList.add("uploading");
        const uploaded = await uploadImage(file);
        mediaUrl = uploaded.url;
        help.textContent = "Görsel yüklendi ✓";
      }
      const data = await api("POST", {
        title:$("#title").value,
        text:$("#text").value,
        mediaUrl,
        youtubePrivacy:$("#youtubePrivacy").value,
        channels:selected
      });
      renderResults(data.results || []);
      toast(data.complete ? "Tüm seçili kanallara yayınlandı." : "Yayın tamamlandı; bazı kanalları kontrol edin.");
      await refresh();
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
      button.innerHTML = '<i class="fa-solid fa-paper-plane"></i><span>HER YERDE YAYINLA</span>';
    }
  });

  historyEl.addEventListener("click", async event => {
    const button = event.target.closest("[data-retry]");
    if (!button) return;
    let channels = [];
    try { channels = JSON.parse(decodeURIComponent(button.dataset.channels || "")); } catch {}
    if (!channels.length) return;
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
    refresh();
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
