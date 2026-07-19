# Elçi Veteriner Kliniği — Yönetim Merkezi V3.1

Bu sürüm, sitenin eski güvenilir tek-JSON altyapısını özel ve sade bir yönetim paneliyle birleştirir.

- Yönetim paneli: `/admin/`
- İçerik verileri: `assets/data/*.json`
- Randevu kayıtları: Netlify Blobs (GitHub'a yazılmaz)
- İçerik kaydı: Netlify Identity + Git Gateway
- Yayın: GitHub değişikliğinden sonra Netlify otomatik deploy

Kurulum için `KURULUM-TEK-SEFER.txt`, kullanım için `PANEL-KULLANIMI.txt` dosyasına bakın.

## V3.1 düzeltmeleri

Önizleme tıklama kilidi, kırık ana site bağlantıları, SEO dosyaları, çalışma saatleri ve eksik 22. SSS düzeltilmiştir. `scripts/build-site.mjs` kaldırılmıştır.
