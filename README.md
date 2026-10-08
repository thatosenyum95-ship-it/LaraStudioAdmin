# LaraStudioAdmin

Admin privat terpisah untuk **Lara Studio** — bukan route `/admin` di website publik.

## Fungsi saat ini
- Login Supabase
- Dashboard statistik
- Daftar, tambah, edit, dan hapus aplikasi
- Draft / Published / Archived
- Status Official
- Upload icon ke Supabase Storage
- Kelola fitur aplikasi
- Daftar release
- Publish gate: aplikasi harus verified sebelum dipublikasikan

## Backend
Menggunakan project Supabase Lara Studio: `atswttlqjycruzxuohfw`.

Buat environment lokal dari `.env.example` dan isi publishable key Supabase. **Jangan pernah memasukkan service_role key ke frontend.**

## Admin authorization
Akun Supabase harus memiliki metadata server-side:
```json
{ "is_admin": true }
```
di `auth.users.raw_app_meta_data` / `app_metadata`.

RLS database dan Storage tetap menjadi lapisan keamanan utama.

## Storage
Bucket publik:
- `lara-app-media` — icon, screenshot, banner, video
- `lara-apks` — file APK untuk distribusi publik

Upload/write tetap dibatasi ke admin melalui Storage RLS.

## Jalankan
```bash
npm install
npm run dev
npm run build
```

## Deploy
Repository ini sengaja terpisah dari repository Lara Studio publik. Deploy ke project Vercel terpisah bernama **lara-studio-admin**.
