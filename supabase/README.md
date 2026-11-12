# Supabase: đồng bộ từng dòng

Frontend dùng trực tiếp các bảng `folders`, `folder_members`, `notes`, `card_templates`, `user_card_progress`, `review_logs` và `user_preferences`. Không đọc/ghi snapshot.

## SQL cần chạy

Grammar: run `migrations/013_grammar_library.sql` in the Supabase SQL Editor. Grammar automatically merges on startup, local folder/entry changes (including Reading assignments), online and window focus. Failed requests retry after 30 seconds; pending changes and deletions survive reloads. Automatic sync touches only Grammar tables and their acknowledgements; vocabulary remains manual. Grammar has no study status or FSRS schedule. Content notes and source highlights are preserved. The shared manual sync and backup tools remain compatible with Grammar data. Owner RLS and a composite folder-owner foreign key protect the two cloud tables.

Reading: chạy thêm `migrations/011_reading_library.sql` để tạo bảng thư mục/bài đọc, sau đó `migrations/012_reading_study_notes.sql` cho ghi chú học tập có loại (ngữ pháp/cấu trúc câu/cách diễn đạt/khác), với RLS theo tài khoản. Chi tiết lưu trữ, HTML và Detect vocab tại [READING.md](READING.md).

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

## Speaking và Google Drive

Sau đăng nhập, header có Speaking / Vocab / Reading. Vocab giữ folder, quản lý thẻ và ôn tập hiện tại; Reading là trang Sắp có. `/speaking` yêu cầu đăng nhập như Vocab.

### Thiết lập dịch vụ

1. Trong Google Cloud project đang chứa OAuth Client, mở APIs & Services → Library → Google Drive API → Enable. Có thể mở https://console.cloud.google.com/apis/library/drive.googleapis.com rồi chọn đúng project.
2. Google Auth Platform → Data Access → Add or remove scopes → thêm `https://www.googleapis.com/auth/drive.file`. Giữ email của bạn trong Audience → Test users nếu OAuth đang ở Testing. Không xin drive/drive.readonly toàn bộ Drive.
3. Supabase Authentication → URL Configuration → Redirect URLs: thêm `http://localhost:5173/speaking`, hoặc origin production thực tế + `/speaking`. Google OAuth Client vẫn dùng callback Supabase `https://<project-ref>.supabase.co/auth/v1/callback`; không thay callback đó bằng URL frontend.
4. Chạy toàn bộ `supabase/migrations/007_speaking_recordings.sql` trong SQL Editor. Bảng này chỉ chứa metadata và có RLS theo user_id. Không cần Google API key mới, Client Secret mới trong frontend hoặc public hóa file Drive.
5. Mở Speaking → Kết nối Google Drive → chọn cùng tài khoản Google và cấp quyền. Quyền được xin riêng khi bấm kết nối; đăng nhập thường không yêu cầu quyền Drive.

### Sử dụng

Dán đoạn văn, đặt tên bài, nghe mẫu bằng giọng đọc trình duyệt; ghi âm tối đa 5 phút rồi Dừng và lưu hoặc tải file audio tối đa 20 MB. Bản đã ghi xong được giữ trong IndexedDB riêng theo tài khoản. Nháp tên/đoạn văn giữ riêng trong localStorage để không mất khi redirect cấp quyền. Cần HTTPS hoặc localhost để truy cập micro. Đang ghi mà rời trang sẽ dừng micro; hãy Dừng và lưu trước khi rời trang.

Nghe lại bản local không cần Drive. Bấm Lưu lên Drive: tạo thư mục riêng tư `Vocab Library - Speaking`, dùng resumable upload, gắn appProperties/recordingId để retry có thể tìm file cũ. Sau khi Drive xác nhận file, giữ ID trên máy rồi lưu metadata vào Supabase. Nếu bước Supabase lỗi, bản âm thanh vẫn ở Drive và trên máy; bấm Lưu lịch sử để retry, không upload lại file. Các file không được chia sẻ công khai.

Lịch sử tải tối đa 500 bản gần nhất trên Supabase và hợp với bản local. Thiết bị khác đăng nhập cùng tài khoản, kết nối Drive rồi bấm Nghe lại: tải file bằng Drive API có Authorization, tạo blob URL tạm và phát bằng audio controls. Có nút Mở Drive để nghe bằng Google Drive trực tiếp. Phiên bản hiện tại dùng access token Google từ Supabase OAuth; khi token hết hạn/mất hoặc quyền bị từ chối cần Kết nối lại Drive. Không lưu provider token/refresh token vào bảng lịch sử; chưa có backend refresh token tự động.

CSP backend đã cho phép Google Drive API và phát blob audio. Bản ghi/metadata chưa tích hợp vào export JSON từ vựng hoặc row-sync Vocab; file âm thanh nằm ở Drive và bảng speaking_recordings riêng. Chưa có chức năng chấm điểm phát âm/Gemini/Azure trong tab này.

Kiểm tra tự động giả lập consent config, định dạng audio, resumable upload, file private, retry tránh trùng, lỗi quyền/token, chặn upload host lạ, phát file private và nâng schema DB không mất dữ liệu cũ. Chưa thực hiện OAuth/Drive thật hoặc ghi âm phần cứng trong môi trường kiểm thử.
