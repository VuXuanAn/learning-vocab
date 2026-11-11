# Vocab Library

React + TypeScript + Vite + Tailwind CSS cho ứng dụng từ vựng kiểu Anki.
Hiện có trang chào và cấu hình nền tảng, chưa có chức năng tạo thẻ hoặc ôn tập.

## Chạy dự án

```sh
npm install
npm run dev
npm run build
npm run lint
```

Trên PowerShell nếu npm.ps1 bị chặn, dùng npm.cmd thay cho npm.

## Thư viện đã cài

- React Router: định tuyến.
- Zustand: trạng thái giao diện.
- Dexie + dexie-react-hooks: lưu dữ liệu offline bằng IndexedDB.
- ts-fsrs: thuật toán lên lịch ôn tập ngắt quãng.
- React Hook Form + Zod + @hookform/resolvers: form và kiểm tra dữ liệu.
- Lucide React: biểu tượng.
- Sonner: thông báo.
- clsx + tailwind-merge: tiện ích class tại src/lib/utils.ts.

Tailwind được tích hợp qua plugin Vite. Các thư viện nghiệp vụ đã cài và sẵn sàng tích hợp khi phát triển chức năng.
IndexedDB lưu dữ liệu trong trình duyệt; đồng bộ tài khoản cần backend riêng.

## Thẻ học đã triển khai

- Cơ bản: một thẻ mặt trước / mặt sau.
- Cơ bản + đảo chiều: hai thẻ cho một ghi chú.
- Cloze: cú pháp {{c1::đáp án::gợi ý}}, mỗi số khác nhau sinh một thẻ; cùng số được ẩn chung.
- Xem trước trực tiếp, lật đáp án, chuyển giữa các thẻ.
- Lưu và xóa ghi chú bằng Dexie / IndexedDB, giữ dữ liệu khi tải lại trang.
- Chưa có lịch ôn tập FSRS hoặc đồng bộ tài khoản.

Tham khảo: https://docs.ankiweb.net/getting-started.html#note-types

## Kiểu thẻ tùy chỉnh

Chọn **+ Tạo kiểu mới** cạnh danh sách kiểu thẻ:
- Đặt tên kiểu, thêm/xóa trường và đánh dấu trường bắt buộc.
- Viết mẫu hai mặt bằng `{{Tên trường}}`, xuống dòng và thêm văn bản tùy ý.
- Dùng `{{FrontSide}}` ở mặt sau để lặp lại nội dung mặt trước.
- Chỉnh căn lề, cỡ chữ, màu chữ và xem trước ngay.
- Lưu kiểu để sử dụng trong form tạo ghi chú.

Kiểu mới hỗ trợ HTML hai mặt và CSS chung, xem trước trong iframe sandbox. Trường dữ liệu được hiển thị dưới dạng văn bản; JavaScript không chạy. Kiểu văn bản cũ vẫn giữ cách hiển thị ban đầu.
Kiểu thẻ lưu ở bảng templates (IndexedDB v2). Mỗi ghi chú giữ bản chụp kiểu thẻ tại thời điểm tạo.


## Giọng đọc từ vựng

Trong trình tạo kiểu thẻ, chọn trường cần đọc ở mục Giọng đọc từ vựng, sau đó chọn ngôn ngữ và tốc độ. Có ô nhập từ để nghe thử trước khi lưu. Nút Nghe phát âm xuất hiện bên dưới thẻ khi trường được chọn có dữ liệu, dùng được với bản xem trước và ghi chú đã lưu. Thẻ cơ bản hỗ trợ đọc mặt trước bằng tiếng Anh Mỹ.

Sử dụng Web Speech API của trình duyệt, không cần API key. Giọng đọc và khả năng dùng offline tùy thiết bị/trình duyệt. Không tạo hoặc lưu file âm thanh. Cấu hình giọng đọc được lưu trong mẫu và bản chụp mẫu của ghi chú.

## Các trang

- `/add`: thêm từ vựng, tạo kiểu thẻ, xem trước, quản lý ghi chú đã lưu.
- `/review`: ôn tập tất cả thẻ đã lưu, lật đáp án, nghe phát âm và đánh dấu Đã nhớ / Chưa nhớ.
- `/` và đường dẫn không tồn tại chuyển tới `/add`.

Trang ôn tập dùng hàng đợi trong phiên: Chưa nhớ đưa thẻ về cuối, Đã nhớ đánh dấu hoàn thành. Có tiến độ và kết quả cuối phiên. Hiện chưa áp dụng FSRS; tiến độ phiên không được lưu khi tải lại hoặc rời trang. HTML/CSS và giọng đọc dùng lại cấu hình của từng ghi chú.

Sử dụng BrowserRouter: khi triển khai, cấu hình hosting fallback các route về index.html.

## Thư mục từ vựng

Có thể tạo, đổi tên và xóa thư mục ở phần Thư mục từ vựng. Trang thêm từ lưu ghi chú vào thư mục đang chọn; khi chọn Tất cả, từ mới được lưu vào Chưa phân loại. Mỗi ghi chú có bộ chọn thư mục để chuyển từ đã lưu. Trang ôn tập chỉ lấy thẻ trong thư mục đã chọn; trong phiên đang học, bộ chọn bị khóa.

