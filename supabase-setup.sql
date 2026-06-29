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

-- =====================================================
-- ADMIN: cho phép admin đọc & xoá TẤT CẢ reports
-- Chạy thêm đoạn này trong SQL Editor:
-- =====================================================
create policy "admin_select_all" on public.reports
  for select using (auth.jwt()->>'email' = 'lbph.work@gmail.com');
create policy "admin_delete_all" on public.reports
  for delete using (auth.jwt()->>'email' = 'lbph.work@gmail.com');

-- View để admin lấy danh sách user + số report (chạy dưới quyền service_role)
create or replace view public.admin_users as
  select
    u.id,
    u.email,
    u.created_at as registered_at,
    u.last_sign_in_at,
    coalesce(r.cnt, 0) as report_count
  from auth.users u
  left join (select user_id, count(*) as cnt from public.reports group by user_id) r
    on r.user_id = u.id
  order by u.created_at desc;

-- Bảo vệ view: chỉ admin mới select được
alter view public.admin_users owner to postgres;
grant select on public.admin_users to authenticated;

-- RLS không áp dụng cho view, nên ta dùng function thay thế:
create or replace function public.get_admin_users()
returns table(id uuid, email text, registered_at timestamptz, last_sign_in_at timestamptz, report_count bigint)
language plpgsql security definer as $$
begin
  if (select auth.jwt()->>'email') != 'lbph.work@gmail.com' then
    raise exception 'Unauthorized';
  end if;
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at,
           coalesce((select count(*) from public.reports r where r.user_id = u.id), 0)
    from auth.users u
    order by u.created_at desc;
end;
$$;

-- Function lấy tất cả reports (admin only)
create or replace function public.get_admin_reports(p_user_id uuid default null)
returns table(id uuid, user_email text, project_name text, self_domain text, created_at timestamptz)
language plpgsql security definer as $$
begin
  if (select auth.jwt()->>'email') != 'lbph.work@gmail.com' then
    raise exception 'Unauthorized';
  end if;
  return query
    select r.id, u.email::text, r.project_name, r.self_domain, r.created_at
    from public.reports r
    join auth.users u on u.id = r.user_id
    where (p_user_id is null or r.user_id = p_user_id)
    order by r.created_at desc;
end;
$$;
