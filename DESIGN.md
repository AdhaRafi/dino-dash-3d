# Design Direction: Dino Dash 3D

## 1. Identitas & Karakter
- **Produk**: Dino Dash 3D, game endless runner 3D di browser.
- **Karakter Visual**: Aset 3D T-Rex Ijo (low-poly blocky T-Rex dengan rahang bergerak, ekor 6 segmen bertahap, mata tegas, dan flat shading).
- **Suasana**: Siang hari di padang gurun pasir keemasan hangat dengan kaktus berduri, burung pterodactyl mengepakkan sayap, dan bebatuan bernuansa alami.

## 2. Antislop Dials
- **ENERGY**: 2 (Balanced: game UI yang bersih, responsif, dan interaktif tanpa elemen dekorasi berlebihan).
- **RHYTHM**: 2 (Konsisten: struktur HUD, modal jeda, dan layar game over tertata rapi dan mudah dibaca sekilas).
- **MOTION**: 3 (Tinggi pada simulasi 3D 60 FPS: ayunan lari kaki, rahang mengunyah, kepakan sayap burung, dan bayangan kontak dinamis).

## 3. Palet Warna (Berdasarkan Aset 3D T-Rex Ijo)
- **Primary (T-Rex Ijo)**: Olive Sage Green (`#6B8F64`), Dark Pine (`#4F6B4B`), Soft Mint (`#93B08A`).
- **Alternatif Kulit**: Desert Cokelat (`#8A6A3F`), Deep Umber (`#5E4528`), Sand Gold (`#C9A877`).
- **Tanah & Gurun Pasir**: Warm Golden Sand (`#D9B574`), Ripple Marks (`#B8955A`).
- **Rintangan**: Kaktus Hijau (`#4F8F3C`) dengan Duri (`#F3ECC0`), Burung Pterodactyl (`#8A7766` / `#F0A030`), Batuan Gurun (`#6B5A4C` / `#7D6A58`).
- **Langit & Kabut**: Horizon Fog (`#E4D2A8`), Warm Sky Gradient (`#F6E7C6` ke `#EAC98F`).
- **Text & Contrast**: Deep Charcoal (`#1A201C`) dengan rasio kontras > 7:1 di atas latar terang.
- **Surface / Card**: Warm Cream White (`#FAF8F5`) dengan border tegas Warm Sand (`#DBC59C`).

## 4. Tipografi
- **Font Stack**: `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`.
- **Angka Skor**: `font-variant-numeric: tabular-nums` agar skor tidak bergoyang saat bertambah.
- **Hierarki**:
  - Judul Layar: 28px - 36px, Bold.
  - Skor Utama: 22px - 26px, Bold.
  - Tombol Aksi: 18px - 20px, Semi-bold.
  - Teks Petunjuk: 13px - 15px, Regular.

## 5. Aksesibilitas & Kontrol
- **Kontras WCAG AA**: Semua teks memenuhi rasio kontras minimal 4.5:1.
- **Focus Indicator**: Indikator fokus keyboard `outline: 3px solid #E76F51` dengan offset 2px.
- **Target Sentuh Mobile**: Tombol lompat mobile 80px x 80px (melebihi batas minimal 44px).
- **Motion Reduction**: Tombol pengaturan untuk menonaktifkan getaran layar (screen shake).
- **Audio Sensitivity**: Tombol toggle suara (Mute) yang mudah diakses dari layar awal maupun HUD saat bermain.
