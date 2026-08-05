# Elçi V5.13 — Tek Fiş, Çok Kalem Hızlı Giriş

## Eklenenler

- Market/tedarikçi, belge numarası ve ödeme biçimi bir kez girilir.
- 1–50 gider satırı aynı fişte topluca ve tek sunucu işleminde kaydedilir.
- Satır bazında farklı KDV oranı desteklenir.
- Her satır stokta takip edilebilir veya doğrudan gider olarak işlenebilir.
- Fiş toplamı ile satır toplamı isteğe bağlı karşılaştırılır; fark varsa kayıt engellenir.
- Aynı fiş numarası aynı fiş grubundaki satırlarda kullanılabilir; farklı bir kayıtta tekrar kullanılırsa mükerrer kayıt engeli devam eder.
- Tüm satırlar tek audit olayı altında receipt kimliğiyle izlenir.
- Sunucu 1–50 satır sınırı, ortak belge bilgisi ve stok hareketi bütünlüğünü doğrular.

## Hedef kullanım

Hazır ürün adları kullanıldığında 10 kalemlik fişin yaklaşık 60–90 saniyede girilmesi hedeflenmiştir. İlk kez yazılan ürünlerde süre ürün adlarının uzunluğuna göre artabilir.

## Değişmeyen sınırlar

- Banka/POS hareketleri otomatik içe aktarılmaz.
- OCR ile fiş okuma yoktur.
- Çoklu lot/FEFO stok yönetimi bu sürümün kapsamı değildir.
