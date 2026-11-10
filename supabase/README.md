# Kết nối Supabase

Ứng dụng có đăng ký/đăng nhập email + mật khẩu và sao lưu/khôi phục thủ công tại Cài đặt → Tài khoản & lưu trữ Supabase. Khi chưa cấu hình, ứng dụng tiếp tục hoạt động offline bằng IndexedDB.

## 1. Cấu hình project và bảng

Tạo project Supabase. Trong Dashboard → SQL Editor, chạy toàn bộ file `supabase/migrations/001_vocab_snapshots.sql` một lần. File này tạo bảng `vocab_snapshots`, RLS theo `auth.uid()` và RPC lưu có kiểm tra phiên bản/ID người dùng để chống ghi đè nhầm hoặc ghi đè dữ liệu mới hơn.

Đây là mô hình một bản snapshot JSON cho mỗi tài khoản, gồm folders, templates, notes, reviews, reviewLogs và preferences. Không phải cơ chế đồng bộ từng dòng theo thời gian thực.

## 2. Điền .env ở thư mục gốc

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Hỗ trợ legacy `VITE_SUPABASE_ANON_KEY` nếu chưa có publishable key. Chỉ dùng publishable/anon key cho frontend. Không dùng secret key, service_role hoặc Gemini key ở file này. Gemini tiếp tục đặt riêng trong server/.env.

Các giá trị VITE_* được đưa vào bundle trình duyệt; publishable key được thiết kế để công khai, việc bảo vệ dữ liệu nằm ở Auth + RLS. Client từ chối secret/service_role key. File .env đã nằm trong .gitignore.