Dữ liệu cũ không có folderId được xem là Chưa phân loại. IndexedDB v3 thêm bảng folders và chỉ mục folderId. Xóa thư mục dùng transaction để chuyển toàn bộ từ về Chưa phân loại rồi xóa thư mục, giữ lại nội dung. Tên thư mục phải duy nhất (không phân biệt chữ hoa/thường). Hiện là thư mục một cấp.

## Trang chủ bộ thẻ

Trang `/` liệt kê thư mục theo cây với các cột Mới / Học / Đến hạn, tổng thẻ và Chưa phân loại. Có thể thu gọn, mở thư mục và bấm tên để ôn tập thư mục đó. Nút quản lý mở phần tạo/đổi tên/xóa thư mục; khi tạo có thể chọn thư mục cha. Xóa thư mục cha đưa thư mục con lên cấp trên và giữ nguyên từ trong thư mục con.

Số thẻ của thư mục cha và bộ lọc ôn tập bao gồm toàn bộ thư mục con. Cột Mới hiện tính tất cả thẻ, Học/Đến hạn bằng 0 do chưa lưu lịch FSRS; giao diện có chú thích rõ. Không hiển thị số liệu giả. Liên kết `/review?folder=<id>` chọn sẵn thư mục; `/add?folder=<id>` chọn sẵn thư mục lưu từ.

## Tailwind CSS và shadcn/ui

Đã cấu hình shadcn/ui (Base UI, base-nova) trên Tailwind CSS v4 với alias @/ trỏ tới src/. Các component nằm trong src/components/ui: Button, Dialog, Input, Label, Select, Table.

Tạo thư mục từ trang chủ hoặc phần quản lý mở popup có tên và thư mục cha; đổi tên cũng dùng Dialog. Lưu thất bại hoặc trùng tên hiển thị lỗi trong popup, giữ nguyên dữ liệu đã nhập. Tạo thành công đóng popup và cập nhật danh sách qua Dexie live query. Nút Hủy đóng mà không ghi dữ liệu.

Thêm component sau này bằng: npx shadcn@latest add <component>

### Menu action trên trang chủ

Trang chủ không còn hai nút Tạo thư mục / Quản lý thư mục phía trên. Menu action ở tiêu đề bảng tạo thư mục gốc. Menu mỗi dòng thư mục có Tạo thư mục con, Đổi tên và Xóa thư mục; tạo/đổi tên mở popup shadcn. Tạo thư mục con tự chọn thư mục cha hiện tại và mở rộng dòng cha sau khi lưu. Xóa vẫn giữ từ vựng ở Chưa phân loại và đưa thư mục con lên cấp trên.

## Thêm từ bằng popup

Tất cả nút Thêm từ vựng mở Dialog ngay trên trang hiện tại, không chuyển sang trang riêng. Menu action của folder có Thêm từ vựng với thư mục được chọn sẵn. Popup không còn khối Thư mục từ vựng; chỉ có ô chọn nơi lưu trong form. Giữ chức năng tạo kiểu thẻ, HTML/CSS, phát âm, xem trước và danh sách ghi chú đã lưu. Form mới để trống để tránh lưu nhầm dữ liệu mẫu. Lưu xong giữ popup mở để nhập tiếp.

Đường dẫn /add cũ chuyển về trang chủ và mở popup. Trạng thái popup dùng tham số add=1 và addFolder, giữ nguyên folder ôn tập; đóng popup không điều hướng khỏi trang đang xem hoặc làm mất phiên ôn tập.

## Backend và AI gen

Xem `server/README.md` để cấu hình. Điền `OPENAI_API_KEY` trong `server/.env` (không gửi key vào chat). `npm.cmd run dev` hiện chạy cả backend Express :4100 và frontend Vite :5173. Backend giữ key, dùng Responses API + Structured Outputs để tự điền field theo kiểu thẻ. Mặc định model gpt-4.1-mini, đổi bằng OPENAI_MODEL.

Popup thêm từ có khu vực AI gen: nhập từ hoặc dùng từ đang có trong field; với thẻ tùy chỉnh chọn field chứa từ. AI chỉ điền ô trống, không tự lưu. Có trạng thái đang tạo, nút Dừng và lỗi cấu hình/kết nối. Thư mục và từ vựng vẫn lưu trong IndexedDB, chưa chuyển sang database backend.

Kiểm tra backend: `npm.cmd run test:server` (mock OpenAI, không tốn phí). Build frontend: `npm.cmd run build`. Chạy bản build: `npm.cmd start`.

## AI generator: tạo danh sách và review bằng bảng

Đây là lựa chọn riêng trong Kiểu thẻ (mặc định khi mở popup). Các kiểu nhập thủ công không còn khối AI gen tự điền một từ.

