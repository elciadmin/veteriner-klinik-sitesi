const state = document.querySelector("#state");
const button = document.querySelector("#openButton");
const buttonLabel = button.querySelector("span");
const message = document.querySelector("#message");
const IDENTITY_API_URL = "https://elciveteriner.com/.netlify/identity";
let financeUrl = "";
let loginMode = false;
let busy = false;
let identityBound = false;

function setButton(label, icon, disabled = false) {
  button.disabled = disabled;
  buttonLabel.textContent = label;
  button.querySelector("i").className = `fa-solid ${icon}`;
}

function showError(title, detail, action = "Yeniden dene") {
  state.className = "state error";
  state.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><span>${title}</span>`;
  message.textContent = detail;
  setButton(action, action === "Güvenli giriş" ? "fa-lock" : "fa-rotate-right");
}

function showLogin() {
  loginMode = true;
  financeUrl = "";
  showError("Güvenli giriş gerekli.", "Davet edilmiş yönetim hesabınızla giriş yapın.", "Güvenli giriş");
}

function bindIdentity(identity) {
  if (!identity || identityBound) return identity;
  identityBound = true;
  identity.on("login", () => { identity.close(); init(); });
  identity.on("logout", showLogin);
  identity.init({ APIUrl: IDENTITY_API_URL });
  return identity;
}

function loadIdentityWidget() {
  if (window.netlifyIdentity) return Promise.resolve(bindIdentity(window.netlifyIdentity));
  const sources = [
    "https://identity.netlify.com/v1/netlify-identity-widget.js?elci=20260804",
    "https://unpkg.com/netlify-identity-widget@1/build/netlify-identity-widget.js"
  ];
  return new Promise((resolve, reject) => {
    let index = 0;
    const tryNext = () => {
      if (window.netlifyIdentity) return resolve(bindIdentity(window.netlifyIdentity));
      if (index >= sources.length) return reject(new Error("LOGIN_SERVICE_UNAVAILABLE"));
      const script = document.createElement("script");
      script.src = sources[index++];
      script.async = true;
      script.onload = () => window.netlifyIdentity ? resolve(bindIdentity(window.netlifyIdentity)) : tryNext();
      script.onerror = () => { script.remove(); tryNext(); };
      document.head.appendChild(script);
    };
    tryNext();
  });
}

function friendlyFailure(error, status = 0, code = "") {
  if (code === "FINANCE_URL_MISSING") {
    showError("Finans adresi henüz tanımlanmadı.", "FINANCE_APP_URL ayarı tamamlanmadan finans uygulaması açılamaz.");
  } else if (code === "FINANCE_SECRET_MISSING" || status === 503) {
    showError("Güvenli finans bağlantısı tamamlanmadı.", "FINANCE_ACCESS_SHARED_SECRET ayarını hem Netlify hem finans uygulamasında aynı değerle tanımlayın.");
  } else if (status === 403) {
    showError("Bu hesabın finans yetkisi yok.", "Yetkili yönetici hesabıyla giriş yapın veya erişim listenizi kontrol ettirin.", "Güvenli giriş");
    loginMode = true;
  } else if (status === 401) {
    showLogin();
  } else if (String(error?.message) === "LOGIN_SERVICE_UNAVAILABLE") {
    showError("Giriş servisi yüklenemedi.", "İnternet bağlantısını veya tarayıcı içerik engelleyicisini kontrol edip sayfayı yenileyin.");
  } else if (!navigator.onLine) {
    showError("İnternet bağlantısı yok.", "Bağlantı geri geldiğinde yeniden deneyin.");
  } else {
    showError("Finans erişimi doğrulanamadı.", String(error?.message || "Sayfayı yenileyip tekrar deneyin."));
  }
}

async function init() {
  if (busy) return;
  busy = true;
  setButton("Kontrol ediliyor", "fa-circle-notch fa-spin", true);
  try {
    const identity = await loadIdentityWidget();
    const user = identity.currentUser();
    if (!user) { showLogin(); return; }

    const token = await user.jwt();
    const response = await fetch("/.netlify/functions/finance-access", {
      headers: { Authorization: `Bearer ${token}` }, credentials: "include", cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "Erişim doğrulanamadı");
      error.status = response.status; error.code = data.code || ""; throw error;
    }

    loginMode = false;
    financeUrl = data.url;
    state.className = "state ok";
    state.innerHTML = '<i class="fa-solid fa-shield-check"></i><span>Yönetim hesabınız doğrulandı.</span>';
    message.textContent = "Finans uygulaması aynı sekmede açılacak. Tarayıcının geri düğmesiyle yönetim paneline dönebilirsiniz.";
    setButton("Finans sistemini aç", "fa-arrow-right");
  } catch (error) {
    friendlyFailure(error, error.status || 0, error.code || "");
  } finally { busy = false; }
}

button.addEventListener("click", async () => {
  if (loginMode) {
    try { (await loadIdentityWidget()).open("login"); }
    catch (error) { friendlyFailure(error); }
    return;
  }
  if (financeUrl) { window.location.assign(financeUrl); return; }
  init();
});

init();