Trong Supabase Authentication → URL Configuration, đặt Site URL theo môi trường chạy (ví dụ http://localhost:5173) và thêm URL redirect /settings tương ứng; nếu chạy bản build ở http://127.0.0.1:4100 cũng thêm origin/redirect đó. Bật Email provider. Nếu project yêu cầu xác nhận email, người dùng phải xác nhận trước khi đăng nhập.

## 3. Khởi động

```powershell
npm.cmd run dev
```

Sau khi sửa VITE_* cần khởi động lại frontend; với bản production cần build lại. Backend local phục vụ bản build có CSP cho phép kết nối HTTPS/WSS tới *.supabase.co; custom Supabase domain cần bổ sung vào connectSrc trong server/app.mjs.

## 4. Sử dụng

- Cài đặt → đăng ký/đăng nhập.
- Thiết bị đầu tiên: chọn Sao lưu lên cloud để tạo bản đầu tiên.
- Thiết bị mới: đăng nhập cùng tài khoản và chọn Tải cloud về máy.
- Học xong hoặc thêm từ: bấm Sao lưu lên cloud để cập nhật. Chưa có auto-sync nền.
- Nếu thiết bị khác cập nhật cloud, RPC từ chối bản ghi cũ. Tải bản cloud mới về trước, hoặc xuất local JSON để giữ công việc hiện tại. Không tự merge các chỉnh sửa xung đột.
- Khi tải về, dữ liệu local được thay bằng snapshot cloud. Trước khi thay, giữ backup local trong IndexedDB (tối đa 3 bản) và cho khôi phục bản trước đó hoặc xuất JSON. Tài khoản sở hữu bản local cũng được giữ lại để chặn upload nhầm sang tài khoản khác.
- Ngày due/last_review và timestamp trong review logs được chuyển lại thành Date khi restore; ID thẻ và lịch FSRS giữ nguyên.
- Đăng xuất không xóa dữ liệu local. Khi chuyển tài khoản, không thể upload dữ liệu thuộc tài khoản cũ; cần tải dữ liệu tài khoản mới về trước.

Snapshot tối đa 20 MB. Cần quản lý quota Supabase và giữ bản JSON riêng nếu có dữ liệu quan trọng. Chưa có xác minh live nếu chưa điền project URL/key và chạy SQL.

## Kiểm tra

```powershell
npm.cmd run build
npm.cmd run test:server
```

Tests kiểm tra dữ liệu snapshot, key public/secret, phiên bản/chủ sở hữu local, rollback transaction, bản backup và ngày giờ FSRS bằng IndexedDB giả lập. Không gọi project Supabase thật hoặc xác minh RLS trên cloud; cần chạy SQL và thử bằng tài khoản thật sau khi cấu hình.

## Đăng nhập bằng Google

1. Trong Supabase Dashboard → Authentication → Sign In / Providers → Google, lấy callback URL của project (thường là `https://<project-ref>.supabase.co/auth/v1/callback`).
2. Trong [Google Cloud Console](https://console.cloud.google.com/apis/credentials), cấu hình OAuth consent screen rồi tạo OAuth Client ID loại **Web application**. Nếu ứng dụng đang ở chế độ Testing, thêm email của bạn vào Test users.
3. Authorized JavaScript origins: thêm origin đang dùng, ví dụ `http://localhost:5173`. Authorized redirect URIs: thêm **callback URL Supabase ở bước 1**, không phải URL `/settings` của ứng dụng.
4. Copy Client ID và Client Secret vào Google provider trong Supabase, bật provider và lưu. Không đặt Google Client Secret trong frontend hoặc biến `VITE_*`.
5. Supabase → Authentication → URL Configuration: thêm `http://localhost:5173/settings` vào Redirect URLs. Nếu truy cập bằng `127.0.0.1` hoặc domain production, thêm URL `/settings` tương ứng chính xác. Site URL đặt theo domain ứng dụng.
6. Điền hai biến Supabase trong `.env` như hướng dẫn trên và khởi động lại frontend. Mở Cài đặt → Đăng nhập bằng Google → chọn tài khoản. Ứng dụng dùng PKCE và quay về `/settings`, giữ phiên đăng nhập sau khi tải lại trang.

Đăng nhập chỉ xác thực tài khoản; chọn Sao lưu lên cloud hoặc Tải cloud về máy để chuyển dữ liệu. Không cần thêm Google API key vào `.env`. Chưa kiểm thử OAuth thực tế khi project/provider chưa được cấu hình.

Tài liệu: [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Trang chủ và quyền truy cập

Trang `/` là trang giới thiệu công khai. Bộ thẻ chuyển sang `/folders`; `/folders`, `/review`, `/add` và `/settings` yêu cầu phiên đăng nhập Supabase. Chưa đăng nhập sẽ được chuyển về trang chủ. Popup thêm từ và nhắc ôn chỉ được mount trong khu vực đã đăng nhập.

Google OAuth hiện chuyển về `/folders` sau đăng nhập: thêm `http://localhost:5173/folders` (hoặc origin thực tế + `/folders`) vào Supabase Authentication → URL Configuration → Redirect URLs. Giữ `/settings` trong danh sách nếu dùng xác nhận đăng ký email. Cấu hình redirect `/folders` này thay cho `/settings` trong bước Google OAuth ở trên.

Đây là chặn truy cập giao diện. Dữ liệu local vẫn nằm trong IndexedDB của trình duyệt; dữ liệu cloud được bảo vệ bằng Supabase Auth và RLS. Đăng xuất giữ dữ liệu local theo cơ chế sao lưu hiện có.

## Tách dữ liệu theo tài khoản

Mỗi `auth.users.id` có database IndexedDB riêng (`vocab-library-account-<user_id>`) và khóa cài đặt riêng. Folders, templates, notes, reviews, reviewLogs, cloudMeta và localBackups đều được tách theo tài khoản. Khu vực học chỉ mở sau khi hoàn tất chuẩn bị kho. Đăng xuất/đổi tài khoản tải lại trang để các tác vụ đang chạy không chuyển sang database của tài khoản khác; các tab nhận thay đổi phiên Supabase cũng áp dụng cơ chế này.

Lần mở đầu tiên của một kho local trống, ứng dụng tìm snapshot cloud theo user_id rồi khôi phục tự động nếu có. Nếu đọc cloud lỗi, hiển thị Thử lại, giữ nguyên dữ liệu. Những kho đã có dữ liệu local không bị ghi đè tự động; tiếp tục dùng các nút Sao lưu lên cloud / Tải cloud về máy trong Cài đặt. Chưa có tự động sao lưu mỗi lần sửa dữ liệu.

Nâng cấp từ database dùng chung `vocab-library`: chỉ chuyển tự động khi cloudMeta ghi nhận đúng user_id và kho mới chưa có dữ liệu. Chỉ chuyển các backup có cùng chủ sở hữu. Database cũ luôn được giữ lại. Dữ liệu cũ chưa xác định chủ không được tự gán cho tài khoản đầu tiên đăng nhập; cần quy trình nhập thủ công riêng nếu muốn sử dụng lại. Hành vi này thay thế mô tả dữ liệu local dùng chung ở phần trước.

Kiểm tra tự động dùng IndexedDB giả lập: tách tài khoản, giữ dữ liệu khi mở lại, migration theo chủ sở hữu, cài đặt riêng, chặn đổi database trong cùng document, tải cloud lần đầu/thử lại và không ghi đè chỉnh sửa local. Cần kiểm thử đăng nhập Google thực tế sau khi cấu hình project.

## Tự động đồng bộ cài đặt tài khoản

Chạy thêm toàn bộ `supabase/migrations/002_user_preferences.sql` trong Supabase SQL Editor. Migration tạo bảng `user_preferences`, RLS riêng từng `auth.uid()` và hàm `save_user_preferences(uuid,jsonb)` kiểm tra đúng user_id trước khi lưu.

Ba tùy chọn trong Cài đặt (bật nhắc ôn, số phút nhắc, tự phát âm) được tải từ Supabase khi mở kho và tự lưu sau thay đổi khoảng 500 ms. Trang Cài đặt hiển thị trạng thái tải/lưu/đã đồng bộ và nút Thử lại nếu lỗi. Mất mạng giữ thay đổi chưa gửi trong localStorage riêng theo tài khoản; thử lại khi có mạng, quay lại tab hoặc mở lại kho. Nếu sửa trong lúc request đang chạy, giữ thay đổi mới rồi gửi tiếp.

RPC chỉ hợp nhất các trường đã sửa để không ghi đè tùy chọn khác vừa được cập nhật từ thiết bị khác. Nếu cùng sửa một trường, lần ghi sau trên server thắng. Đây không phải Realtime: thiết bị khác nhận giá trị mới khi mở kho, quay lại tab hoặc bấm Thử lại.

Snapshot từ vựng vẫn chứa preferences để giữ khả năng xuất/khôi phục. Khi mới mở kho, bảng user_preferences là nguồn ưu tiên sau bước khôi phục snapshot. Nếu người dùng chủ động tải snapshot/khôi phục local, các preferences trong snapshot được áp dụng và đồng bộ như một thay đổi cài đặt. Folder/thẻ/lịch ôn vẫn sao lưu thủ công như trước; tùy chọn đảo mặt riêng từng folder đi cùng dữ liệu folder.

Kiểm tra tự động giả lập load/save/debounce/offline/retry, cập nhật trong lúc request chạy và tách hàng đợi theo tài khoản. Chưa xác minh bảng/RLS trên project thật khi migration chưa được chạy.