1. Chọn AI generator, nơi lưu và bộ trường mặc định hoặc kiểu tùy chỉnh.
2. Nhập một/nhiều từ, mỗi từ một dòng hoặc ngăn bằng dấu phẩy/chấm phẩy. Từ trùng trong cùng danh sách được gộp, giữ nguyên cụm nhiều từ.
3. Bấm AI gen: một POST /api/ai/generate-batch, một lần gọi Responses API cho toàn danh sách. Hướng dẫn/cấu trúc dùng chung; không yêu cầu model trả lại từ đầu vào. Không phải dịch vụ OpenAI Batch API bất đồng bộ.
4. Kiểm tra bảng, sửa từng ô, bỏ chọn hoặc xóa dòng. Không gọi AI khi sửa bảng.
5. Lưu các dòng được chọn bằng một transaction IndexedDB. Dòng đã lưu được đánh dấu và không lưu lặp lại. Chỉ tạo lại bảng khi chủ động bấm Tạo lại bảng.

Bộ trường mặc định: từ, IPA, loại từ, nghĩa, ví dụ và bản dịch. Lưu thành kiểu ai với template HTML và giọng đọc; dùng được trong trang ôn tập. Khi chọn bộ trường tùy chỉnh, lưu dạng custom cùng template đó. Dữ liệu AI cần được người dùng kiểm tra trước khi lưu.

Tối đa 20 từ, 20 trường và 200 ô/lần để giới hạn độ dài output. Có số token input/output từ usage API sau khi tạo. Số token/chi phí thực tế phụ thuộc lượng nội dung; không có cam kết giảm theo tỉ lệ cố định. Test không gọi OpenAI thật.

## Popup cố định header/footer và bắt buộc folder

Header và footer của popup Thêm từ vựng luôn hiển thị; chỉ nội dung giữa cuộn. Nút Lưu ghi chú / Lưu các dòng đã chọn được đưa xuống footer cùng nút Đóng, áp dụng cả nhập thủ công và AI generator.

Không còn lựa chọn hoặc dòng thư mục Chưa phân loại. Người dùng phải chọn folder tồn tại trước khi tạo AI và lưu. Nếu mở popup từ action của folder, folder được chọn sẵn. Nút lưu bị vô hiệu hóa khi chưa chọn folder; lớp lưu dữ liệu kiểm tra lại folder trong transaction để chặn folder đã bị xóa.

IndexedDB v4 chuyển dữ liệu cũ chưa có folder hoặc folder không còn tồn tại vào một folder thật tên Từ vựng đã lưu (thêm số nếu trùng tên), giữ nguyên các ghi chú đã phân loại. Xóa folder còn ghi chú bị chặn; folder rỗng có thể xóa và các folder con được chuyển lên cấp cha. Không xóa dữ liệu người dùng khi nâng cấp.

### Bố cục AI generator gọn hơn

AI generator dùng cố định bộ trường mặc định (từ vựng, IPA, loại từ, nghĩa, ví dụ, bản dịch), không còn bộ chọn Các trường cần tạo / Trường chứa từ vựng. Kiểu thẻ và Lưu vào thư mục nằm cùng hàng trên màn hình rộng, xếp dọc trên điện thoại. Folder được quản lý chung ở form để giữ lựa chọn khi đổi kiểu thẻ.

## Chuyển nhà cung cấp AI sang Gemini

Backend hiện dùng Google Gen AI SDK và GEMINI_API_KEY (hoặc GOOGLE_API_KEY), model mặc định gemini-3.5-flash-lite. OPENAI_API_KEY / OPENAI_MODEL không còn được sử dụng. Điền key trong server/.env và khởi động lại backend. Endpoint và luồng AI generator/table review giữ nguyên; health hiển thị provider=gemini. Xem server/README.md để biết cấu hình hiện hành; các hướng dẫn OpenAI ở phần trước đã được thay thế bởi cấu hình Gemini này.

## Kiểm tra chính tả trong AI generator

Cùng một lần AI gen, model đánh giá từng từ/cụm từ là correct, suggested hoặc uncertain. Chấp nhận biến thể Anh/Mỹ và không coi mọi từ lạ là sai. Backend kiểm tra metadata, giữ originalWord và trả gợi ý sửa riêng. Với suggested, các field được tạo theo từ gợi ý và dòng chưa được chọn để lưu; người dùng phải bấm Xác nhận sửa. Với uncertain, các field sinh tự động để trống, cần kiểm tra/điền thủ công và xác nhận. Sửa ô từ vựng sẽ yêu cầu xác nhận lại nội dung trước khi lưu.

Bảng có cột Kiểm tra chính tả hiển thị từ gốc, nhận định và lý do. Không phát sinh request riêng. Đây là nhận định của model, không phải bảo đảm từ điển đã được tra cứu.

## Ôn tập 4 mức bằng FSRS

Trang ôn tập có Quên (Again), Khó (Hard), Tốt (Good), Dễ (Easy); mỗi nút hiển thị khoảng thời gian lần ôn tiếp theo. Dùng ts-fsrs phiên bản hiện có trong dự án, learning_steps 1m / 10m, relearning_steps 10m, tắt fuzz để preview và lịch thực nhất quán. Lần đầu học: Quên khoảng 1 phút, Khó 6 phút, Tốt 10 phút; Dễ chuyển sang ôn dài hạn. Thời gian sau đó phụ thuộc lịch sử từng thẻ.

