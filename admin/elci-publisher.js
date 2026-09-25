(() => {
  const $ = selector => document.querySelector(selector);
  const login = $("#login");
  const app = $("#app");
  const channelsEl = $("#channels");
  const statusEl = $("#channelStatus");
  const resultsEl = $("#results");
  const icons = {
    website:"fa-solid fa-globe",
    facebook:"fa-brands fa-facebook-f",
    instagram:"fa-brands fa-instagram",
    youtube:"fa-brands fa-youtube",
    gmb:"fa-brands fa-google"
  };
  let user = null;
  let status = {};

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

  function renderStatus() {
    const rows = Object.entries(status);
    statusEl.innerHTML = rows.map(([key,item]) => {
      return '<div class="status-row">' +
        '<i class="' + (icons[key] || "fa-solid fa-share-nodes") + '"></i>' +
        '<div><strong>' + item.label + '</strong><small>' + item.detail + '</small></div>' +
        '<span class="badge ' + (item.ready ? "ready" : "wait") + '">' + (item.ready ? "HAZIR" : "BEKLİYOR") + '</span>' +
      '</div>';
    }).join("");

    channelsEl.innerHTML = rows.map(([key,item]) => {
      return '<label class="channel-choice ' + (item.ready ? "" : "disabled") + '">' +
        '<input type="checkbox" name="channel" value="' + key + '" ' + (item.ready ? "checked" : "") + ' ' + (item.ready ? "" : "disabled") + '>' +
        '<i class="' + (icons[key] || "fa-solid fa-share-nodes") + '"></i>' +
        '<span><strong>' + item.label + '</strong><small>' + (item.ready ? "Yayına hazır" : item.detail) + '</small></span>' +
      '</label>';
    }).join("");

    $("#readyCount").textContent = rows.filter(([,item]) => item.ready).length + "/" + rows.length;
  }

  async function refresh() {
    try {
      const data = await api("GET");
      status = data.channels || {};
      renderStatus();
    } catch (error) {
      toast(error.message);
    }
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
        '<div><strong>' + item.label + '</strong><small>' + detail + '</small></div>' +
        '<span class="badge ' + badgeClass + '">' + label + '</span>' +
      '</div>';
    }).join("");
  }

  $("#selectReady").addEventListener("click", () => {
    document.querySelectorAll('input[name="channel"]:not(:disabled)').forEach(input => {
      input.checked = true;
    });
  });

  $("#refresh").addEventListener("click", refresh);

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
      const data = await api("POST", {
        title:$("#title").value,
        text:$("#text").value,
        mediaUrl:$("#mediaUrl").value,
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