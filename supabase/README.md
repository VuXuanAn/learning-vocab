# Supabase: đồng bộ từng dòng

Frontend dùng trực tiếp các bảng `folders`, `folder_members`, `notes`, `card_templates`, `user_card_progress`, `review_logs` và `user_preferences`. Không đọc/ghi snapshot.

## SQL cần chạy

Mở Supabase Dashboard → SQL Editor bằng role postgres:

1. `migrations/002_user_preferences.sql`: cài đặt cá nhân.
2. `migrations/003_shared_vocabulary.sql`: các bảng nội dung và RLS. **Bỏ qua nếu đã chạy thành công; không chạy lại để tránh lỗi bảng đã tồn tại.**
3. `migrations/005_row_sync.sql`: bổ sung timestamp cho log và RPC `save_card_review` lưu tiến độ + lịch sử trong cùng transaction. Có thể chạy lại file 005.
4. `migrations/006_fix_folder_insert_rls.sql`: vá policy đọc folder để INSERT RETURNING không bị lỗi 42501. Chạy cho project đã dùng bản 003 cũ; có thể chạy lại.
5. `migrations/004_remove_vocab_snapshots.sql`: xóa bảng/hàm snapshot cũ nếu còn. Không cần nhập dữ liệu cũ. Dữ liệu ở các bảng mới không bị xóa.
6. `operations/verify_shared_vocabulary.sql`: kiểm tra các bảng, RLS và RPC mới.

File 005 cần thiết cho đồng bộ lịch ôn; chỉ có 003 là chưa đủ. Nếu đã xóa snapshot bằng 004, chỉ cần chạy thêm 005 và tải lại frontend.

## Cấu hình

Điền `.env` ở thư mục gốc:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Hỗ trợ legacy `VITE_SUPABASE_ANON_KEY`. Frontend không dùng service_role/secret key. Gemini key tiếp tục đặt trong `server/.env`. Sau khi thay VITE_* cần khởi động lại frontend hoặc build lại production.

## Cách đồng bộ

- Thêm/sửa/xóa và lịch ôn được lưu vào IndexedDB. Chỉ bấm **Đồng bộ** ở header mới kết nối dữ liệu thư viện với server. Lần đầu mở hộp thoại chọn tải lên/tải về/hợp nhất; các lần sau nút chính đồng bộ hai chiều, menu mũi tên cho chọn hướng khác. Header báo “Có thay đổi chưa gửi”, “Đang đồng bộ”, “Đã đồng bộ” hoặc lỗi. Nội dung chỉ ghi từng dòng thay đổi; các trường khác được giữ khi hợp nhất với server.
- Các trang metadata `(id, updated_at)` được đọc với phân trang 500 dòng; chỉ tải nội dung đầy đủ của bản ghi mới/thay đổi theo lô. Tiến độ dùng khóa `(user_id, note_id, card_key)`.
- Không tự đồng bộ từ vựng khi mở ứng dụng, đổi trang, quay lại cửa sổ, có mạng trở lại hoặc theo chu kỳ. Thiết bị mới cần bấm Đồng bộ để tải thư viện từ server. Mỗi lần bấm đọc metadata có phân trang rồi chỉ tải nội dung mới/thay đổi; chi phí metadata tăng theo số bản ghi.
- Cặp dữ liệu local và bản gốc server theo từng dòng được giữ trong IndexedDB. Chỉnh sửa/xóa offline tồn tại sau khi đóng/mở trang. Nếu request lỗi, giữ thay đổi; bấm Đồng bộ lại ở header để thử lại. Thay đổi trong lúc request đang chạy được giữ cho lần bấm tiếp theo.
- Xóa nội dung là cập nhật `deleted_at`; bản ghi đã xóa không được kéo lại vào giao diện. Mất quyền folder thì dữ liệu cache liên quan được dọn khi đồng bộ lại. Thu hồi quyền không thể xóa nội dung đã tải xuống trên thiết bị đang offline.
- Khi hai thiết bị sửa các trường khác nhau, giữ thay đổi của cả hai. Cùng một trường thì thay đổi local đang chờ gửi thắng. UPDATE có kiểm tra `updated_at`; nếu server đổi ngay trong lúc gửi, giữ thay đổi để gửi ở lần bấm Đồng bộ tiếp theo.
- Lưu lịch ôn và logs bằng RPC atomic. Nếu có tiến độ mới từ thiết bị khác, các đánh giá offline mới hơn được tính lại trên lịch server; các sự kiện cũ hơn giữ trong lịch sử và không kéo lịch hiện tại lùi lại.
- Web Locks tuần tự hóa các tab cùng tài khoản nếu trình duyệt hỗ trợ. Server vẫn kiểm tra phiên bản từng dòng/tiến độ.

