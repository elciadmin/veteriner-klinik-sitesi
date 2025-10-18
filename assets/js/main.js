# index.html (güncellenmiş)

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>

  <title>Elçi Veteriner Kliniği | Konya'da 7/24 Acil Veteriner, Cerrahi, Görüntüleme</title>
  <meta name="description" content="Konya Meram Elçi Veteriner Kliniği: 7/24 acil veteriner, koruyucu hekimlik, cerrahi, diş sağlığı, görüntüleme, konaklama. Hemen arayın: 0332 322 32 20"/>
  <meta name="keywords" content="Konya veteriner, Meram veteriner, 7/24 acil veteriner, kedi köpek muayene, cerrahi, diş sağlığı, röntgen, ultrason, konaklama"/>

  <!-- Fonts & Icons -->
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700&family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"/>

  <!-- Favicons (dosyalar assets/img/uploads içinde olmalı) -->
  <link rel="icon" type="image/png" sizes="32x32" href="assets/img/uploads/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="assets/img/uploads/favicon-16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="assets/img/uploads/apple-touch-icon.png">
  <link rel="manifest" href="site.webmanifest">

  <!-- Canonical & Theme -->
  <link rel="canonical" href="https://veteriner-klinik-sitesi.netlify.app/">
  <meta name="theme-color" content="#6a0ea1">

  <!-- Sosyal önizleme (mutlak URL şart) -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="Elçi Veteriner Kliniği | Konya'da 7/24 Acil Veteriner">
  <meta property="og:description" content="7/24 acil, cerrahi, diş sağlığı, görüntüleme. Hemen arayın: 0332 322 32 20">
  <meta property="og:image" content="https://veteriner-klinik-sitesi.netlify.app/assets/img/uploads/og-cover.jpg">
  <meta property="og:url" content="https://veteriner-klinik-sitesi.netlify.app/">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://veteriner-klinik-sitesi.netlify.app/assets/img/uploads/og-cover.jpg">

  <style>
    :root{
      --primary:#6a0ea1; --secondary:#10b3d1;
      --primary-700:#520b7d; --secondary-700:#0e91ab;
      --light:#f7f8fc; --dark:#0f172a; --muted:#6b7280; --white:#fff;
      --border:#e6eef7; --shadow-sm:0 6px 16px rgba(15,23,42,.06);
      --shadow-md:0 14px 30px rgba(15,23,42,.12);
      --grad-hero:linear-gradient(120deg, rgba(106,14,161,.96), rgba(16,179,209,.92));
    }
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Roboto',sans-serif;color:#1f2937;background:var(--light);line-height:1.6;overflow-x:hidden}
    h1,h2,h3,h4,h5{font-family:'Montserrat',sans-serif;color:var(--dark)}
    a{color:var(--primary);text-decoration:none;transition:.25s}
    a:hover{color:var(--secondary)}
    .container{max-width:1200px;margin:0 auto;padding:0 16px}
    .skip-link{position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden}
    .skip-link:focus{left:8px;top:8px;width:auto;height:auto;background:#fff;color:#000;padding:8px 12px;border-radius:8px;z-index:2000}

    /* Header */
    body.home header{background:var(--grad-hero);color:#fff;box-shadow:none}
    body.home .header-top{background:transparent;border-bottom:1px solid rgba(255,255,255,.25)}
    body.home .logo-text h1, body.home .logo-text span{color:#fff}
    body.home nav a{color:#fff}
    body.home nav a:after{background:#fff}

    header{position:fixed;inset:0 0 auto 0;z-index:1000;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.06)}
    .header-top{background:var(--primary);color:#fff;font-size:14px;padding:6px 0}
    .header-top .container{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .header-main{padding:10px 0}
    .header-main .container{display:flex;justify-content:space-between;align-items:center}
    .logo-wrap{display:flex;align-items:center;gap:10px}
    .logo-img{height:44px;width:auto;display:block}
    .logo-text h1{color:var(--primary);font-size:22px;margin:0}
    .logo-text span{color:var(--secondary);font-size:13px}
    nav ul{list-style:none;display:flex;align-items:center;gap:18px}
    nav li{position:relative}
    nav a{color:#111827;font-weight:600;padding:10px 0;display:inline-flex;align-items:center;gap:6px}
    nav a:after{content:"";position:absolute;left:0;bottom:-2px;height:2px;width:0;background:var(--secondary);transition:.25s}
    nav a:hover:after,nav a.active:after{width:100%}
    .dropdown > a::after{content:"\f078";font-family:"Font Awesome 6 Free";font-weight:900;font-size:12px;margin-left:6px;opacity:.7;transition:.25s}
    .dropdown:hover > a::after{transform:rotate(180deg)}
    .dropdown-content{
      position:absolute;top:100%;left:0;min-width:260px;background:#fff;border:1px solid var(--border);border-radius:12px;
      box-shadow:var(--shadow-md);padding:10px 8px;display:none
    }
    .dropdown-content a{display:block;padding:10px 12px;border-radius:8px;color:#374151}
    .dropdown-content a:hover{background:#f7fbff;color:#0f172a}
    .dropdown:hover .dropdown-content{display:block}
    .mobile-menu-btn{display:none;background:none;border:0;font-size:24px;color:var(--primary);cursor:pointer}

    /* HERO */
    .hero{
      margin-top:88px;
      background:var(--grad-hero), url('assets/img/uploads/clinic-hero.jpg') center/cover no-repeat;
      background-blend-mode: overlay; color:#fff
    }
    .hero .container{display:flex;flex-direction:column;align-items:center;text-align:center;padding:120px 16px 40px}
    .hero .brand-mark{display:flex;flex-direction:column;align-items:center;gap:14px;margin-bottom:10px}
    .brand-mark img{width:84px;height:84px;object-fit:contain;background:#fff;border-radius:24px;padding:10px;box-shadow:0 10px 24px rgba(0,0,0,.15)}
    .hero h1{color:#fff;font-size:48px;line-height:1.12;margin:6px 0 14px;text-shadow:0 2px 6px rgba(0,0,0,.25)}
    .hero .underline{width:64px;height:4px;border-radius:4px;background:#fff;opacity:.9;margin:0 auto 14px}
    .hero p{color:#eaf7ff;font-size:18px;max-width:820px}
    .hero-cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}
    .btn{display:inline-flex;align-items:center;gap:10px;border-radius:40px;padding:13px 22px;font-weight:700}
    .btn-primary{background:#fff;color:var(--primary-700)}
    .btn-primary:hover{transform:translateY(-2px)}
    .btn-outline{background:transparent;border:2px solid #fff;color:#fff}
    .btn-outline:hover{background:rgba(255,255,255,.13)}

    /* Quick Nav */
    .quick-nav{width:100%;max-width:1200px;margin-top:36px;padding:22px 12px 8px;border-top:1px solid rgba(255,255,255,.25)}
    .quick-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
    .quick-item{
      position:relative;isolation:isolate;display:flex;flex-direction:column;align-items:center;gap:10px;
      padding:18px 12px;border-radius:16px;color:#fff;text-align:center;
      border:1px solid rgba(255,255,255,.22);background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02));
      transition:.25s;
    }
    .quick-item .qicon{width:54px;height:54px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;background:rgba(255,255,255,.12);backdrop-filter:blur(2px)}
    .quick-item strong{font-size:14px;letter-spacing:.3px}
    .quick-item:hover{transform:translateY(-4px);box-shadow:0 10px 24px rgba(0,0,0,.16);background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.08))}
    .quick-item:focus-visible{outline:3px solid #fff}
    .quick-grid > a:not(:last-child)::after{content:""; position:absolute; right:-6px; top:50%; transform:translateY(-50%); width:4px; height:4px; border-radius:50%; background:rgba(255,255,255,.35)}

    /* Section */
    .section{padding:70px 0;background:#fff}
    .section.alt{background:#f8fbff}
    .section-title{text-align:center;margin-bottom:34px}
    .section-title h2{font-size:32px;color:var(--primary);position:relative;display:inline-block;padding-bottom:12px}
    .section-title h2:after{content:"";position:absolute;left:50%;transform:translateX(-50%);bottom:0;height:3px;width:72px;background:var(--secondary)}
    .section-title p{color:var(--muted);margin-top:8px}

    /* Hizmetler */
    .services-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;perspective:1200px}
    .flip-card{position:relative;height:250px}
    .flip-card-inner{position:absolute;inset:0;border-radius:16px;transition:transform .7s;transform-style:preserve-3d;box-shadow:var(--shadow-sm);border:2px solid var(--border);background:#fff}
    .flip-card:hover .flip-card-inner{transform:rotateY(180deg)}
    .flip-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:16px;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:20px;text-align:center}
    .flip-front{background:#fff}
    .flip-front .icon{width:68px;height:68px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:30px;background:linear-gradient(135deg,var(--secondary),var(--primary));color:#fff;box-shadow:0 10px 22px rgba(16,179,209,.25)}
    .flip-front h3{margin-top:12px;color:var(--primary)}
    .flip-back{transform:rotateY(180deg);background:#f7fbff;border:1px dashed #dbeafe}
    .flip-back p{color:#555;margin-bottom:12px}
    .flip-back a{font-weight:700}

    /* Cards / Blog */
    .embed-wrap{max-width:1100px;margin:0 auto}
    .about-card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:18px;box-shadow:var(--shadow-sm)}
    .blog-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
    .blog-card{background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:var(--shadow-sm)}
    .blog-card .thumb{height:170px;background:#eef4ff}
    .blog-card img{width:100%;height:100%;object-fit:cover;display:block}
    .blog-card .body{padding:14px}
    .blog-card h3{font-size:18px;color:var(--dark);margin-bottom:6px}
    .blog-card p{color:#4b5563;font-size:15px}

    /* About teaser */
    .about-cards{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .about-card h3{color:var(--primary);margin-bottom:8px}

    /* === INSTAGRAM === */
    #instaGrid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
    .insta-item{position:relative;overflow:hidden;border-radius:14px;aspect-ratio:1/1;background:#e9eef9;border:1px solid var(--border);box-shadow:var(--shadow-sm)}
    .insta-item img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 1.6s ease}
    /* yavaş akış */
    .insta-item.slow img{transform:scale(1.06)}
    .insta-item.featured{grid-column: span 2; grid-row: span 2}
    .insta-item.featured img{transform:scale(1.14)}

    /* === GOOGLE YORUMLARI === */
    #reviewsGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
    .review-card{position:relative;background:linear-gradient(160deg,var(--primary) 0%, var(--secondary) 100%);color:#fff;border-radius:16px;padding:18px;box-shadow:var(--shadow-md)}
    .review-card .stars{font-size:18px;letter-spacing:1px;color:#fff;margin-bottom:8px}
    .review-card .author{opacity:.9;font-weight:700}
    .review-card .text{opacity:.95}
    .review-card.rotate-out{animation:cardSwap .7s ease forwards}
    @keyframes cardSwap{to{opacity:0;transform:translateY(10px) rotateX(10deg)}}

    /* === YOUTUBE === */
    #ytGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
    .yt-card{background:#fff;border-radius:12px;border:1px solid var(--border);box-shadow:var(--shadow-sm);overflow:hidden}
    .yt-thumb{position:relative;aspect-ratio:16/9;background:#dfe8ff}
    .yt-body{padding:10px}
    .slide-enter{animation:slideIn .6s ease both}
    .slide-exit{animation:slideOut .6s ease both}
    @keyframes slideIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}
    @keyframes slideOut{to{opacity:0;transform:translateX(-24px)}}

    /* Footer */
    footer{background:linear-gradient(135deg,#1a3a52,var(--primary));color:#fff;padding:60px 0 0}
    .footer-container{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:26px;margin-bottom:36px}
    .footer-col h3{color:#fff;margin-bottom:12px;position:relative;padding-bottom:10px}
    .footer-col h3:after{content:"";position:absolute;left:0;bottom:0;height:2px;width:40px;background:var(--secondary)}
    .footer-links li{list-style:none;margin:8px 0}
    .footer-links a{color:#fff;opacity:.85}
    .footer-links a:hover{opacity:1}
    .footer-contact li{list-style:none;margin:10px 0;display:flex;gap:10px}
    .social-links{display:flex;gap:8px;margin-top:10px}
    .social-links a{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.1);color:#fff}
    .social-links a:hover{background:var(--secondary)}
    .footer-bottom{background:rgba(0,0,0,.28);text-align:center;padding:16px 0}

    /* Responsive */
    @media (max-width:1024px){
      .quick-grid{grid-template-columns:repeat(3,1fr)}
      #instaGrid{grid-template-columns:repeat(4,1fr)}
      .services-grid{grid-template-columns:repeat(2,1fr)}
      #reviewsGrid{grid-template-columns:repeat(2,1fr)}
      #ytGrid{grid-template-columns:repeat(2,1fr)}
      .about-cards{grid-template-columns:1fr}
    }
    @media (max-width:640px){
      .mobile-menu-btn{display:inline-flex}
      nav ul{display:none;position:absolute;top:64px;right:16px;background:#fff;border-radius:12px;box-shadow:var(--shadow-md);padding:12px 16px;flex-direction:column;gap:10px}
      nav ul.open{display:flex}
      .hero h1{font-size:32px}
      #instaGrid{grid-template-columns:repeat(2,1fr)}
      #reviewsGrid{grid-template-columns:1fr}
      #ytGrid{grid-template-columns:1fr}
    }
  </style>
</head>
<body class="home">
  <!-- Skip to content -->
  <a class="skip-link" href="#main">İçeriğe atla</a>

  <!-- Header -->
  <header>
    <div class="header-top">
      <div class="container">
        <div><i class="fas fa-map-marker-alt"></i> Havzan Mah. Yeni Meram Cad. 17/1 Meram/Konya</div>
        <div>
          <a href="tel:03323223220" style="color:#fff"><i class="fas fa-phone-alt"></i> 0332 322 32 20</a>
          <a href="mailto:elcivetklinig@gmail.com" style="color:#fff;margin-left:12px"><i class="fas fa-envelope"></i> elcivetklinig@gmail.com</a>
        </div>
      </div>
    </div>
    <div class="header-main">
      <div class="container">
        <div class="logo-wrap">
          <img class="logo-img" src="assets/img/uploads/logo.png" alt="Elçi Veteriner Logosu"
               width="168" height="44" loading="eager" decoding="async" fetchpriority="high"
               onerror="this.style.display='none';document.getElementById('textLogo').style.display='block'">
          <div class="logo-text" id="textLogo" style="display:none">
            <h1>Elçi Veteriner</h1>
            <span>Hayvan Sağlığında Mükemmellik</span>
          </div>
        </div>
        <nav>
          <button class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Menüyü aç" aria-expanded="false"><i class="fas fa-bars"></i></button>
          <ul id="mainMenu">
            <li><a class="active" href="index.html">Ana Sayfa</a></li>
            <li class="dropdown">
              <a href="about.html">Hakkımızda</a>
              <div class="dropdown-content">
                <a href="about.html#elci-kimdir">Elçi Kimdir?</a>
                <a href="about.html#ekibimiz">Ekibimiz</a>
                <a href="about.html#klinik">Kliniğimiz</a>
                <a href="about.html#misyon-vizyon">Misyon & Vizyon</a>
                <a href="about.html#degerler">Değerlerimiz</a>
              </div>
            </li>
            <li class="dropdown">
              <a href="hizmetler.html">Hizmetlerimiz</a>
              <div class="dropdown-content">
                <a href="hizmetler.html#acil">Acil Veteriner</a>
                <a href="hizmetler.html#koruyucu">Koruyucu Hekimlik</a>
                <a href="hizmetler.html#cerrahi">Cerrahi Operasyonlar</a>
                <a href="hizmetler.html#agiz-dis">Ağız ve Diş Sağlığı</a>
                <a href="hizmetler.html#ic-hastaliklari">İç Hastalıkları</a>
                <a href="hizmetler.html#dogum-jinekoloji">Doğum & Jinekoloji</a>
                <a href="hizmetler.html#fizik-tedavi">Fizik Tedavi & Rehabilitasyon</a>
                <a href="hizmetler.html#konaklama">Konaklama</a>
              </div>
            </li>
            <li class="dropdown">
              <a href="blog.html">Blog</a>
              <div class="dropdown-content">
                <a href="blog.html#rehber">Evcil Hayvan Rehberleri</a>
                <a href="blog.html#saglik">Sağlık & Tedavi</a>
                <a href="blog.html#haber">Kliniğimizden Haberler</a>
              </div>
            </li>
            <li class="dropdown">
              <a href="sss.html">SSS</a>
              <div class="dropdown-content">
                <a href="sss.html#fiyat-odeme">Fiyat & Ödeme</a>
                <a href="sss.html#hizmet-sureci">Hizmet Süreçleri</a>
                <a href="sss.html#acil">Acil Durumlar</a>
              </div>
            </li>
            <li class="dropdown">
              <a href="hasta-iliskileri.html">Hasta İlişkileri</a>
              <div class="dropdown-content">
                <a href="hasta-iliskileri.html#online-randevu">Online Randevu</a>
                <a href="hasta-iliskileri.html#memnuniyet-anketi">Memnuniyet Anketi</a>
                <a href="hasta-iliskileri.html#basari-hikayeleri">Başarı Hikayeleri</a>
                <a href="hasta-iliskileri.html#sikayet-oneri">Şikayet & Öneri</a>
              </div>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </header>

  <main id="main" role="main">
    <!-- HERO + Quick Site Rehberi -->
    <section class="hero" aria-label="Açılış">
      <div class="container">
        <div class="brand-mark">
          <img src="assets/img/uploads/logo.png" alt="Elçi Veteriner" onerror="this.style.display='none'">
        </div>
        <h1>Konya’da 7/24 Acil ve Kapsamlı Veterinerlik</h1>
        <div class="underline"></div>
        <p>Koruyucu hekimlikten ileri cerrahiye, diş sağlığından görüntüleme & laboratuvara: evcil dostlarınız için güven, şeffaflık ve etik yaklaşım.</p>
        <div class="hero-cta">
          <a class="btn btn-primary" href="hasta-iliskileri.html#online-randevu"><i class="fas fa-calendar-check"></i> Online Randevu Al</a>
          <a class="btn btn-outline" href="tel:03323223220"><i class="fas fa-phone"></i> 0332 322 32 20</a>
        </div>

        <div class="quick-nav" aria-label="Site Rehberi">
          <div class="quick-grid">
            <a class="quick-item" href="hizmetler.html#acil">
              <div class="qicon"><i class="fa-solid fa-stethoscope"></i></div>
              <strong>Acil / Doktor</strong>
            </a>
            <a class="quick-item" href="hizmetler.html">
              <div class="qicon"><i class="fa-solid fa-heart-pulse"></i></div>
              <strong>Branşlarımız</strong>
            </a>
            <a class="quick-item" href="hasta-iliskileri.html#online-randevu">
              <div class="qicon"><i class="fa-solid fa-calendar-check"></i></div>
              <strong>Hızlı Randevu</strong>
            </a>
            <a class="quick-item" href="#google-yorumlari">
              <div class="qicon"><i class="fa-solid fa-star-half-stroke"></i></div>
              <strong>Google Yorumları</strong>
            </a>
            <a class="quick-item" href="#instagram">
              <div class="qicon"><i class="fa-brands fa-instagram"></i></div>
              <strong>Instagram</strong>
            </a>
            <a class="quick-item" href="contact.html">
              <div class="qicon"><i class="fa-solid fa-phone-volume"></i></div>
              <strong>İletişim</strong>
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- HİZMETLER -->
    <section class="section" id="hizmetler-ozet">
      <div class="container">
        <div class="section-title">
          <h2>Hizmetlerimiz</h2>
          <p>İhtiyacınıza yönelik çözümler</p>
        </div>

        <div class="services-grid">
          <div class="flip-card"><div class="flip-card-inner">
            <div class="flip-face flip-front"><div class="icon"><i class="fas fa-ambulance"></i></div><h3>7/24 Acil</h3></div>
            <div class="flip-face flip-back"><p>Kaza, zehirlenme, solunum sıkıntısı gibi durumlarda hızlı ve doğru müdahale.</p><a href="hizmetler.html#acil">Detayları gör →</a></div>
          </div></div>

          <div class="flip-card"><div class="flip-card-inner">
            <div class="flip-face flip-front"><div class="icon"><i class="fas fa-shield-virus"></i></div><h3>Koruyucu Hekimlik</h3></div>
            <div class="flip-face flip-back"><p>Aşılama, parazit kontrolü, check-up ve yaşam boyu sağlık planları.</p><a href="hizmetler.html#koruyucu">Detayları gör →</a></div>
          </div></div>

          <div class="flip-card"><div class="flip-card-inner">
            <div class="flip-face flip-front"><div class="icon"><i class="fas fa-scalpel"></i></div><h3>Cerrahi</h3></div>
            <div class="flip-face flip-back"><p>Kısırlaştırma, yumuşak doku, ortopedik ve onkolojik cerrahiler.</p><a href="hizmetler.html#cerrahi">Detayları gör →</a></div>
          </div></div>

          <div class="flip-card"><div class="flip-card-inner">
            <div class="flip-face flip-front"><div class="icon"><i class="fas fa-tooth"></i></div><h3>Diş Sağlığı</h3></div>
            <div class="flip-face flip-back"><div><p>Diş taşı temizliği, çekim, periodontal tedaviler ve ev bakımı eğitimi.</p><a href="hizmetler.html#agiz-dis">Detayları gör →</a></div></div>
          </div></div>

          <div class="flip-card"><div class="flip-card-inner">
            <div class="flip-face flip-front"><div class="icon"><i class="fas fa-x-ray"></i></div><h3>Görüntüleme</h3></div>
            <div class="flip-face flip-back"><p>Dijital röntgen, ultrason, EKG ve laboratuvar ile doğru tanı.</p><a href="hizmetler.html#ic-hastaliklari">Detayları gör →</a></div>
          </div></div>

          <div class="flip-card"><div class="flip-card-inner">
            <div class="flip-face flip-front"><div class="icon"><i class="fas fa-home"></i></div><h3>Konaklama</h3></div>
            <div class="flip-face flip-back"><p>Hijyenik, klimalı odalar; günlük kontrol ve oyun alanları.</p><a href="hizmetler.html#konaklama">Detayları gör →</a></div>
          </div></div>
        </div>
      </div>
    </section>

    <!-- INSTAGRAM -->
    <section id="instagram" class="section alt">
      <div class="container">
        <div class="section-title">
          <h2>Instagram’dan</h2>
          <p>Kliniğimizden güncel kareler</p>
        </div>
        <div id="instaGrid" aria-live="polite"></div>
        <p style="margin-top:16px">
          <a class="btn btn-outline" href="https://www.instagram.com/elcivetklinigi/" target="_blank" rel="noopener">Instagram’ı Takip Et</a>
        </p>
      </div>
    </section>

    <!-- BLOG ÖZET -->
    <section class="section" id="blog-ozet">
      <div class="container">
        <div class="section-title">
          <h2>Blogdan Son Yazılar</h2>
          <p>Bilgi, rehber ve güncel duyurular</p>
        </div>
        <div class="blog-grid" id="blogGrid"></div>
      </div>
    </section>

    <!-- HAKKIMIZDA ÖZET -->
    <section class="section alt" id="about-teaser">
      <div class="container">
        <div class="section-title">
          <h2>Elçi Kimdir? & Misyonumuz</h2>
          <p>Hakkımızda sayfasından özet bilgiler</p>
        </div>
        <div class="about-cards">
          <div class="about-card" id="elciKimdirCard">
            <h3>Elçi Kimdir?</h3>
            <div class="content">Yükleniyor…</div>
            <p style="margin-top:10px"><a class="btn" style="background:var(--secondary);color:#fff;border-radius:10px;padding:10px 14px;font-weight:600" href="about.html#elci-kimdir">Tamamını Oku</a></p>
          </div>
          <div class="about-card" id="misyonVizyonCard">
            <h3>Misyon & Vizyon</h3>
            <div class="content">Yükleniyor…</div>
            <p style="margin-top:10px"><a class="btn" style="background:var(--secondary);color:#fff;border-radius:10px;padding:10px 14px;font-weight:600" href="about.html#misyon-vizyon">Tamamını Oku</a></p>
          </div>
        </div>
      </div>
    </section>

    <!-- GOOGLE YORUMLARI -->
    <section id="google-yorumlari" class="section">
      <div class="container">
        <div class="section-title">
          <h2>Google Yorumları</h2>
          <p>Hasta sahiplerinin deneyimleri</p>
        </div>
        <!-- İstekte kaldırmak istediğin özet kısım çıkarıldı. Sadece kartlar dönecek. -->
        <div id="reviewsGrid"></div>
        <p style="margin-top:16px">
          <a class="btn btn-primary" href="https://www.google.com/maps/place/El%C3%A7i+Veteriner+Klini%C4%9Fi" target="_blank" rel="noopener">
            Google'da tüm yorumları gör
          </a>
        </p>
      </div>
    </section>

    <!-- YOUTUBE (öneriler tarzı kompakt kartlar) -->
    <section id="youtube" class="section alt">
      <div class="container embed-wrap">
        <div class="section-title">
          <h2>YouTube’dan</h2>
          <p>Videolarımız ve bilgilendirici içerikler</p>
        </div>
        <div id="ytGrid"></div>
        <p style="margin-top:16px">
          <a class="btn btn-outline" href="https://www.youtube.com/@El%C3%A7iveterinerklini%C4%9Fi/videos" target="_blank" rel="noopener">Kanalı Ziyaret Et</a>
        </p>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer>
    <div class="container footer-container">
      <div class="footer-col">
        <h3>Elçi Veteriner Kliniği</h3>
        <p>Konya'nın Meram ilçesinde, hayvan sağlığı alanında uzman ekibimizle hizmet veriyoruz. 7/24 acil veteriner hizmeti.</p>
        <div class="social-links">
          <a href="https://www.facebook.com/elciveteriner" aria-label="Facebook" target="_blank"><i class="fab fa-facebook-f"></i></a>
          <a href="https://www.instagram.com/elcivetklinigi/" aria-label="Instagram" target="_blank"><i class="fab fa-instagram"></i></a>
          <a href="https://twitter.com/elciveteriner" aria-label="Twitter" target="_blank"><i class="fab fa-twitter"></i></a>
          <a href="https://www.youtube.com/@El%C3%A7iveterinerklini%C4%9Fi" aria-label="YouTube" target="_blank"><i class="fab fa-youtube"></i></a>
        </div>
      </div>
      <div class="footer-col">
        <h3>Hızlı Linkler</h3>
        <ul class="footer-links">
          <li><a href="index.html">Ana Sayfa</a></li>
          <li><a href="about.html">Hakkımızda</a></li>
          <li><a href="hizmetler.html">Hizmetlerimiz</a></li>
          <li><a href="blog.html">Blog</a></li>
          <li><a href="sss.html">SSS</a></li>
          <li><a href="hasta-iliskileri.html">Hasta İlişkileri</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h3>Konya Veteriner Hizmetlerimiz</h3>
        <ul class="footer-links">
          <li><a href="hizmetler.html#acil">Konya Acil Veteriner</a></li>
          <li><a href="hizmetler.html#cerrahi">Konya'da Cerrahi Operasyonlar</a></li>
          <li><a href="hizmetler.html#agiz-dis">Konya'da Ağız ve Diş Sağlığı</a></li>
          <li><a href="hizmetler.html#ic-hastaliklari">Konya'da İç Hastalıkları</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h3>Konya İletişim</h3>
        <ul class="footer-contact">
          <li><i class="fas fa-map-marker-alt"></i>
            <a href="https://www.google.com/maps?q=Havzan+Mahallesi,+Yeni+Meram+Caddesi+No:17/1,+Meram/Konya" target="_blank">Havzan Mah., Yeni Meram Cad. No:17/1, Meram/Konya</a>
          </li>
          <li><i class="fas fa-phone-alt"></i> <a href="tel:03323223220">0332 322 32 20</a></li>
          <li><i class="fas fa-envelope"></i> <a href="mailto:elcivetklinigi@gmail.com">elcivetklinigi@gmail.com</a></li>
          <li><i class="fas fa-clock"></i> Pazartesi–Cumartesi: 08:00–19:00, Pazar: Acil</li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom"><div class="container">
      <p>&copy; 2025 Elçi Veteriner Kliniği - Konya. Tüm hakları saklıdır.</p>
    </div></div>
  </footer>

  <!-- JSON-LD (mutlak URL) -->
  <script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@type":"VeterinaryCare",
    "name":"Elçi Veteriner Kliniği",
    "url":"https://veteriner-klinik-sitesi.netlify.app/",
    "logo":"https://veteriner-klinik-sitesi.netlify.app/assets/img/uploads/logo.png",
    "image":"https://veteriner-klinik-sitesi.netlify.app/assets/img/uploads/og-cover.jpg",
    "telephone":"+903323223220",
    "address":{
      "@type":"PostalAddress",
      "streetAddress":"Havzan Mah. Yeni Meram Cad. 17/1",
      "addressLocality":"Meram",
      "addressRegion":"Konya",
      "addressCountry":"TR"
    },
    "priceRange":"₺₺",
    "openingHoursSpecification":[{
      "@type":"OpeningHoursSpecification",
      "dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
      "opens":"08:00","closes":"19:00"
    }],
    "sameAs":[
      "https://www.facebook.com/elciveteriner",
      "https://www.instagram.com/elcivetklinigi/",
      "https://twitter.com/elciveteriner",
      "https://www.youtube.com/@El%C3%A7iveterinerklini%C4%9Fi"
    ]
  }
  </script>

  <!-- Ana JS -->
  <script src="assets/js/main.js?v=11" defer></script>
</body>
</html>
```

---

# assets/js/main.js (güncellenmiş)

```js
/* main.js v11 — Elçi Veteriner Kliniği
 * - Mobil menü
 * - Instagram: yavaş akış + rastgele büyüyen görseller (geri döner)
 * - Google Yorumları: renkli kartlar, beyaz yıldızlar, yumuşak dönüşümlü rotasyon
 * - YouTube: 3'lü kart, 7 sn sonra 2-3-4 → 3-4-5 şeklinde kayan setler
 * - Blog & About teaser dummy yükleme
 * - Yol/fallback korumaları (404 görsellerde gizleme)
 */
(function(){
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  // === Mobil Menü ===
  const mobileBtn = $('#mobileMenuBtn');
  const mainMenu = $('#mainMenu');
  if(mobileBtn && mainMenu){
    mobileBtn.addEventListener('click', ()=>{
      const open = mainMenu.classList.toggle('open');
      mobileBtn.setAttribute('aria-expanded', String(open));
    });
  }

  // === INSTAGRAM ===
  // Not: Gerçek Instagram API anahtarı olmadan doğrudan çekim yapılamaz.
  // Bu yüzden yerel dizinden (assets/img/insta) görseller kullanıyoruz.
  const instaGrid = $('#instaGrid');
  const instaImages = [
    '1.jpg','2.jpg','3.jpg','4.jpg','5.jpg','6.jpg','7.jpg','8.jpg','9.jpg','10.jpg',
    '11.jpg','12.jpg','13.jpg','14.jpg','15.jpg'
  ].map(n => `assets/img/insta/${n}`);

  function renderInsta(){
    if(!instaGrid) return;
    instaGrid.innerHTML = '';
    instaImages.forEach(src => {
      const item = document.createElement('div');
      item.className = 'insta-item slow';
      const img = document.createElement('img');
      img.src = src;
      img.alt = 'Elçi Veteriner Instagram görseli';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.onerror = ()=>{ item.style.display='none'; };
      item.appendChild(img);
      instaGrid.appendChild(item);
    });

    // Rastgele büyüt/geri al — her 6 sn'de bir, 2 görseli 4 sn özellikli yap
    let featured = [];
    setInterval(()=>{
      // Öncekileri eski haline getir
      featured.forEach(el=> el.classList.remove('featured'));
      // Yeni seçim
      const items = $$('.insta-item', instaGrid);
      featured = [];
      const picks = new Set();
      while(picks.size < 2 && picks.size < items.length){
        picks.add(Math.floor(Math.random()*items.length));
      }
      picks.forEach(i=>{
        const el = items[i];
        if(el){
          el.classList.add('featured');
          featured.push(el);
        }
      });
      // 4 sn sonra geri döndür (yavaş akış devam)
      setTimeout(()=>{
        featured.forEach(el=> el.classList.remove('featured'));
      }, 4000);
    }, 6000);
  }

  // === GOOGLE YORUMLARI ===
  // İstek: "★ 5.0 / 5 — 33 yorum" gibi özet kaldırıldı.
  // Kartlar beyaz yıldızlı, daha büyük ve belirgin.
  const reviewsGrid = $('#reviewsGrid');
  const defaultReviews = [
    {author:'Merve K.', text:'Kedimin acil durumunda gece yarısı çok hızlı ilgilendiler. İlgi ve alakaları için teşekkürler.', stars:5},
    {author:'Özgür B.', text:'Cerrahi operasyon sonrası takipleri mükemmeldi. Gönül rahatlığıyla tavsiye ederim.', stars:5},
    {author:'Ayşe T.', text:'Diş taşı temizliği sonrası nefes kokusu bitti. Çok memnun kaldık.', stars:5},
    {author:'Mehmet D.', text:'Aşı ve parazit programını detaylı anlattılar, güven veriyorlar.', stars:5},
    {author:'Elif Ş.', text:'Köpeğimiz için görüntüleme ve kan tahlilleri çok hızlı yapıldı.', stars:5},
    {author:'Deniz R.', text:'Klinik çok temiz, ekip güler yüzlü. Teşekkürler.', stars:5}
  ];

  async function fetchJSON(url){
    try{
      const res = await fetch(url);
      if(!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    }catch(e){ return null; }
  }

  async function renderReviews(){
    if(!reviewsGrid) return;
    const data = await fetchJSON('assets/data/google-reviews.json') || defaultReviews;
    let idx = 0;

    function drawSet(){
      // 3 kart göster
      reviewsGrid.innerHTML = '';
      const slice = [data[idx%data.length], data[(idx+1)%data.length], data[(idx+2)%data.length]];
      slice.forEach(r=>{
        const card = document.createElement('div');
        card.className = 'review-card';
        const stars = '★★★★★'.slice(0, Math.max(0, Math.min(5, r.stars||5)));
        card.innerHTML = `
          <div class="stars" aria-label="${r.stars||5} yıldız">${stars}</div>
          <div class="text">${r.text}</div>
          <div class="author" style="margin-top:10px">— ${r.author}</div>
        `;
        reviewsGrid.appendChild(card);
      });
    }

    drawSet();
    // 7 sn'de bir yumuşak değişim
    setInterval(()=>{
      $$('.review-card', reviewsGrid).forEach(el=> el.classList.add('rotate-out'));
      setTimeout(()=>{
        idx = (idx + 1) % data.length;
        drawSet();
      }, 650); // animasyon süresi ile senkron
    }, 7000);
  }

  // === YOUTUBE ===
  // YouTube API anahtarı olmadan canlı liste alınamaz. Yerel json + fallback kullanıyoruz.
  const ytGrid = $('#ytGrid');
  const defaultVideos = [
    // Lütfen kendi video ID’lerinle güncelle (watch?v=XXXX kısmı)
    {id:'dQw4w9WgXcQ', title:'Kedi Ağız ve Diş Sağlığı: Evde Bakım İpuçları'},
    {id:'oHg5SJYRHA0', title:'Köpeklerde Parazit Kontrol Takvimi Nasıl Olmalı?'},
    {id:'9bZkp7q19f0', title:'Acil Durumda İlk Müdahale: Neler Yapmalı?'},
    {id:'3JZ_D3ELwOQ', title:'Kısırlaştırma Sonrası Bakım Rehberi'},
    {id:'L_jWHffIx5E', title:'Röntgen ve Ultrason: Hangi Durumda Hangisi?'}
  ];

  function ytEmbedHTML(v){
    const src = `https://www.youtube.com/embed/${v.id}?rel=0`;
    return `
      <div class="yt-card slide-enter">
        <div class="yt-thumb">
          <iframe width="100%" height="100%" src="${src}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        </div>
        <div class="yt-body"><strong>${v.title||''}</strong></div>
      </div>
    `;
  }

  async function renderYouTube(){
    if(!ytGrid) return;
    const data = await fetchJSON('assets/data/youtube.json') || defaultVideos;
    let start = 0; // 0-1-2 ile başla

    function draw(){
      ytGrid.innerHTML = '';
      for(let i=0;i<3;i++){
        const v = data[(start+i)%data.length];
        ytGrid.insertAdjacentHTML('beforeend', ytEmbedHTML(v));
      }
    }

    draw();
    // 7 sn sonra bir sağa kaydır → 1-2-3, sonra 2-3-4 ...
    setInterval(()=>{
      // çıkış animasyonu ekle
      $$('.yt-card', ytGrid).forEach(el=> el.classList.add('slide-exit'));
      setTimeout(()=>{
        start = (start + 1) % data.length;
        draw();
      }, 550);
    }, 7000);
  }

  // === BLOG & ABOUT TEASER === (örnek/dummy)
  const blogGrid = $('#blogGrid');
  function renderBlog(){
    if(!blogGrid) return;
    const posts = [
      {img:'assets/img/uploads/blog1.jpg', title:'Kedilerde Ağız ve Diş Sağlığı', text:'Evde bakım ipuçları ve klinikte yapılması gerekenler.'},
      {img:'assets/img/uploads/blog2.jpg', title:'Köpeklerde Aşılama Programı', text:'Yaşa göre aşı takvimi ve parazit kontrolü.'},
      {img:'assets/img/uploads/blog3.jpg', title:'Acil Durum Rehberi', text:'İlk müdahale adımları ve ne zaman kliniğe gelmeli?'}
    ];
    blogGrid.innerHTML = '';
    posts.forEach(p=>{
      const card = document.createElement('div');
      card.className = 'blog-card';
      card.innerHTML = `
        <div class="thumb"><img src="${p.img}" alt="${p.title}" onerror="this.parentElement.style.display='none'"></div>
        <div class="body"><h3>${p.title}</h3><p>${p.text}</p></div>
      `;
      blogGrid.appendChild(card);
    });
  }

  async function renderAboutTeasers(){
    const elci = $('#elciKimdirCard .content');
    const misyon = $('#misyonVizyonCard .content');
    if(elci) elci.textContent = 'Veteriner hekimliğin farklı branşlarında tecrübe; etik, şeffaf ve bilimsel yaklaşım.';
    if(misyon) misyon.textContent = 'Amacımız, evcil dostlarınıza güvenli ve konforlu bir tedavi deneyimi sunmak.';
  }

  // === INIT ===
  document.addEventListener('DOMContentLoaded', ()=>{
    renderInsta();
    renderReviews();
    renderYouTube();
    renderBlog();
    renderAboutTeasers();
  });
})();
```

---

## Notlar & Uygulama Talimatları

1. **Klasör yapısı**

   * `assets/img/uploads/` içinde: `logo.png`, `clinic-hero.jpg`, `og-cover.jpg`, `favicon-32.png`, `favicon-16.png`, `apple-touch-icon.png`, opsiyonel `blog1.jpg`, `blog2.jpg`, `blog3.jpg`.
   * `assets/img/insta/` içinde: `1.jpg` … `15.jpg` (en az 10 görsel önerilir).
   * `assets/data/` içinde isteğe bağlı `google-reviews.json` ve `youtube.json` (yoksa JS içindeki **fallback** veriler kullanılır).

2. **CSP hataları**

   * Görselleri **mutlaka** kendi domaininden (aynı origin) yükleyin: `assets/...` dışına çıkmayın. `og:image` ve `twitter:image` alanları için **mutlak** URL zorunlu; bunlar Netlify domaininde kalıyor, sorun yok.

3. **Instagram akış hızını yarıya düşürme ve öne çıkma animasyonu**

   * Görseller varsayılan olarak `slow` sınıfıyla hafif zoom (yavaş akış) yapıyor.
   * Her **6 saniyede** 2 görsel **4 saniyeliğine** `featured` olup 2x2 yer kaplayarak büyüyor; sonra eski haline dönüyor.

4. **Google yorumları**

   * İstediğin metinli özet kaldırıldı; yalnız kartlar dönüyor.
   * Yıldızlar **beyaz** ve kartlar renkli gradient arka plana sahip.
   * `assets/data/google-reviews.json` eklersen otomatik onu kullanır. Örnek şema:

```json
[
  {"author":"Ad Soyad","text":"Deneyim metni","stars":5},
  {"author":"Ad2","text":"Metin 2","stars":5}
]
```

5. **YouTube**

   * 3 video ile başlar; **7 sn** sonra bir sağa kayarak sonraki seti gösterir (1-2-3 → 2-3-4 → 3-4-5 …).
   * `assets/data/youtube.json` eklersen onu kullanır. Örnek:

```json
[
  {"id":"VID_ID_1","title":"Başlık 1"},
  {"id":"VID_ID_2","title":"Başlık 2"},
  {"id":"VID_ID_3","title":"Başlık 3"},
  {"id":"VID_ID_4","title":"Başlık 4"}
]
```

6. **404 görseller**

   * Logo veya blog görselleri 404 verirse öğe gizlenir; layout bozulmaz.

7. **Sürümleme**

   * `<script src="assets/js/main.js?v=11" defer></script>` ile önbellek kırılır.

8. **Performans**

   * Tüm iframelar lazy değil (YouTube politikası), ancak kart sayısı 3 olduğu için uygundur.

9. **İsteğe bağlı düzenleme**

   * Yorum rotasyon süresi, Instagram “featured” sayısı/süresi kolayca değiştirilebilir (dosyada arat: `setInterval`).
