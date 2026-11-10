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

Cài đặt → Tài khoản & lưu trữ Supabase: đăng ký/đăng nhập, sao lưu cloud, tải về, xuất JSON và khôi phục local. Đây là đồng bộ thủ công theo snapshot; không tự merge hoặc auto-sync nền. Từ vựng vẫn làm việc offline.

Điền VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY trong .env ở thư mục gốc (mẫu .env.example), chạy supabase/migrations/001_vocab_snapshots.sql trong SQL Editor của project, cấu hình Auth redirect rồi khởi động lại frontend. Không dùng service_role/secret key trong frontend. Hướng dẫn đầy đủ: supabase/README.md.

IndexedDB v6 thêm cloudMeta và localBackups; giữ toàn bộ dữ liệu học hiện có. Tải cloud về giữ bản backup local trước khi thay, phục hồi Date của FSRS và cài đặt. RPC + revision ngăn thiết bị cũ ghi đè bản cloud mới hơn. RLS giới hạn mỗi tài khoản với snapshot của chính mình. Chưa có kiểm tra live khi project chưa cấu hình.

### Tạo thẻ từ các dạng từ liên quan

Trong mặt sau thẻ AI, mỗi dòng dạng `effective (adj): hiệu quả` có nút **AI gen** nếu từ chưa tồn tại trong kho của tài khoản hiện tại. Bấm nút sẽ gọi AI một lần cho từ đó và tự lưu thẻ đầy đủ vào cùng thư mục với thẻ nguồn. Nếu từ đã tồn tại (kể cả trong thư mục khác), hiển thị link để mở popup xem thẻ. Đóng popup tiếp tục phiên ôn đang học; link có tham số `note` để mở lại trực tiếp.

Khi AI sửa từ hoặc chuyển về dạng gốc, liên kết từ dòng ban đầu tới ID thẻ được lưu cùng dữ liệu note và có trong snapshot cloud. Trước khi lưu, kiểm tra trùng trong transaction để tránh tạo hai thẻ khi thao tác ở nhiều tab. Các thay đổi vẫn cần bấm Sao lưu lên cloud trong Cài đặt theo cơ chế hiện tại.

### Quản lý thẻ

Bộ thẻ → menu action của folder → **Quản lý thẻ** mở `/cards?folder=<id>`. Menu action ở tiêu đề bảng mở danh sách toàn bộ. Trang này yêu cầu đăng nhập, dùng kho riêng của tài khoản hiện tại; có tìm từ/nghĩa/nhãn, lọc folder, gồm hoặc không gồm thư mục con và phân trang 20 từ vựng.

Thêm từ, xem và chỉnh sửa dùng popup. Một từ vựng có thể sinh nhiều thẻ (đảo chiều/cloze); popup xem cho chọn từng thẻ. Chỉnh sửa giữ lịch ôn. Xóa có xác nhận và xóa toàn bộ thẻ/lịch ôn/lịch sử của từ đó trong một transaction; các liên kết từ liên quan trỏ tới từ bị xóa được bỏ để có thể tạo lại. Các thay đổi cần Sao lưu lên cloud trong Cài đặt như trước.
