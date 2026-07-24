# Kurulum ve Güvenlik Rehberi

## 1. GitHub’a yükleme

1. Eski deponun ZIP yedeğini alın.
2. Bu paketin içindeki dosyaları deponun köküne yükleyin.
3. Aynı isimli dosyalarda üzerine yazmayı kabul edin.
4. Eski depoda bu pakette bulunmayan deneme dosyaları varsa ayrıca silin; özellikle eski admin, eski build ve kullanılmayan veri kopyalarını bırakmayın.
5. `node_modules` klasörünü GitHub’a yüklemeyin.

## 2. Netlify build ayarı

Paketin `netlify.toml` dosyası şunları otomatik tanımlar:

- Build komutu: `npm run build`
- Yayın klasörü: `dist`
- Functions klasörü: `netlify/functions`
- Node sürümü: 22

GitHub commit işleminden sonra Netlify deploy tamamlanmalıdır. Deploy başarısız olursa ilk bakılacak yer Netlify build logudur.

## 3. Yönetim paneli giriş ayarı

Netlify Identity ve Git Gateway etkin olmalıdır.

- Kayıt yöntemi: yalnızca davet
- Yönetici hesabı: kliniğin kullandığı güvenli e-posta
- Güçlü ve benzersiz parola
- Hesapta mümkün olan ek güvenlik seçenekleri etkin

Netlify ortam değişkeni:

```text
ADMIN_EMAILS=yonetici1@ornek.com,yonetici2@ornek.com
```

Bu listede olmayan hesaplar randevu kayıtlarını göremez. Birden fazla e-posta virgülle ayrılır.

## 4. Randevu formu ve e-posta bildirimi

Randevu formu gönderildiğinde kayıt özel randevu deposuna aktarılır ve yönetim panelinde görünür. E-posta bildirimi için aşağıdaki değişkenler eklenebilir:

```text
RESEND_API_KEY=...
APPOINTMENT_EMAIL_TO=elcivetklinik@gmail.com
APPOINTMENT_EMAIL_FROM=Elçi Randevu <randevu@dogrulanmisalanadiniz.com>
```

`APPOINTMENT_EMAIL_FROM` için e-posta hizmetinde doğrulanmış bir gönderen alan adı kullanılmalıdır. Bildirim e-postası kişisel iletişim ayrıntılarını taşımak yerine tarih, hizmet ve güvenli panel bağlantısını bildirir. Asıl kayıt panelde açılır.

Alternatif olarak Netlify Forms e-posta bildirimi kullanılabilir; iki yöntem aynı anda etkinleştirilirse çift bildirim gelebilir.

## 5. İleri tarihli yayın ve otomatik yayından kaldırma

Blog ve duyurular panelde şu şekilde yönetilir:

- `Yayında mı?`: içeriğin açık/kapalı durumu
- `Yayın tarihi`: şimdi veya ileri tarih
- `Otomatik yayından kaldırma`: istenirse bitiş tarihi

İçerik tarayıcıda doğru zamanda görünür veya kaybolur. Arama motorlarının da güncel sayfayı alması için Netlify’da bir Build Hook oluşturun ve adresini şu değişkene ekleyin:

```text
NETLIFY_BUILD_HOOK_URL=https://api.netlify.com/build_hooks/...
```

Zamanlanmış kontrol yalnızca içerik geçiş zamanı geldiğinde yeni build başlatır.

## 6. Randevu saklama süresi

Saklama ve imha politikanız hukukçu/KVKK uzmanı ile netleştirildikten sonra gün sayısı belirlenebilir:

```text
APPOINTMENT_RETENTION_DAYS=...
```

- Değer girilmez veya `0` bırakılırsa otomatik silme çalışmaz.
- Süre girilirse yalnızca `tamamlandı`, `iptal` veya `arşiv` durumundaki eski kayıtlar günlük kontrolde silinir.
- Aktif randevular otomatik silinmez.

## 7. KVKK açısından teknik kurallar

- Randevu ve ileride hasta verileri `assets/data` içine konulmamalıdır.
- Kişisel veri GitHub commitlerine, blog yazılarına veya herkese açık görsellere eklenmemelidir.
- Yönetim hesabı ortak ve zayıf parola ile kullanılmamalıdır.
- Ayrılan personelin erişimi aynı gün kaldırılmalıdır.
- CSV dışa aktarımları yalnızca yetkili cihazda tutulmalı, gereksiz kopyalar silinmelidir.
- Saklama süresi, aydınlatma metni, açık rıza gerekip gerekmediği, veri işleyen hizmetler ve imha prosedürü profesyonel hukuki incelemeden geçirilmelidir.
- Randevu paneli ileride hasta takip sistemine genişletilirken rol bazlı erişim, işlem kaydı, yedekleme, veri düzeltme/silme talepleri ve özel nitelikli veri güvenliği ayrıca tasarlanmalıdır.

## 8. Yayına almadan önce zorunlu kontrol

- `/admin/` giriş yapıyor mu?
- Yeni blog yazısı hemen yayınlanıyor mu?
- İleri tarihli yazı vaktinden önce gizli mi?
- `Yayında mı?` kapatılan yazı siteden kalkıyor mu?
- Ana sayfada en fazla üç blog ve altı SSS görünüyor mu?
- Hizmet değişikliği hem ana sayfada hem hizmetler sayfasında güncelleniyor mu?
- Duyuru ana sayfada doğru tarih aralığında görünüyor mu?
- Deneme randevusu panelde ve e-postada görünüyor mu?
- Telefon, e-posta, adres ve çalışma saatleri doğru mu?
- Mobil menü, telefon, yol tarifi ve randevu butonları çalışıyor mu?
