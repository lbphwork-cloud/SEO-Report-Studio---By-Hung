-- Chạy 1 lần trong Supabase → SQL Editor → New query → Run.
-- Tạo bảng lưu report + bật bảo mật để mỗi user chỉ thấy report của mình.

create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_name text not null,
  self_domain  text,
  html         text,
  created_at   timestamptz not null default now()
);

alter table public.reports enable row level security;

-- Mỗi user chỉ đọc/ghi/xóa report của chính mình
create policy "reports_select_own" on public.reports
  for select using (auth.uid() = user_id);
create policy "reports_insert_own" on public.reports
  for insert with check (auth.uid() = user_id);
create policy "reports_delete_own" on public.reports
  for delete using (auth.uid() = user_id);