Thẻ học/học lại trở về hàng đợi khi đến hạn, không lặp ngay khi chưa đủ thời gian. Nếu hết thẻ sẵn sàng, trang hiển thị thời gian chờ và tự đưa thẻ lên khi đến hạn. Có thể kết thúc phiên và quay lại sau; không mất lịch. Thẻ đã sang Review được bỏ khỏi phiên và chỉ xuất hiện trong lần ôn đến hạn.

IndexedDB v5 thêm reviews và reviewLogs. Mỗi thẻ đảo chiều/Cloze có lịch riêng theo card ID. Lưu rating, trạng thái FSRS, due, revision và review log bằng transaction, chặn trả lời trùng từ phiên khác và chấm điểm sớm. Dữ liệu hai mức cũ không có lịch nên các thẻ này bắt đầu như thẻ mới.

Trang chủ lấy số Mới / Học / Đến hạn từ lịch thật (Học gồm Learning/Relearning đang chờ, Đến hạn gồm Review đã đến hạn). Không còn tính tất cả thẻ là Mới.

## Cài đặt, câu hỏi nhanh và tự động phát âm

Tab /settings lưu tùy chọn bằng Zustand persist trên localStorage:
- Bật/tắt nhắc điền nghĩa (mặc định bật), chu kỳ 1–120 phút, mặc định 5 phút.
- Nút Thử câu hỏi ngay để kiểm tra ngay; nếu chưa có từ phù hợp sẽ báo rõ.
- Bật/tắt tự động phát âm khi mở thẻ (mặc định tắt). Áp dụng thẻ ôn tập và popup câu hỏi, đọc một lần khi chuyển thẻ, có thể bấm nghe lại. Trình duyệt có thể yêu cầu thao tác người dùng lần đầu.

Popup chọn ngẫu nhiên trong thẻ từ vựng có lần đánh giá gần nhất là Quên, ưu tiên tránh lặp từ vừa hỏi khi có lựa chọn khác. Bỏ qua thẻ đã xóa, Cloze và mẫu tùy chỉnh không có trường từ/nghĩa rõ ràng. Không lấy nghĩa hoặc ví dụ AI mới, không tốn quota. Khi từ được đánh giá Khó/Tốt/Dễ, từ đó ra khỏi nhóm nhắc (trừ khi thẻ khác cùng từ vẫn đang Quên).

Bộ đếm chạy khi ứng dụng mở; chỉ hiển thị khi trang đang được xem và có focus. Trì hoãn nếu đang nhập liệu, mở popup khác hoặc đang trả lời thẻ ôn tập. Không phải notification hệ thống khi trình duyệt đóng. Sau khi đóng/bỏ qua, đợi một chu kỳ mới; không dồn nhiều popup.

Người dùng nhập nghĩa rồi xem nghĩa đã lưu. So sánh văn bản có chuẩn hóa hoa/thường, dấu câu và các nghĩa phân cách bằng dấu phẩy/chấm phẩy; giữ dấu tiếng Việt. Chưa chấm ngữ nghĩa tương đương bằng AI nên kết quả không khớp chỉ đề nghị đối chiếu. Câu hỏi nhanh không sửa lịch FSRS. Cấu hình và lịch sử học hiện vẫn thuộc từng trình duyệt.

## Toàn màn hình và phím tắt khi ôn tập

Nút Toàn màn hình trên trang ôn tập mở vùng học bằng Fullscreen API. Nếu trình duyệt không hỗ trợ/không cho phép, dùng bố cục tập trung phủ toàn cửa sổ. Ẩn điều hướng, breadcrumb và footer; Esc hoặc nút Thoát để quay lại. Popup nhắc nghĩa được trì hoãn trong chế độ tập trung. Mở popup thêm từ sẽ thoát toàn màn hình trước.

Phím 1 = Quên, 2 = Khó, 3 = Tốt, 4 = Dễ chỉ hoạt động khi đã hiện đáp án và có thẻ đang học. Space hiện đáp án. Bỏ qua giữ phím, tổ hợp Ctrl/Alt/Meta/Shift, gõ IME, khi nhập liệu hoặc đang mở popup/đang lưu. Các phím gọi cùng hàm lưu FSRS như nút bấm, có khóa chống chấm trùng.

## Đảo mặt theo bộ thẻ

Menu action của folder và trang ôn tập có công tắc Đảo mặt trước/sau. Cấu hình reverseCards lưu trong folder (không cần thay schema), không sửa nội dung ghi chú hoặc reset lịch FSRS. Khi ôn một folder, lựa chọn áp dụng cả các folder con nằm trong phiên; khi ôn tất cả, mỗi folder dùng cấu hình riêng. Chiều học được chụp lúc bắt đầu phiên để không đổi câu hỏi giữa chừng.

