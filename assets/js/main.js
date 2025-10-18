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

  <!-- Favicons -->
  <link rel="icon" type="image/png" sizes="32x32" href="assets/img/uploads/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="assets/img/uploads/favicon-16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="assets/img/uploads/apple-touch-icon.png">
  <link rel="manifest" href="site.webmanifest">

  <!-- Canonical & Theme -->
  <link rel="canonical" href="https://veteriner-klinik-sitesi.netlify.app/">
  <meta name="theme-color" content="#6a0ea1">

  <!-- Social -->
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
    --light:#f7f8fc; --dark:#0f172a; --muted:#6b7280; --white:#fff; --border:#e6eef7;
    --shadow-sm:0 6px 16px rgba(15,23,42,.06);
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
  .dropdown-content{position:absolute;top:100%;left:0;min-width:260px;background:#fff;border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-md);padding:10px 8px;display:none}
  .dropdown-content a{display:block;padding:10px 12px;border-radius:8px;color:#374151}
  .dropdown-content a:hover{background:#f7fbff;color:#0f172a}
  .dropdown:hover .dropdown-content{display:block}
  .mobile-menu-btn{display:none;background:none;border:0;font-size:24px;color:var(--primary);cursor:pointer}

  /* HERO */
  .hero{margin-top:88px;background:var(--grad-hero), url('assets/img/uploads/clinic-hero.jpg') center/cover no-repeat;background-blend-mode: overlay;color:#fff}
  .hero .container{display:flex;flex-direction:column;align-items:center;text-align:center;padding:120px 16px 40px}
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
  .btn.small{padding:8px 14px;border-radius:12px;font-weight:700}

  /* Sections */
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
  .flip-front .icon{width:68px;height:68px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:30px;background:linear-gradient(135deg,var(--secondary),var(--primary));color:#fff;box-shadow:0 10px 22px rgba(16,179,209,.25)}
  .flip-front h3{margin-top:12px;color:var(--primary)}
  .flip-back{transform:rotateY(180deg);background:#f7fbff;border:1px dashed #dbeafe}
  .flip-back p{color:#555;margin-bottom:12px}
  .flip-back a{font-weight:700}

  /* Blog */
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

  /* INSTAGRAM yavaş + spotlight */
  #instaGrid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
  .insta-item{position:relative;overflow:hidden;border-radius:14px}
  .insta-item img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .9s ease, box-shadow .9s}
  .insta-item.spotlight{z-index:2}
  .insta-item.spotlight img{transform:scale(1.18);box-shadow:0 20px 40px rgba(0,0,0,.28)}
  @media (max-width: 900px){
    #instaGrid{display:flex;gap:10px;overflow:auto;scroll-snap-type:x mandatory;padding-bottom:4px}
    .insta-item{min-width:42%;scroll-snap-align:center}
  }

  /* GOOGLE YORUMLARI sıfırdan */
  #ratingSummary{display:flex;align-items:center;gap:10px;margin-bottom:16px;justify-content:space-between;flex-wrap:wrap}
  #ratingSummary-badge{
    display:inline-flex;align-items:center;gap:10px;padding:10px 14px;border-radius:14px;
    background:linear-gradient(135deg,var(--primary),var(--secondary));color:#fff;box-shadow:var(--shadow-sm);font-weight:700
  }
  .review-controls{display:flex;gap:8px}
  .review-controls .btn.small{border:2px solid var(--primary);color:var(--primary);background:#fff}
  #reviewsGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
  .review-card{position:relative;background:#fff;border:1px solid var(--border);border-radius:16px;padding:16px;box-shadow:var(--shadow-sm);transform:translateY(0);opacity:1;transition:transform .5s, opacity .5s}
  .review-card.fade-out{transform:translateY(8px);opacity:0}
  .review-head{display:flex;align-items:center;gap:12px}
  .review-avatar{width:44px;height:44px;border-radius:50%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-weight:800}
  .review-name{font-weight:700}
  .review-stars{margin-left:auto;display:inline-flex;align-items:center;gap:6px;background:#111;color:#fff;padding:4px 10px;border-radius:10px;font-weight:800}
  .review-text{color:#374151;margin-top:8px}
  .review-ribbon{position:absolute;right:12px;top:-10px;background:var(--secondary);color:#fff;font-size:12px;padding:4px 8px;border-radius:8px;box-shadow:var(--shadow-sm)}

  /* YOUTUBE şerit + geçişler */
  #ytGrid{display:flex;gap:14px;overflow:hidden}
  .yt-card{flex:0 0 calc(33.333% - 10px);background:#fff;border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-sm);overflow:hidden;transition:transform .3s}
  .yt-card:hover{transform:translateY(-4px)}
  .yt-thumb{aspect-ratio:16/9;background:#e5e7eb}
  .yt-body{padding:10px}
  .yt-title{font-weight:700;color:#0f172a;font-size:15px;line-height:1.35}
  .yt-meta{font-size:12px;color:#6b7280;margin-top:6px}

  /* Footer */
  footer{background:linear-gradient(135deg,#1a3a52,var(--primary));color:#fff;padding:60px 0 0}
  .footer-container{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:26px;margin-bottom:36px}
  .footer-col h3{color:#fff;margin-bottom:12px;position:relative;padding-bottom:10px}
  .footer-col h3:after{content:"";position:absolute;left:0;bottom:0;height:2px;width:40px;background:var(--secondary)}
  .footer-links li{list-style:none;margin:8px 0}
  .footer-links a{color:#fff;opacity:.85}
  .footer-links a:hover{opacity:1;color:#secondary}
  .footer-contact li{list-style:none;margin:10px 0;display:flex;gap:10px}
  .social-links{display:flex;gap:8px;margin-top:10px}
  .social-links a{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.1);color:#fff}
  .social-links a:hover{background:var(--secondary)}
  .footer-bottom{background:rgba(0,0,0,.28);text-align:center;padding:16px 0}
  </style>
</head>

<body class="home">
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
          <img class="logo-img" src="assets/img/uploads/logo.png" alt="Elçi Veteriner Logosu" width="168" height="44"
               loading="eager" decoding="async" fetchpriority="high"
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
    <!-- HERO -->
    <section class="hero" aria-label="Açılış">
      <div class="container">
        <div class="brand-mark"><img src="assets/img/uploads/logo.png" alt="Elçi Veteriner" onerror="this.style.display='none'"></div>
        <h1>Konya’da 7/24 Acil ve Kapsamlı Veterinerlik</h1>
        <div class="underline"></div>
        <p>Koruyucu hekimlikten ileri cerrahiye, diş sağlığından görüntüleme & laboratuvara: evcil dostlarınız için güven, şeffaflık ve etik yaklaşım.</p>
        <div class="hero-cta">
          <a class="btn btn-primary" href="hasta-iliskileri.html#online-randevu"><i class="fas fa-calendar-check"></i> Online Randevu Al</a>
          <a class="btn btn-outline" href="tel:03323223220"><i class="fas fa-phone"></i> 0332 322 32 20</a>
        </div>

        <div class="quick-nav" aria-label="Site Rehberi" style="width:100%;max-width:1200px;margin-top:36px;padding:22px 12px 8px;border-top:1px solid rgba(255,255,255,.25)">
          <div class="quick-grid" style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px">
            <a class="quick-item" href="hizmetler.html#acil"><div class="qicon"><i class="fa-solid fa-stethoscope"></i></div><strong>Acil / Doktor</strong></a>
            <a class="quick-item" href="hizmetler.html"><div class="qicon"><i class="fa-solid fa-heart-pulse"></i></div><strong>Branşlarımız</strong></a>
            <a class="quick-item" href="hasta-iliskileri.html#online-randevu"><div class="qicon"><i class="fa-solid fa-calendar-check"></i></div><strong>Hızlı Randevu</strong></a>
            <a class="quick-item" href="#google-yorumlari"><div class="qicon"><i class="fa-solid fa-star-half-stroke"></i></div><strong>Google Yorumları</strong></a>
            <a class="quick-item" href="#instagram"><div class="qicon"><i class="fa-brands fa-instagram"></i></div><strong>Instagram</strong></a>
            <a class="quick-item" href="contact.html"><div class="qicon"><i class="fa-solid fa-phone-volume"></i></div><strong>İletişim</strong></a>
          </div>
        </div>
      </div>
    </section>

    <!-- HİZMETLER -->
    <section class="section" id="hizmetler-ozet">
      <div class="container">
        <div class="section-title"><h2>Hizmetlerimiz</h2><p>İhtiyacınıza yönelik çözümler</p></div>
        <div class="services-grid">
          <div class="flip-card"><div class="flip-card-inner"><div class="flip-face flip-front"><div class="icon"><i class="fas fa-ambulance"></i></div><h3>7/24 Acil</h3></div><div class="flip-face flip-back"><p>Kaza, zehirlenme, solunum sıkıntısı gibi durumlarda hızlı ve doğru müdahale.</p><a href="hizmetler.html#acil">Detayları gör →</a></div></div></div>
          <div class="flip-card"><div class="flip-card-inner"><div class="flip-face flip-front"><div class="icon"><i class="fas fa-shield-virus"></i></div><h3>Koruyucu Hekimlik</h3></div><div class="flip-face flip-back"><p>Aşılama, parazit kontrolü, check-up ve yaşam boyu sağlık planları.</p><a href="hizmetler.html#koruyucu">Detayları gör →</a></div></div></div>
          <div class="flip-card"><div class="flip-card-inner"><div class="flip-face flip-front"><div class="icon"><i class="fas fa-scalpel"></i></div><h3>Cerrahi</h3></div><div class="flip-face flip-back"><p>Kısırlaştırma, yumuşak doku, ortopedik ve onkolojik cerrahiler.</p><a href="hizmetler.html#cerrahi">Detayları gör →</a></div></div></div>
          <div class="flip-card"><div class="flip-card-inner"><div class="flip-face flip-front"><div class="icon"><i class="fas fa-tooth"></i></div><h3>Diş Sağlığı</h3></div><div class="flip-face flip-back"><p>Diş taşı temizliği, çekim, periodontal tedaviler ve ev bakımı eğitimi.</p><a href="hizmetler.html#agiz-dis">Detayları gör →</a></div></div></div>
          <div class="flip-card"><div class="flip-card-inner"><div class="flip-face flip-front"><div class="icon"><i class="fas fa-x-ray"></i></div><h3>Görüntüleme</h3></div><div class="flip-face flip-back"><p>Dijital röntgen, ultrason, EKG ve laboratuvar ile doğru tanı.</p><a href="hizmetler.html#ic-hastaliklari">Detayları gör →</a></div></div></div>
          <div class="flip-card"><div class="flip-card-inner"><div class="flip-face flip-front"><div class="icon"><i class="fas fa-home"></i></div><h3>Konaklama</h3></div><div class="flip-face flip-back"><p>Hijyenik, klimalı odalar; günlük kontrol ve oyun alanları.</p><a href="hizmetler.html#konaklama">Detayları gör →</a></div></div></div>
        </div>
      </div>
    </section>

    <!-- INSTAGRAM -->
    <section id="instagram" class="section alt" data-speed="6000" data-spotlight="2500">
      <div class="container">
        <div class="section-title"><h2>Instagram’dan</h2><p>Kliniğimizden güncel kareler</p></div>
        <div id="instaGrid" aria-live="polite"></div>
        <p style="margin-top:16px"><a class="btn btn-outline" href="https://www.instagram.com/elcivetklinigi/" target="_blank" rel="noopener">Instagram’ı Takip Et</a></p>
      </div>
    </section>

    <!-- BLOG ÖZET -->
    <section class="section" id="blog-ozet">
      <div class="container">
        <div class="section-title"><h2>Blogdan Son Yazılar</h2><p>Bilgi, rehber ve güncel duyurular</p></div>
        <div class="blog-grid" id="blogGrid"></div>
      </div>
    </section>

    <!-- HAKKIMIZDA ÖZET -->
    <section class="section alt" id="about-teaser">
      <div class="container">
        <div class="section-title"><h2>Elçi Kimdir? & Misyonumuz</h2><p>Hakkımızda sayfasından özet bilgiler</p></div>
        <div class="about-cards">
          <div class="about-card" id="elciKimdirCard"><h3>Elçi Kimdir?</h3><div class="content">Kurucumuz ve ekibimizle tanışın: deneyim, eğitim ve yaklaşımımız.</div><p style="margin-top:10px"><a class="btn" style="background:var(--secondary);color:#fff;border-radius:10px;padding:10px 14px;font-weight:600" href="about.html#elci-kimdir">Tamamını Oku</a></p></div>
          <div class="about-card" id="misyonVizyonCard"><h3>Misyon & Vizyon</h3><div class="content">Hayvan refahı odaklı, şeffaf ve etik hekimlik anlayışımız.</div><p style="margin-top:10px"><a class="btn" style="background:var(--secondary);color:#fff;border-radius:10px;padding:10px 14px;font-weight:600" href="about.html#misyon-vizyon">Tamamını Oku</a></p></div>
        </div>
      </div>
    </section>

    <!-- GOOGLE YORUMLARI -->
    <section id="google-yorumlari" class="section" data-rotate="7000">
      <div class="container">
        <div class="section-title"><h2>Google Yorumları</h2><p>Hasta sahiplerinin deneyimleri</p></div>

        <div id="ratingSummary">
          <span id="ratingSummary-badge">★ 5.0 / 5 — 33 yorum</span>
          <div class="review-controls">
            <button class="btn small" id="revPrev" aria-label="Önceki yorumlar"><i class="fa-solid fa-chevron-left"></i></button>
            <button class="btn small" id="revNext" aria-label="Sonraki yorumlar"><i class="fa-solid fa-chevron-right"></i></button>
          </div>
        </div>

        <div id="reviewsGrid"></div>

        <p style="margin-top:16px">
          <a class="btn btn-primary" href="https://www.google.com/maps/place/El%C3%A7i+Veteriner+Klini%C4%9Fi" target="_blank" rel="noopener">Google'da tüm yorumları gör</a>
        </p>
      </div>
    </section>

    <!-- YOUTUBE -->
    <section id="youtube" class="section alt" data-shift="7000">
      <div class="container embed-wrap">
        <div class="section-title"><h2>YouTube’dan</h2><p>Videolarımız ve bilgilendirici içerikler</p></div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin:-10px 0 10px">
          <button class="btn small" id="ytPrev" aria-label="Önceki videolar"><i class="fa-solid fa-chevron-left"></i></button>
          <button class="btn small" id="ytNext" aria-label="Sonraki videolar"><i class="fa-solid fa-chevron-right"></i></button>
        </div>

        <div id="ytGrid"></div>

        <p style="margin-top:16px"><a class="btn btn-outline" href="https://www.youtube.com/@El%C3%A7iveterinerklini%C4%9Fi/videos" target="_blank" rel="noopener">Kanalı Ziyaret Et</a></p>
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
          <li><i class="fas fa-map-marker-alt"></i> <a href="https://www.google.com/maps?q=Havzan+Mahallesi,+Yeni+Meram+Caddesi+No:17/1,+Meram/Konya" target="_blank">Havzan Mah., Yeni Meram Cad. No:17/1, Meram/Konya</a></li>
          <li><i class="fas fa-phone-alt"></i> <a href="tel:03323223220">0332 322 32 20</a></li>
          <li><i class="fas fa-envelope"></i> <a href="mailto:elcivetklinigi@gmail.com">elcivetklinigi@gmail.com</a></li>
          <li><i class="fas fa-clock"></i> Pazartesi–Cumartesi: 08:00–19:00, Pazar: Acil</li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom"><div class="container"><p>&copy; 2025 Elçi Veteriner Kliniği - Konya. Tüm hakları saklıdır.</p></div></div>
  </footer>

  <!-- JSON-LD -->
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"VeterinaryCare","name":"Elçi Veteriner Kliniği","url":"https://veteriner-klinik-sitesi.netlify.app/","logo":"https://veteriner-klinik-sitesi.netlify.app/assets/img/uploads/logo.png","image":"https://veteriner-klinik-sitesi.netlify.app/assets/img/uploads/og-cover.jpg","telephone":"+903323223220","address":{"@type":"PostalAddress","streetAddress":"Havzan Mah. Yeni Meram Cad. 17/1","addressLocality":"Meram","addressRegion":"Konya","addressCountry":"TR"},"priceRange":"₺₺","openingHoursSpecification":[{"@type":"OpeningHoursSpecification","dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],"opens":"08:00","closes":"19:00"}],"sameAs":["https://www.facebook.com/elciveteriner","https://www.instagram.com/elcivetklinigi/","https://twitter.com/elciveteriner","https://www.youtube.com/@El%C3%A7iveterinerklini%C4%9Fi"]}
  </script>

  <!-- Inline JS -->
  <script>
  // helpers
  const qs=(s,el=document)=>el.querySelector(s);
  const qsa=(s,el=document)=>[...el.querySelectorAll(s)];
  function onVisible(el,cb,opt={threshold:.2}){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){cb();io.unobserve(el);}}),opt);io.observe(el);}
  // mobil menü
  document.addEventListener('DOMContentLoaded',()=>{
    const btn=qs('#mobileMenuBtn'), ul=qs('#mainMenu');
    if(btn&&ul){btn.addEventListener('click',()=>{const open=ul.getAttribute('data-open')==='1';ul.style.display=open?'':'flex';ul.style.flexDirection=open?'':'column';ul.style.gap=open?'':'12px';ul.setAttribute('data-open',open?'0':'1');btn.setAttribute('aria-expanded',(!open).toString());});}
  });

  // INSTAGRAM: yavaş + spotlight
  (function(){
    const section=qs('#instagram'); const grid=qs('#instaGrid');
    if(!section||!grid) return;
    const STEP_MS=Number(section.dataset.speed||6000);
    const SPOT_MS=Number(section.dataset.spotlight||2500);
    const data=[
      {src:'assets/img/insta/1.jpg',alt:'Klinik 1'},
      {src:'assets/img/insta/2.jpg',alt:'Klinik 2'},
      {src:'assets/img/insta/3.jpg',alt:'Klinik 3'},
      {src:'assets/img/insta/4.jpg',alt:'Klinik 4'},
      {src:'assets/img/insta/5.jpg',alt:'Klinik 5'},
      {src:'assets/img/insta/6.jpg',alt:'Klinik 6'},
      {src:'assets/img/insta/7.jpg',alt:'Klinik 7'},
      {src:'assets/img/insta/8.jpg',alt:'Klinik 8'}
    ];
    grid.innerHTML='';
    data.slice(0,15).forEach(i=>{
      const d=document.createElement('div'); d.className='insta-item';
      d.innerHTML=\`<img loading="lazy" decoding="async" src="\${i.src}" alt="\${i.alt}">\`;
      grid.appendChild(d);
    });
    function spotlight(){
      const items=qsa('.insta-item',grid); if(!items.length) return;
      const pick=items[Math.floor(Math.random()*items.length)];
      pick.classList.add('spotlight');
      setTimeout(()=>pick.classList.remove('spotlight'), SPOT_MS);
    }
    let t=null;
    function start(){ stop(); t=setInterval(()=>{
      if(grid.scrollWidth>grid.clientWidth){
        const next=grid.scrollLeft + grid.clientWidth*0.45;
        grid.scrollTo({left:next,behavior:'smooth'});
        if(next + grid.clientWidth >= grid.scrollWidth-8){
          setTimeout(()=>grid.scrollTo({left:0,behavior:'smooth'}),300);
        }
      }
      spotlight();
    }, STEP_MS);}
    function stop(){ if(t){clearInterval(t); t=null;} }
    onVisible(section,start);
    document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
  })();

  // GOOGLE YORUMLARI: sıfırdan tasarım + döngü + butonlar
  (function(){
    const section=qs('#google-yorumlari'); if(!section) return;
    const grid=qs('#reviewsGrid'); const summary=qs('#ratingSummary-badge');
    const ROTATE_MS=Number(section.dataset.rotate||7000);
    const reviews=[
      {name:'Merve K.',rating:5,text:'Gece acilde çok ilgilendiler, minnoşumuz şimdi harika!',time:'2 hafta önce'},
      {name:'Seda B.',rating:5,text:'Diş taşını tertemiz yaptılar, ekip çok ilgili.',time:'1 ay önce'},
      {name:'Emre D.',rating:5,text:'USG ve kan tahlilleri hızlıca yapıldı.',time:'3 hafta önce'},
      {name:'Yasin A.',rating:5,text:'Güler yüzlü ve profesyoneller.',time:'4 gün önce'},
      {name:'Hakan Ç.',rating:5,text:'Konaklama alanı çok temiz ve güvenli.',time:'6 gün önce'},
      {name:'Leyla N.',rating:5,text:'Aşı ve check-up süreçleri düzenli ilerliyor.',time:'2 ay önce'}
    ];
    // ortalama rozeti (statik 5.0 yerine hesap)
    const avg=(reviews.reduce((a,r)=>a+(r.rating||5),0)/reviews.length).toFixed(1);
    if(summary) summary.textContent=\`★ \${avg} / 5 — \${reviews.length} yorum\`;

    let cursor=0;
    function render(){
      grid.innerHTML='';
      for(let i=0;i<3;i++){
        const r=reviews[(cursor+i)%reviews.length];
        const card=document.createElement('article');
        card.className='review-card';
        card.innerHTML=\`
          <div class="review-ribbon">Doğrulanmış Ziyaretçi</div>
          <div class="review-head">
            <div class="review-avatar">\${(r.name||'?').charAt(0)}</div>
            <div>
              <div class="review-name">\${r.name||'Ziyaretçi'}</div>
              <div style="font-size:12px;color:#6b7280">\${r.time||''}</div>
            </div>
            <div class="review-stars">★★★★★</div>
          </div>
          <div class="review-text">\${r.text||''}</div>\`;
        grid.appendChild(card);
      }
    }
    function step(dir=+1){
      qsa('.review-card',grid).forEach(c=>c.classList.add('fade-out'));
      setTimeout(()=>{ cursor=(cursor+(dir*3)+reviews.length)%reviews.length; render(); }, 500);
    }
    render();
    let t=null; function start(){ stop(); t=setInterval(()=>step(+1), ROTATE_MS); }
    function stop(){ if(t){clearInterval(t); t=null;} }
    onVisible(section,start);
    document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
    const prev=qs('#revPrev'), next=qs('#revNext');
    if(prev) prev.addEventListener('click',()=>{ stop(); step(-1); start(); });
    if(next) next.addEventListener('click',()=>{ stop(); step(+1); start(); });
  })();

  // YOUTUBE: 3’lü şerit + otomatik kaydırma + butonlar (1-2-3 → 2-3-4 → 3-4-5 …)
  (function(){
    const section=qs('#youtube'); const wrap=qs('#ytGrid');
    if(!section||!wrap) return;
    const SHIFT_MS=Number(section.dataset.shift||7000);
    const videos=[
      {id:'VIDEOID1', title:'Kedilerde Pyoderma – Belirtiler & Tedavi', channel:'Elçi Veteriner', date:'2025-09-01'},
      {id:'VIDEOID2', title:'Köpeklerde Diş Sağlığı – Ev Bakımı', channel:'Elçi Veteriner', date:'2025-08-21'},
      {id:'VIDEOID3', title:'Acil Durumda İlk 5 Dakika', channel:'Elçi Veteriner', date:'2025-08-10'},
      {id:'VIDEOID4', title:'Kedilerde Parazit Kontrolü 101', channel:'Elçi Veteriner', date:'2025-07-20'},
      {id:'VIDEOID5', title:'Röntgen & USG ile Doğru Tanı', channel:'Elçi Veteriner', date:'2025-07-05'}
    ];
    let start=0;
    function render(){
      wrap.innerHTML='';
      for(let i=0;i<3;i++){
        const v=videos[(start+i)%videos.length];
        const a=document.createElement('a');
        a.className='yt-card'; a.href=\`https://www.youtube.com/watch?v=\${v.id}\`; a.target='_blank'; a.rel='noopener';
        a.innerHTML=\`
          <div class="yt-thumb"><img loading="lazy" decoding="async" src="https://i.ytimg.com/vi/\${v.id}/hqdefault.jpg" alt="\${v.title}" style="width:100%;height:100%;object-fit:cover;display:block"></div>
          <div class="yt-body"><div class="yt-title">\${v.title}</div><div class="yt-meta">\${v.channel} · \${v.date||''}</div></div>\`;
        wrap.appendChild(a);
      }
    }
    function step(dir=+1){ start=(start+dir+videos.length)%videos.length; render(); }
    render();
    let t=null; function startAuto(){ stopAuto(); t=setInterval(()=>step(+1), SHIFT_MS); }
    function stopAuto(){ if(t){clearInterval(t); t=null;} }
    onVisible(section,startAuto);
    document.addEventListener('visibilitychange',()=>document.hidden?stopAuto():startAuto());
    const prev=qs('#ytPrev'), next=qs('#ytNext');
    if(prev) prev.addEventListener('click',()=>{ stopAuto(); step(-1); startAuto(); });
    if(next) next.addEventListener('click',()=>{ stopAuto(); step(+1); startAuto(); });
  })();

  // Blog teaser dummy
  (function(){
    const grid=qs('#blogGrid'); if(!grid) return;
    const posts=[
      {title:'Kısırlaştırma Sonrası Bakım Rehberi', img:'assets/img/uploads/og-cover.jpg', text:'Evde bakım, dikiş kontrolü ve beslenme ipuçları.'},
      {title:'Kedilerde Ağız ve Diş Sağlığı', img:'assets/img/uploads/og-cover.jpg', text:'Diş taşı, periodontitis ve düzenli bakım önerileri.'},
      {title:'Acil Durumda Yapılacaklar', img:'assets/img/uploads/og-cover.jpg', text:'Zehirlenme, travma ve solunum sıkıntısında ilk adımlar.'}
    ];
    grid.innerHTML=posts.map(p=>\`
      <article class="blog-card">
        <div class="thumb"><img loading="lazy" decoding="async" src="\${p.img}" alt=""></div>
        <div class="body"><h3>\${p.title}</h3><p>\${p.text}</p></div>
      </article>\`).join('');
  })();
  </script>
</body>
</html>
