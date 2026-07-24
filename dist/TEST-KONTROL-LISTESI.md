# Test ve Yayın Kontrol Listesi

## Otomatik kontroller

Bu paket üzerinde aşağıdaki kontroller uygulanmıştır:

- `npm run build`
- JavaScript ve Netlify function sözdizimi
- JSON veri dosyalarının ayrıştırılması
- Admin YAML yapılandırmasının ayrıştırılması
- CSS ayrıştırma hataları
- HTML başlıkları, tek H1 kullanımı ve yerel dosya bağlantıları
- Sayfa içi JavaScript sözdizimi
- JSON-LD yapılandırılmış veri ayrıştırması
- Kategori sayısı ve 100 etiket kontrolü

## Canlı Netlify ortamında yapılacak kabul testi

### Yönetim

- [ ] Davetli yönetici hesabı giriş yapıyor.
- [ ] Yetkisiz hesap randevu ekranını açamıyor.
- [ ] Yeni blog yazısı kaydedilip deploy sonrası görünüyor.
- [ ] İleri tarihli yazı vaktinden önce görünmüyor.
- [ ] `Yayında mı?` kapatılan yazı listeden ve ana sayfadan kalkıyor.
- [ ] Planlı duyuru doğru saatte görünüyor ve bitişte kayboluyor.
- [ ] Hizmet düzenlemesi iki sayfada da aynı görünüyor.
- [ ] Ana sayfa SSS seçimi altı sınırını aşmıyor.

### Randevu

- [ ] Form başarı mesajı gösteriyor.
- [ ] Kayıt randevu paneline düşüyor.
- [ ] Minimal e-posta bildirimi geliyor.
- [ ] Telefon bağlantısı doğru numarayı arıyor.
- [ ] Durum değişikliği ve klinik not kaydoluyor.
- [ ] İşlem geçmişi güncelleniyor.
- [ ] CSV dışa aktarım yalnızca giriş yapmış hesapta çalışıyor.
- [ ] Mobil randevu ekranı taşmıyor.

### Ziyaretçi deneyimi

- [ ] Masaüstü Chrome, Edge ve Safari’de ana sayfa kontrol edildi.
- [ ] Android ve iPhone genişliklerinde menü kontrol edildi.
- [ ] Blog araması, kategori ve sayfalama çalışıyor.
- [ ] Blog yazısı rahat okunuyor; görsel metni ezmiyor.
- [ ] Hakkımızda açılır içerikleri tek kaydırma alanında okunuyor.
- [ ] KVKK sayfası ayrı sayfada, çift kaydırma olmadan açılıyor.
- [ ] Telefon, randevu ve yol tarifi butonları çalışıyor.
- [ ] 404 ve eski adres yönlendirmeleri çalışıyor.

### Google ve ölçüm

- [ ] Alan adı canonical adreslerle aynı.
- [ ] `robots.txt` ve `sitemap.xml` açılıyor.
- [ ] Google Search Console’da site haritası gönderildi.
- [ ] Google İşletme Profili telefon, adres ve saatleri siteyle aynı.
- [ ] Yayına alınan hizmet sayfaları dizine eklenme için kontrol edildi.
- [ ] Arama, telefon, yol tarifi ve randevu dönüşümleri için kullanılacak ölçüm aracı KVKK/çerez tercihleriyle birlikte ayrıca yapılandırıldı.

## Bilinen yayın öncesi gereksinimler

- Netlify Identity/Git Gateway hesabı gerçek ortamda etkinleştirilmelidir.
- Ortam değişkenleri girilmelidir.
- Resend gönderen alan adı doğrulanmalıdır veya alternatif e-posta bildirimi seçilmelidir.
- Build Hook adresi eklenmelidir.
- KVKK metni, saklama-imha süresi ve veri işleyen hizmetler hukuki incelemeden geçirilmelidir.
