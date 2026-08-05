# Elçi Finans V5.12 kurulum sırası

## 1. Veritabanı

D1 migration dosyalarını sırayla uygulayın. `0005_finance_audit.sql` zorunludur. Bu tablo yoksa finans API'si güvenlik gereği hiçbir yazma işlemi başlatmaz.

## 2. Finans uygulaması ortam değişkenleri

- `FINANCE_ACCESS_SHARED_SECRET`: En az 32 karakterlik rastgele gizli değer.
- `FINANCE_SESSION_HOURS`: İsteğe bağlı; 0,25–8 saat, varsayılan 4.
- `FINANCE_LOGIN_URL`: Ana sitenin `/finans/` adresi.

## 3. Ana Netlify sitesi ortam değişkenleri

- `FINANCE_APP_URL`: Finans uygulamasının HTTPS adresi.
- `FINANCE_EDITOR_EMAILS`: Kayıt okuyup değiştirebilecek e-postalar.
- `FINANCE_VIEWER_EMAILS`: Yalnız okuyabilecek e-postalar.
- `FINANCE_ACCESS_SHARED_SECRET`: Finans uygulamasındaki değerle birebir aynı olmalı.
- `ADMIN_EMAILS`: İçerik yedeklerine erişebilecek yönetici e-postaları.

Listeler boşsa sistem kendiliğinden herkese izin vermez. Yetkisiz erişim kapalı kalır.

## 4. Doğrulama

Ana kaynakta:

```bash
npm run verify
```

Finans kaynağında:

```bash
npm run test:core
npm run build
node --test tests/rendered-html.test.mjs
```

Tam finans build'i bağımlılıklar kurulmadan çalışmaz. Build başarılı olmadan gerçek finans verisi girmeyin.