Thẻ AI hỏi nghĩa trước và từ vựng sau, không lộ từ qua ví dụ/phiên âm. Mẫu tùy chỉnh khi đảo sẽ bỏ phần FrontSide ở câu hỏi để tránh lộ mặt trước. Giọng đọc từ chỉ hiển thị/phát khi đã lật đáp án ở chiều đảo. Các loại thẻ khác hoán đổi hai mặt. Card ID giữ nguyên để lịch ôn không bị mất.

## Supabase (đã tích hợp)

Thẻ, thư mục, mẫu thẻ và lịch ôn lưu vào IndexedDB. Bấm Đồng bộ ở header để gửi thay đổi lên Supabase và nhận dữ liệu cloud. Mất mạng giữ thay đổi trên máy; có mạng trở lại bấm Đồng bộ để gửi. Trạng thái đồng bộ hiển thị ở header; không còn phần sao lưu thủ công trong Cài đặt. Nội dung được đồng bộ từng dòng vào folders/notes/card_templates; tiến độ riêng trong user_card_progress và review_logs. Xem supabase/README.md.

Điền VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY trong .env ở thư mục gốc (mẫu .env.example), chạy migrations 002, 003 (nếu chưa chạy), 005 và dọn snapshot cũ bằng 004 theo supabase/SHARED_VOCABULARY_MIGRATION.md, cấu hình Auth redirect rồi khởi động lại frontend. Không dùng service_role/secret key trong frontend. Hướng dẫn đầy đủ: supabase/README.md.

Cache mới tách theo tài khoản và không nhập nội dung snapshot cũ. Nội dung folder chia sẻ được bảo vệ bằng RLS theo thành viên; tiến độ và lịch sử riêng từng người. Lịch ôn/lịch sử được lưu atomic bằng save_card_review. Chưa xác minh kết nối trên project thật bằng tài khoản đăng nhập.

### Tạo thẻ từ các dạng từ liên quan

Trong mặt sau thẻ AI, mỗi dòng dạng `effective (adj): hiệu quả` có nút **AI gen** nếu từ chưa tồn tại trong kho của tài khoản hiện tại. Bấm nút sẽ gọi AI một lần cho từ đó và tự lưu thẻ đầy đủ vào cùng thư mục với thẻ nguồn. Nếu từ đã tồn tại (kể cả trong thư mục khác), hiển thị link để mở popup xem thẻ. Đóng popup tiếp tục phiên ôn đang học; link có tham số `note` để mở lại trực tiếp.

Khi AI sửa từ hoặc chuyển về dạng gốc, liên kết từ dòng ban đầu tới ID thẻ được lưu cùng dữ liệu note và được đồng bộ cùng bản ghi note. Trước khi lưu, kiểm tra trùng trong transaction để tránh tạo hai thẻ khi thao tác ở nhiều tab. Bấm Đồng bộ ở header để đưa các thay đổi lên Supabase.

### Quản lý thẻ

Bộ thẻ → menu action của folder → **Quản lý thẻ** mở `/cards?folder=<id>`. Menu action ở tiêu đề bảng mở danh sách toàn bộ. Trang này yêu cầu đăng nhập, dùng kho riêng của tài khoản hiện tại; có tìm từ/nghĩa/nhãn, lọc folder, gồm hoặc không gồm thư mục con và phân trang 20 từ vựng.

Thêm từ, xem và chỉnh sửa dùng popup. Một từ vựng có thể sinh nhiều thẻ (đảo chiều/cloze); popup xem cho chọn từng thẻ. Chỉnh sửa giữ lịch ôn. Xóa có xác nhận và xóa toàn bộ thẻ/lịch ôn/lịch sử của từ đó trong một transaction; các liên kết từ liên quan trỏ tới từ bị xóa được bỏ để có thể tạo lại. Bấm Đồng bộ ở header để đưa các thay đổi lên Supabase.


## Đồng bộ theo bảng riêng

Frontend không còn đọc/ghi snapshot. Cache mới `vocab-rows-v1-account-<user_id>` không nhập dữ liệu cũ. Các thay đổi chỉ đồng bộ từng dòng khi bấm Đồng bộ ở header, giữ pending offline và dùng RPC atomic cho lịch ôn. Cần chạy migration 005 sau 003; xem supabase/README.md.

Lần đầu bấm Đồng bộ ở header có lựa chọn Tải lên Supabase / Tải từ Supabase về máy / Đồng bộ hai chiều. Tải lên gửi dữ liệu local theo từng dòng và giữ dữ liệu khác trên server. Tải về thay local, giữ bản khôi phục trong IndexedDB; menu header cho khôi phục khi cần. Những lần sau nút chính đồng bộ hai chiều.

### Thống kê token Gemini trong Cài đặt

Cài đặt → Sử dụng Gemini hiển thị model, trạng thái cấu hình key, token đầu vào/đầu ra hôm nay và tháng này, số lượt gọi và lỗi/chưa hoàn tất. UI đọc `GET /api/ai/usage`, tự làm mới mỗi 30 giây khi tab hiển thị; endpoint này không gọi Gemini.

