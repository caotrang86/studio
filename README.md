# CaoTrangAI — Static Site Clone

Bản sao tĩnh (static mirror) của website **https://caotrangai.com** — toàn bộ giao diện, hình ảnh, video, font và CSS được tải về local để chạy độc lập trên bất kỳ web server nào, không phụ thuộc vào server gốc.

A self-contained static clone of **https://caotrangai.com**. All HTML, CSS, images, videos and fonts are bundled locally so it runs on any static web server with no backend.

---

## Chạy thử nhanh / Quick start

Bất kỳ static web server nào cũng chạy được. Một vài cách:

### 1. Python (có sẵn trên hầu hết máy)
```bash
cd studio
python3 -m http.server 8000
# Mở trình duyệt: http://localhost:8000
```

### 2. Node.js
```bash
npx serve .
# hoặc
npx http-server -p 8000
```

### 3. PHP
```bash
php -S localhost:8000
```

Sau đó mở **http://localhost:8000** trong trình duyệt.

---

## Deploy lên server thật / Deploy to a real server

Đây là site tĩnh thuần (HTML/CSS/ảnh), nên chỉ cần trỏ web server vào thư mục này.

### Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /đường/dẫn/tới/studio;
    index index.html;

    # cho phép URL không có đuôi (vd /pricing -> /pricing/index.html)
    location / {
        try_files $uri $uri/ $uri/index.html =404;
    }
}
```

### Apache
Site đã có cấu trúc `route/index.html`, Apache phục vụ trực tiếp. Nếu cần, bật `mod_rewrite`.

### Hosting tĩnh (Netlify / Vercel / Cloudflare Pages / GitHub Pages)
Chỉ cần upload/trỏ tới thư mục gốc của repo này. Không cần build command, không cần framework.

---

## Cấu trúc / Structure

```
.
├── index.html              # Trang chủ
├── apps/                   # Trang AI Apps + chi tiết từng app
├── blog/                   # Bài viết blog
├── guide/                  # Hướng dẫn
├── pricing/                # Bảng giá
├── tools/, image/, video/, workflow/, ...   # Các trang khác
├── cdn/                    # Ảnh/video gốc từ CDN
├── _next/                  # CSS + font (đã loại bỏ JS app gốc)
└── _ext/                   # Ảnh từ các nguồn ngoài
```

Mỗi route là một thư mục chứa `index.html`, nên link nội bộ (vd `/pricing`, `/apps`) hoạt động đúng trên web server.

---

## Lưu ý quan trọng / Important notes

Đây là bản clone **giao diện (frontend-only)**:

- ✅ Toàn bộ các trang hiển thị **giống hệt** bản gốc: layout, ảnh, video, font, màu sắc, hiệu ứng CSS.
- ✅ Điều hướng giữa các trang (menu, link) hoạt động bình thường.
- ⚠️ Các tính năng cần **backend** của CaoTrangAI (đăng nhập, tạo ảnh/video AI, thanh toán, API) **không hoạt động** — vì chúng cần server và tài khoản gốc.
- ℹ️ Phần JavaScript ứng dụng gốc (Next.js) đã được loại bỏ để trang **chạy ổn định, không lỗi** khi không có backend. Vì vậy một số widget tương tác (accordion FAQ, tab, menu mobile) ở dạng tĩnh.

This is a **visual/frontend mirror**. Page navigation works; backend-dependent features (login, AI generation, payment, API) do not, since they require the original server.

---

*Nguồn / Source: https://caotrangai.com*
