# Elçi Klinik Finans Yönetimi

Veteriner kliniğinin gelir-gider, alacak-borç, POS, temel stok, aylık kapanış ve yönetim tahminlerini izleyen ayrı finans uygulamasıdır.

## Güvenlik modeli

- Uygulamaya doğrudan kullanıcı başlığıyla giriş kabul edilmez.
- Giriş, ana Netlify yönetim sitesinin ürettiği 60 saniyelik HMAC imzalı bağlantıyla başlar.
- Finans uygulaması bu bağlantıyı doğrulayıp HttpOnly, Secure, `__Host-` önekli oturum çerezi üretir.
- Görüntüleyici ve düzenleyici rolleri sunucu tarafında ayrılır.
- Finans API'sindeki her yazma isteği için kullanıcı, rol, işlem, varlık, istek kimliği ve zaman içeren denetim kaydı oluşturulur.
- Denetim tablosu kurulmamışsa yazma işlemleri başlamadan engellenir.

## Kurulum özeti

1. D1 veritabanı migration dosyalarını `0000`–`0005` sırasıyla uygulayın.
2. Finans ortamına `FINANCE_ACCESS_SHARED_SECRET` tanımlayın.
3. Aynı gizli değeri ana Netlify sitesine de tanımlayın.
4. Netlify tarafında `FINANCE_APP_URL`, `FINANCE_EDITOR_EMAILS` ve gerekiyorsa `FINANCE_VIEWER_EMAILS` girin.
5. `npm run test:core` ile finans test raporunu üretin.
6. `npm run build` ile üretim paketini oluşturun.
7. `npm run test` ile çekirdek testler, build ve render kontrolünü birlikte çalıştırın.

## Önemli sınırlar

Bu uygulama yönetim desteğidir; resmî muhasebe defteri, vergi beyannamesi, mali müşavir görüşü veya kredi onayı değildir. POS tarihleri resmî tatilleri otomatik bilmez. Stok modülü toplam stok ve temel lot/SKT takibi yapar; çoklu lot FEFO sistemi değildir.