Backend ghi nhận `usage` của từng request generate/generate-batch, bao gồm tạo từ liên quan. Token đầu ra gồm candidate + thinking tokens theo Gemini metadata. Request không có usage metadata được đếm riêng, không suy đoán token. Ngày/tháng tính theo Asia/Ho_Chi_Minh. Đây là số liệu chung của model trên backend từ lúc bật thống kê, không bao gồm lịch sử trước đó hoặc request từ ứng dụng/backend khác. Không phải số quota còn lại của Google project.

`server/index.mjs` lưu số đếm vào `server/data/gemini-usage.json` (đã gitignore); chỉ lưu ngày/model/số đếm, không lưu API key, từ vựng, prompt hoặc nội dung phản hồi. Muốn giữ lịch sử khi deploy lại container cần ổ đĩa bền vững cho thư mục này. Đổi API key/project nhưng giữ file sẽ tiếp tục cộng vào số liệu backend/model đó.

Quota thực tế phụ thuộc Google project/model/tier; mở nút Xem hạn mức để đến Google AI Studio và chọn project đúng với key backend. Không cần chạy thêm SQL Supabase. Nếu backend chưa chạy mã mới, khởi động lại backend.

### Import / Export backup JSON

Cài đặt → **Import / Export dữ liệu**. Export toàn bộ kho trên thiết bị hoặc một folder (gồm thư mục con và đường dẫn folder cha). Muốn lấy bản cloud mới nhất, đồng bộ trước khi export. File tối đa 25 MB; các kho lớn có thể xuất riêng từng folder.

Định dạng `vocab-library-backup`, version 1, chứa 5 loại thẻ: basic, reverse, cloze, custom, ai; giữ template/HTML/CSS/cấu hình giọng đọc, tất cả field values, tags/ghi chú, folder và chiều học, liên kết từ liên quan, lịch FSRS, review logs và cài đặt. Hình/âm thanh từ URL không được tải đính kèm, nên vẫn phụ thuộc URL gốc. Không bao gồm API key, session đăng nhập, quyền chia sẻ hay dữ liệu theo dõi usage Gemini.

Import kiểm tra cấu trúc/version, ID trùng, template và required fields, cú pháp cloze, quan hệ folder và tham chiếu lịch ôn/log trước khi ghi. Hiển thị thống kê theo loại thẻ để xác nhận. Có thể giữ lịch ôn/lịch sử hoặc nhập như thẻ mới; áp dụng preferences từ file là tùy chọn tắt mặc định. Hỗ trợ file snapshot JSON version 1 cũ có cùng các trường dữ liệu, không cần trường format.

Mỗi lần import tạo một thư mục gốc mới và ID mới cho folder/template/note/log, cập nhật lại card IDs và các liên kết nội bộ. Bản nhập là dữ liệu cá nhân mới, không kế thừa quyền hoặc danh tính người sở hữu cũ. Không thay thế thẻ có sẵn; nhập cùng file lần nữa tạo bản sao. Liên kết từ trỏ ra ngoài phần được export sẽ không được giữ làm liên kết ID. Không tự suy đoán hợp nhất theo từ vì một từ có thể có nhiều nghĩa/mẫu khác nhau.

Trước khi thêm dữ liệu, lưu backup local vào `syncBackups`, giữ tối đa 3 bản (dùng chung với bản trước lần tải cloud). Việc nhập folder/thẻ/template/lịch/log nằm trong một IndexedDB transaction; lỗi lưu sẽ rollback cả bản nhập. Có thể dùng menu Đồng bộ → Khôi phục bản local trước đó để trở về trạng thái trước import. Không xóa cache trình duyệt nếu cần các bản này. File export tải về là bản backup độc lập với trình duyệt.

Bấm **Đồng bộ** sau import để gửi bản mới lên Supabase. Lịch ôn không có review log được tạo riêng trên cloud, không dựng lịch sử giả. Không cần migration SQL mới. Backup/import cũng dùng khóa đồng bộ theo tài khoản để tránh chạy đồng thời với một lần sync trên các trình duyệt hỗ trợ Web Locks.

Kiểm tra tự động bao gồm round-trip 5 loại thẻ và 7 thẻ sinh ra, HTML/CSS/voice, cloze nhiều nhóm, remap IDs/liên kết, giữ Date FSRS, nhập trùng thành bản sao, lựa chọn preferences/progress, export folder, kiểm tra file lỗi và rollback khi storage thất bại. Chưa kiểm thử file Anki `.apkg` hoặc CSV; chỉ hỗ trợ JSON của ứng dụng.

### Tự động đồng bộ hai chiều

Thư viện từ vựng và lịch ôn hiện đồng bộ thủ công: mọi thay đổi được lưu trong IndexedDB theo tài khoản; dấu ! đỏ báo dữ liệu đang chờ gửi. Chỉ bấm Đồng bộ mới bắt đầu gửi/nhận Supabase. Không tự chạy khi mở app, thay đổi dữ liệu, focus/online/pagehide hoặc khi lỗi; lỗi cần bấm thử lại. Thiết bị mới cần bấm Đồng bộ để tải thư viện. Các cài đặt cá nhân và thư viện Speaking/Reading dùng cơ chế lưu riêng.