## Chọn hướng đồng bộ

- **Tải lên Supabase:** gửi những thay đổi local, giữ thư viện local và các bộ thẻ khác trên server. Không tải nội dung server-only về và không xóa toàn bộ collection trên server. Cập nhật vẫn theo từng dòng/trường và RLS của folder chia sẻ.
- **Tải từ Supabase về máy:** chỉ đọc server, thay thư viện local bằng dữ liệu cloud. Hộp thoại thông báo rõ việc thay thế. Trước khi thay, giữ tối đa 3 bản local trong `syncBackups`; menu header có Khôi phục local trước lần tải. Nếu có chỉnh sửa trong lúc request tải đang chạy, hủy việc thay local và yêu cầu tải lại.
- **Đồng bộ hai chiều:** gửi thay đổi local và nhận dữ liệu server, giữ các chỉnh sửa phát sinh trong lúc request cho lần đồng bộ tiếp theo.

Lần đầu chọn hướng tương tự trải nghiệm Anki; khác với full upload của Anki, tải lên ở đây giữ dữ liệu khác trên server để phù hợp với folder dùng chung. Không có thay thế toàn bộ collection server. Thời điểm đồng bộ gần nhất được lưu riêng theo tài khoản trong `syncMeta` và hiển thị khi trỏ vào nút header.

Ví dụ: máy A đã tạo từ vựng → Tải lên Supabase. Máy B → Tải từ Supabase về máy. Sau đó mỗi máy bấm Đồng bộ trước/sau phiên học để gửi/nhận thay đổi.

## Cache và quyền truy cập

Cache mới có tên `vocab-rows-v1-account-<user_id>`, tách riêng tài khoản và không tự nhập dữ liệu từ database snapshot cũ. Dữ liệu cũ trên trình duyệt không tự tải lên lại. Cài đặt cá nhân vẫn tự đồng bộ riêng qua `user_preferences`; chế độ thủ công áp dụng cho thư viện từ vựng/lịch ôn.

Mẫu thẻ cá nhân nằm trong `card_templates`; nội dung mẫu nhúng trong từng note giúp thành viên được chia sẻ hiển thị được thẻ. Owner quản lý folder/thành viên; editor sửa note; viewer chỉ xem và học với tiến độ riêng. Chia sẻ không tự áp dụng cho folder con. Giao diện quản lý lời mời/thành viên chưa được bổ sung; có thể thêm thành viên bằng SQL như trong `SHARED_VOCABULARY_MIGRATION.md`.

Giữ schema `vocab_private` ngoài API Exposed schemas. RLS kiểm tra phiên đăng nhập Supabase; không dựa vào quyền hiển thị trên frontend.

## Đăng nhập

Supabase Authentication → URL Configuration: thêm origin thực tế và redirect `/folders` cho Google OAuth, `/settings` nếu dùng xác nhận đăng ký email. Ví dụ `http://localhost:5173/folders`.

Bật Google provider trong Supabase, tạo OAuth Client ID Web application và dùng callback URL Supabase làm Authorized redirect URI. Client Secret chỉ đặt trong provider, không đưa vào frontend. Với OAuth Testing, thêm tài khoản vào Test users.

## Kiểm tra

```sh
npm run build
npm run lint
npm run test:server
```

Kiểm thử dùng IndexedDB/transport giả lập: ghi từng dòng, phân trang và cache metadata, offline/reopen, xóa mềm, thu hồi quyền, chỉnh sửa trong lúc gửi, hợp nhất trường và đồng bộ lịch ôn. Migration 005 được kiểm tra trên PostgreSQL nhúng về transaction, idempotency, revision và RLS; chưa xác minh project Supabase thật bằng phiên đăng nhập của bạn.
