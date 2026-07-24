# Değişiklik Özeti

## Tasarım sistemi

- Tüm ana sayfalarda ortak Manrope yazı sistemi oluşturuldu.
- Mor–turkuaz marka paleti, butonlar, kartlar, köşeler, gölgeler ve boşluklar standarda bağlandı.
- Header, logo ölçüsü, menü, aktif sayfa ve mobil menü tutarlı hâle getirildi.
- Hero bölümleri aynı tasarım diline getirildi; mevcut ana sayfa kimliği korundu.
- Hafif ve anlamlı hareketler kullanıldı; hareket azaltma tercihi desteklendi.
- Hakkımızda açılır penceresi ortak, okunabilir ve erişilebilir modal yapısına dönüştürüldü.
- KVKK metni dar ve çift kaydırmalı pencere yerine ayrı, okunabilir sayfaya çevrildi.

## Blog

- Blog yazıları artık rahatsız edici modal yerine kendine ait okunabilir sayfada açılır.
- Metin genişliği, başlık hiyerarşisi, satır aralığı, görsel oranı, ilgili içerikler ve randevu çağrısı düzenlendi.
- Arama, kategori, etiket ve sayfalama gerçek işlevli hâle getirildi.
- Sol kolon ve filtre araçları daha düzenli bilgi mimarisine bağlandı.
- Ana sayfada yalnızca en fazla üç seçili/yeni blog gösterilir.
- Hemen yayın, ileri tarih, otomatik kaldırma ve yayından kaldırma desteği eklendi.
- 12 ana kategori ve 100 kontrollü etiket hazırlandı.
- Eski düşük kaliteli kapaklar yerine marka uyumlu kapak görselleri oluşturuldu.

## Hizmetler ve SSS

- Ana sayfa ve hizmetler sayfası aynı `services.json` kaynağından beslenir.
- Öne çıkan hizmet sayısı sınırlıdır; diğer hizmetler kontrollü kaydırıcıda gösterilir.
- Egzotik hayvan hizmeti yayından kaldırılmıştır.
- SSS sayfası ve ana sayfa aynı içerik kaynağını kullanır.
- Ana sayfaya en fazla altı soru seçilir; tüm sorular ayrı SSS sayfasında kalır.

## Duyurular

- Yönetim panelinden başlangıç/bitiş tarihli duyuru oluşturma eklendi.
- Ana sayfa aktif duyuruları önceliğe göre gösterir ve yığılmaz.
- Bilgi, önemli ve acil görünüm seviyeleri vardır.

## Yönetim merkezi

- Teknik dosya ekranı yerine günlük iş akışını gösteren sade ana panel oluşturuldu.
- Yeni blog, duyuru, randevu, SSS, hizmet, yorum, başarı hikâyesi ve galeriye hızlı erişim eklendi.
- Başlıktan blog arayıp doğrudan düzenleme eklendi.
- Planlı, yayından kaldırılmış ve aktif içerik sayıları gösterilir.
- Panel telefon ekranına uyarlanmıştır.

## Randevu ve güvenlik

- Randevular açık JSON/GitHub yerine özel randevu deposuna yazılır.
- Yalnızca yetkili Identity hesabı veya `ADMIN_EMAILS` listesi erişebilir.
- Durum, klinik içi not, işlem geçmişi, arama ve filtreleme eklendi.
- Filtrelenen kayıtlar yetkili kullanıcı tarafından CSV olarak alınabilir.
- E-posta bildirimi kişisel iletişim ayrıntılarını taşımayan asgari içerikle hazırlanmıştır.
- Tamamlanan/iptal/arşiv kayıtlar için isteğe bağlı otomatik saklama süresi desteği eklendi.
- Yapı ileride hasta sahibi, hayvan, takip ve hatırlatma modüllerine ayrılabilecek şekilde randevu kaydı kimliği ve geçmişiyle oluşturuldu.

## SEO ve teknik kalite

- Blog yazı sayfaları, canonical adresler, meta veriler, yapılandırılmış veriler ve site haritası build sırasında üretilir.
- Yerel hizmet metinleri ve iç bağlantılar düzenlendi.
- Eski sayfa adresleri doğru sayfalara yönlendirilir.
- Görseller ve statik dosyalar için önbellek kuralları eklendi.
- Admin sayfaları arama motorlarından kapatıldı ve güvenlik başlıkları eklendi.
- 404 sayfası marka tasarımına uyarlandı.