Khi ẩn/đóng tab, controller bắt đầu lượt merge ngay nếu không có lượt đang chạy; nếu đang chạy thì xếp một lượt tiếp theo. Trình duyệt không bảo đảm hoàn tất mạng trong sự kiện đóng trang, nên không cam kết dữ liệu đã lên server ngay lúc đóng. Các thay đổi đã lưu IndexedDB và sync base còn giữ nguyên; lần mở sau sẽ tính phần chưa gửi và tiếp tục merge. Đóng browser/OS đột ngột trước khi thao tác lưu local hoàn tất cũng không thể bảo đảm bằng sự kiện đóng trang. Chỉ trạng thái Đã đồng bộ và không còn pending mới thể hiện lượt gửi/nhận đã hoàn tất.

Các lượt sync được xếp hàng, không chạy chồng; thay đổi trong lúc request đang chạy sẽ có lượt theo sau. Lỗi mạng được thử lại với khoảng chờ tăng từ 10 đến tối đa 60 giây; offline đợi online. Cleanup khi đổi tài khoản/hủy provider ngăn áp dụng kết quả muộn. Web Locks theo tài khoản vẫn bảo vệ sync/import/restore khi trình duyệt hỗ trợ.

Khôi phục backup local cũng tạo thay đổi sẽ tự gửi lên cloud; dialog xác nhận đã nêu rõ điều này. Export JSON vẫn hữu ích như bản backup độc lập. Không cần SQL mới cho cơ chế tự động.

### Nhập đáp án khi ôn tập

Trước khi lật thẻ, có ô nhập để luyện nhớ chủ động: AI/semantic template và thẻ cơ bản chiều thường nhập nghĩa; chiều đảo nhập từ/cụm từ. Enter hoặc Kiểm tra đối chiếu với đáp án đã lưu, mở mặt đáp án và mở 4 mức đánh giá. Không tự chấm mức FSRS hay gọi AI. Có thể bỏ qua ô nhập và lật bằng nút/Space như trước.

So nghĩa cho phép một nghĩa riêng phân tách bằng dấu phẩy/chấm phẩy/xuống dòng, bỏ khác biệt chữ hoa và dấu câu; chưa hiểu các cách diễn đạt đồng nghĩa ngoài đáp án. So từ giữ đúng từ/cụm từ, bỏ khác biệt chữ hoa/khoảng trắng và chuẩn hóa dấu nháy. Cloze chiều thường nhập các phần bị ẩn của cùng nhóm, ngăn cách bằng dấu ;. Không suy đoán ô trả lời cho template custom thiếu trường từ/nghĩa hoặc cloze đảo chiều.

Khi đang gõ, phím Space/S/1–4 giữ vai trò nhập liệu. Sau khi kiểm tra, bỏ focus input để tiếp tục dùng phím tắt đánh giá. Ô nhập và kết quả được làm mới khi chuyển lượt hoặc lưu sửa thẻ.

### Speaking / Vocab / Reading

Header sau đăng nhập có 3 khu vực. Speaking hỗ trợ đoạn văn, giọng đọc mẫu trình duyệt, ghi âm/tải file, lưu local, lưu file riêng tư lên Google Drive và lịch sử nghe lại. Vocab giữ UI từ vựng cũ; Reading là trang Sắp có. Xem phần Speaking và Google Drive trong `supabase/README.md` để bật API, cấp scope drive.file, thêm redirect /speaking và chạy migration 007.

### Sidebar và khu vực Shadowing

Điều hướng chính được chuyển sang sidebar bên trái: Speaking (Danh sách bài shadowing `/speaking`, Luyện shadowing `/speaking/practice`), Vocab (Bộ thẻ, Ôn tập, Quản lý thẻ, Thêm từ), Reading và Cài đặt. Nhóm Speaking/Vocab thu gọn/mở rộng được; màn hình nhỏ mở sidebar bằng nút menu. Header giữ tài khoản và nút đồng bộ trong khu vực Vocab.

Trang danh sách hiển thị bản ghi cũ, tìm kiếm tên/nội dung, nghe lại, lưu Drive và Luyện lại. Luyện lại chép tên/đoạn văn vào nháp rồi mở trang luyện. Trang luyện chỉ có form luyện và bản ghi vừa tạo để nghe/lưu, không hiển thị toàn bộ lịch sử.

Kết nối Google Drive chuyển vào Cài đặt → Google Drive. Callback frontend sau cấp quyền là `/settings` (cần cho phép URL này trong Supabase Redirect URLs). Speaking chỉ dẫn tới Cài đặt khi cần cấp quyền lại. Không cần schema/SQL mới cho thay đổi bố cục này.

### Shadowing theo folder

Speaking hiện có thư mục riêng: tạo/đổi tên, lọc bài và chuyển bài giữa thư mục. Bài học được lưu độc lập với bản ghi; mỗi bài có nhiều lần ghi âm. Khi luyện, chọn folder trước và có thể bấm Lưu bài học ngay cả khi chưa ghi âm.

