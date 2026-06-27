# Hướng dẫn Deploy SEO Report Studio (Supabase + Vercel)

Mọi thứ **free**, chỉ trả tiền **Claude API** theo lượt tạo.

Thành phần:
- `index.html` — giao diện (đăng nhập, tạo & lưu báo cáo, chọn model).
- `config.js` — cấu hình Supabase (URL + anon key công khai).
- `api/analyze.js` — gọi Claude (giấu API key).
- `api/models.js` — lấy danh sách model realtime từ Anthropic.
- `supabase-setup.sql` — tạo bảng database.

---

## PHẦN 1 — Supabase (đăng nhập + database) 🆓
1. Tạo tài khoản tại https://supabase.com → **New Project** (đặt tên, chọn region gần VN như Singapore, đặt mật khẩu DB).
2. Vào **SQL Editor → New query** → mở file `supabase-setup.sql`, dán toàn bộ vào → **Run**. (Tạo bảng `reports` + bảo mật.)
3. *(Tùy chọn cho nhanh khi test)* **Authentication → Providers → Email** → tắt **"Confirm email"** để đăng ký xong đăng nhập được ngay, không cần mở email.
4. Vào **Project Settings → API**, copy 2 giá trị:
   - **Project URL** (vd `https://abcd.supabase.co`)
   - **anon public** key (chuỗi `eyJ...`)
5. Mở file `config.js`, điền vào:
   ```js
   window.SUPA_URL  = "https://abcd.supabase.co";
   window.SUPA_ANON = "eyJ...";
   ```
   (anon key này CÔNG KHAI được — đã có bảo mật Row-Level Security.)

## PHẦN 2 — Claude API key 💰
1. https://console.anthropic.com → **API Keys** → **Create Key** → copy `sk-ant-...`.
2. Vào **Billing** nạp ít credit.

## PHẦN 3 — Vercel (link public) 🆓
1. Tạo tài khoản https://vercel.com.
2. **Add New → Project** → đưa code lên (xem 2 cách bên dưới) → Framework Preset **Other** → **Deploy**.
3. **Settings → Environment Variables**, thêm:
   | Name | Value |
   |------|-------|
   | `ANTHROPIC_API_KEY` | `sk-ant-...` |
   | `CLAUDE_MODEL` *(tùy chọn)* | model mặc định, vd `claude-haiku-4-5` |
4. **Deployments → Redeploy** để áp env var.

### Đưa code lên Vercel — chọn 1 trong 2
- **Cách A — GitHub:** import repo vào Vercel; mỗi lần sửa, push là tự deploy.
- **Cách B — không GitHub (Vercel CLI):**
  ```bash
  npm i -g vercel
  cd /Users/phug/Documents/Claude
  vercel        # lần đầu: đăng nhập + làm theo prompt
  vercel --prod # deploy bản chính thức
  ```

---

## Dùng
- Mở link Vercel → **đăng ký/đăng nhập** → tạo báo cáo → đặt **tên Project** → **💾 Lưu vào tài khoản**.
- **📂 Báo cáo đã lưu**: xem lại / mở / xóa các report cũ.
- **Model Claude**: dropdown tự nạp realtime từ Anthropic.

## Lưu ý chi phí
- Supabase + Vercel: free tier dư dùng.
- Claude API: chỉ tốn khi tích "Dùng Claude". Haiku rẻ nhất.
- Domain riêng (tùy chọn): Vercel → Settings → Domains (~250–350k₫/năm).

## Bảo mật
- `ANTHROPIC_API_KEY`: chỉ ở Vercel env, KHÔNG trong code.
- Supabase `anon key`: công khai an toàn (RLS bảo vệ — user này không xem được report user kia).
