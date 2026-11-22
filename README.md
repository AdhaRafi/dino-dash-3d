# Dino Dash 3D

Game endless runner 3D berbasis web (desktop dan mobile) menggunakan Vite, TypeScript, dan Three.js.

## Prasyarat

- [Node.js](https://nodejs.org/) (disarankan versi LTS) dan npm
- Browser modern dengan dukungan **WebGL 2**

## Cara Menjalankan (Development)

1. Clone repository ini:
   ```bash
   git clone https://github.com/AdhaRafi/dino-dash-3d.git
   cd dino-dash-3d
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Jalankan dev server:
   ```bash
   npm run dev
   ```

4. Buka browser dan akses `http://localhost:3000`.

## Build Produksi

Untuk memeriksa tipe TypeScript dan membuat build produksi ke folder `dist/`:

```bash
npm run build
```

Untuk mencoba hasil build produksi secara lokal:

```bash
npm run preview
```

## Kontrol Bermain

- **Lompat:** `Space`, `Panah Atas`, atau `W` (Desktop), atau ketuk tombol **LOMPAT** / area layar (Mobile).
- **Jongkok / Merunduk:** Tahan `Panah Bawah` atau `S` (Desktop), atau tahan tombol **JONGKOK** (Mobile) untuk menghindari burung yang terbang setinggi kepala dan mempercepat turun saat di udara.
- **Ganti Kamera:** Tekan `C` atau tombol kamera di layar untuk berpindah antara **Kamera 3/4** dan **Kamera Samping**.
- **Jeda:** Tekan `Esc` atau tombol **Jeda**.

## Tech Stack

- Vite (`^5.4.10`)
- TypeScript (`^5.6.3`)
- Three.js (`^0.170.0`)