Chạy migration `008_shadowing_library.sql` sau 007. Schema đã chuẩn bị thành viên viewer/reviewer, lời mời, review và comment có mốc audio cho giai đoạn tiếp theo. Xem `supabase/SHADOWING.md` để biết quan hệ bảng, RLS và phần cấp quyền Drive riêng cần triển khai khi làm invite/reviewer.

### AI review bản ghi shadowing

Sau khi Dừng ghi âm hoặc tải file, thẻ bản ghi có nút **AI review** bên dưới phần nghe lại. Danh sách bài cũ → mở Các lần ghi âm cũng có nút này. Một dòng hướng dẫn trên trang Luyện shadowing giải thích vị trí nút. Chỉ khi bấm nút mới gửi audio và đoạn văn gốc tới Gemini; dùng bản audio local trước, nếu chỉ còn file Drive thì tải riêng bằng token Drive trên trình duyệt. Không gửi token Drive cho backend/Gemini.

Endpoint `POST /api/ai/review-speaking` nhận audio base64 tối đa 10 MB và đoạn văn tối đa 12.000 ký tự. JSON parser riêng 15 MB, vẫn dùng giới hạn lượt gọi /api/ai. Gemini nhận bytes âm thanh thật qua inlineData cùng reference text, dùng GEMINI_API_KEY/GEMINI_MODEL hiện tại. Một request trả transcript, nhận xét tiếng Việt, điểm coaching tham khảo (phát âm/trôi chảy/đọc đầy đủ), lỗi nghe được và gợi ý luyện. Điểm null khi không đánh giá được; audio im lặng/không thể xác minh không có điểm. Không tuyên bố thang IELTS/âm vị chuẩn hóa hoặc so ngữ điệu với audio mẫu khi chỉ có text. Các lượt review được cộng trong thống kê Gemini.

Kết quả lưu cùng bản ghi trên IndexedDB. Chạy `009_speaking_ai_review.sql` để thêm cột JSON ai_review lên speaking_recordings. Nếu bản ghi đã được lưu cloud, review được cập nhật ngay; nếu chưa thì gửi kèm lần Lưu lên Drive/Lưu lịch sử sau. Khi lỗi cloud, review local vẫn giữ, có thông báo thử lại. Human review trong shadowing_reviews vẫn tách riêng. Chưa kiểm thử với bản ghi giọng thật trên Google, các test dùng transport/audio giả lập và kiểm tra payload/schema/RLS bằng PostgreSQL nhúng.

AI review schema compatibility: chỉ gửi cấu trúc JSON gọn (object/properties/required/array/enum/nullable type array) tới Gemini; các giới hạn chuỗi/mảng/điểm vẫn được Zod kiểm tra ở backend sau generation. Kiểm tra live bằng WAV im lặng tái hiện full schema 400 INVALID_ARGUMENT; schema gọn nhận 503 UNAVAILABLE do model quá tải, nên chưa xác minh được review giọng thật thành công. Không tự chuyển model hoặc gửi lại request chấm khi gặp 503; UI hiển thị lỗi quá tải để người dùng chủ động thử lại.

## Cache từ vựng khi đọc

Bôi đen một từ hoặc cụm từ trong nội dung để mở menu gồm Thêm từ vựng, Phát âm (giọng đọc trình duyệt, không gọi AI) và Thêm vào cache. Cache là bảng IndexedDB `vocabularyCache` trong database riêng của tài khoản (version 7), giữ lại sau khi tải lại trang. Cache không tự tạo thẻ, không gửi lên Supabase và không thuộc bản export thư viện từ vựng.

Trong AI generator, Điền từ cache ghép các mục vào danh sách đang nhập, bỏ trùng và giới hạn 20 mục. Phần dư vẫn giữ trong cache cho lượt sau. Nút Danh sách cache cho xem và xóa từng mục. Điền hoặc AI gen chưa làm mất cache; chỉ các từ đầu vào đã được lưu thành thẻ thành công mới bị xóa khỏi cache.

## Chat AI tạm thời

Nút chat ở góc dưới bên phải mở một khung trò chuyện với Gemini, dùng model/key backend hiện tại. Tin nhắn chỉ giữ trong React state theo phiên đăng nhập: đóng/mở khung hoặc chuyển trang vẫn giữ, tải lại trang/đăng xuất/đổi tài khoản sẽ xóa. Không lưu lịch sử vào Supabase, IndexedDB, localStorage hoặc file máy chủ. Backend `/api/ai/chat` nhận ngữ cảnh gần đây cho từng request rồi trả câu trả lời; thống kê usage chỉ ghi model/số token/số lượt như các tính năng AI khác, không ghi nội dung chat. Nội dung gửi vẫn được Gemini xử lý theo chính sách dịch vụ của nhà cung cấp.

Client gửi tối đa 19 tin nhắn gần đây, tổng tối đa 10.000 ký tự; mỗi tin nhắn trong request tối đa 3.000 ký tự. Hỗ trợ Enter để gửi, Shift+Enter xuống dòng, dừng chờ phản hồi và xóa cuộc trò chuyện trên máy. Không có công cụ truy cập/sửa dữ liệu ứng dụng từ chat. Không cần migration hoặc biến môi trường mới; khởi động lại/deploy backend để có endpoint mới.
