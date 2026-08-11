# Elçi Finans V8.1 — Cloudflare Build Hotfix

Bu paket, Cloudflare derlemesinde görülen `MISSING_EXPORT` hatasını gidermek için hazırlanmıştır.

## Sorun
`app/api/clinic-data/route.ts` V8.1 tablolarını içe aktarıyor; GitHub'daki `db/schema.ts`
ise eski sürümde kaldığı için aşağıdaki yeni şema tanımlarını dışa aktarmıyordu.

Hotfix içindeki `db/schema.ts`, yüklenen doğrulanmış V8.1 kaynak paketinden alınmıştır.
Ayrıca eşleşen `drizzle/0006_finance_core.sql` migration dosyası da pakete eklenmiştir.

## Kurulum
Bu ZIP'in içeriğini şu klasörün üzerine kopyalayın:

integrated-systems/finance-source/

Windows dosya değiştirme sorusu sorarsa **Hedefteki dosyaları değiştir** seçeneğini kullanın.

Sonuçta:
- integrated-systems/finance-source/db/schema.ts
- integrated-systems/finance-source/drizzle/0006_finance_core.sql

dosyaları bu paketteki sürümler olmalıdır.

Ardından GitHub Desktop'ta değişikliği commit edip push edin. Cloudflare yeni build başlatacaktır.

## Önemli
Build başarılı olsa bile gerçek D1 veritabanında `0006_finance_core.sql` migration'ının uygulanmış
olması gerekir. Migration uygulanmadan yeni tabloları kullanan ekranlar çalışma zamanında hata verebilir.

## SHA-256
db/schema.ts
663d9f0a7e6301f238f0495ff00f8ea65ba36e439e3bfa6558747178e83b5b39

drizzle/0006_finance_core.sql
fb6ae57d198807deba3a4aeab04516d542fee3129cba7aa5689662395688c826
