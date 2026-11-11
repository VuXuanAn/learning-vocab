# Dùng bộ thẻ chia sẻ, bỏ dữ liệu snapshot cũ

Frontend đã chuyển sang đồng bộ các bảng riêng. Không nhập dữ liệu snapshot cũ và không dùng cache cũ để tạo lại dữ liệu server. Supabase Auth và cài đặt cá nhân được giữ.

## Thứ tự thực hiện

Trong SQL Editor, dùng role postgres:

1. Chạy `002_user_preferences.sql` nếu chưa chạy.
2. Chạy `003_shared_vocabulary.sql` nếu chưa chạy. Nếu đã chạy thành công thì bỏ qua; không chạy lại vì các bảng đã tồn tại.
3. Chạy `005_row_sync.sql` để thêm timestamp cho log và RPC lưu tiến độ/lịch sử atomic. File này có thể chạy lại.
4. Chạy `006_fix_folder_insert_rls.sql` nếu đã dùng bản 003 cũ: sửa lỗi 42501 khi tạo folder và lấy bản ghi vừa tạo. Không xóa dữ liệu, có thể chạy lại.
5. Đóng các phiên ứng dụng cũ. Chạy `004_remove_vocab_snapshots.sql` nếu bảng snapshot còn tồn tại; dữ liệu cũ bị xóa vĩnh viễn, các bảng mới và settings được giữ nguyên. Không dùng CASCADE, transaction rollback nếu có dependency bất ngờ.
6. Chạy `operations/verify_shared_vocabulary.sql`: bảng/hàm snapshot phải là NULL, bảy bảng mới đều tồn tại/bật RLS, RPC mới và cột timestamp của log phải tồn tại.
7. Chạy hoặc build/deploy frontend mới. Tải lại trang: ứng dụng dùng cache `vocab-rows-v1-account-<user_id>`, không tự nhập cache cũ. Nếu đã chạy 004 rồi, chỉ cần bổ sung 005 và tải lại app.
8. Tạo folder/note mới, thử sửa/xóa và ôn tập; bấm Đồng bộ ở header và đợi trạng thái đã đồng bộ, kiểm tra các bảng trên Supabase. Thử cùng tài khoản ở thiết bị khác và bấm Đồng bộ trên thiết bị đó. Mất mạng giữ dữ liệu local; có mạng trở lại cần bấm Đồng bộ để gửi.

Không còn script 001 tạo snapshot hoặc script import snapshot. Các cột `legacy_id` trong 003 có thể để NULL.

## Các bảng

| Bảng | Dữ liệu |
| --- | --- |
| `folders` | Bộ thẻ, chủ sở hữu, thư mục cha, tùy chọn đảo mặt |
| `folder_members` | Thành viên và quyền viewer/editor; owner là `folders.owner_id` |
| `notes` | Mỗi từ vựng một dòng, thuộc folder |
| `card_templates` | Mẫu thẻ cá nhân |
| `user_card_progress` | FSRS riêng cho `(user_id, note_id, card_key)` |
| `review_logs` | Từng lần ôn riêng từng người |
| `user_preferences` | Cài đặt cá nhân |

`card_key` là `forward`, `reverse`, `custom`, `c1`… Một note có thể tạo nhiều card. Thời gian server dùng timestamptz, frontend khôi phục Date khi đọc lịch ôn.

## Chia sẻ folder

Giao diện mời/quản lý thành viên chưa nằm trong thay đổi này. Trong SQL Editor, thay UUID bằng giá trị thật:

```sql
insert into public.folder_members(folder_id, user_id, role)
values ('FOLDER_UUID'::uuid, 'MEMBER_USER_UUID'::uuid, 'viewer')
on conflict (folder_id, user_id) do update set role = excluded.role;
```

Dùng `editor` nếu được sửa note. Owner quản lý folder/thành viên qua `folders.owner_id`; không thêm dòng owner vào members. Folder con phải chia sẻ riêng. Mỗi người có tiến độ/lịch sử độc lập; nội dung note được dùng chung.

RLS bảo vệ server. Khi quyền bị thu hồi, cache được dọn trong lần đồng bộ tiếp theo; thiết bị offline vẫn có thể giữ nội dung đã tải. Không đưa `vocab_private` vào API Exposed schemas và không dùng service_role key trong frontend.

Xem `README.md` trong thư mục này để biết cơ chế đồng bộ và chi phí metadata.

## Dùng dữ liệu trên máy hoặc server

Ở header, lần đầu bấm Đồng bộ sẽ mở lựa chọn hướng. Chọn Tải lên Supabase để gửi dữ liệu trên máy; thiết bị khác chọn Tải từ Supabase về máy. Các lần sau nút chính đồng bộ hai chiều. Menu mũi tên cho chọn lại hướng hoặc khôi phục local trước lần tải. Tải lên giữ dữ liệu khác trên server; tải về thay local và giữ tối đa 3 bản khôi phục. Không cần migration SQL mới cho lựa chọn hướng; IndexedDB tự nâng version để lưu thông tin đồng bộ và backup.
