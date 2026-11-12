export function grammarImportPrompt(topic:string){
 return `Hãy soạn một bài ngữ pháp tiếng Anh về: ${topic.trim()||'[ĐIỀN CHỦ ĐỀ NGỮ PHÁP]'}.

Giải thích bằng tiếng Việt, dùng ví dụ tiếng Anh kèm bản dịch. Tự chọn bố cục phù hợp: ý nghĩa, cấu trúc, cách dùng, so sánh hoặc lỗi dễ nhầm. Trình bày dễ đọc, có hệ thống; không cần ép mọi chủ đề theo cùng một mẫu.

Ưu tiên ngắn gọn, độ dài tương xứng với phạm vi chủ đề. Với một từ, cụm động từ hoặc cấu trúc nhỏ như “work out”, “get to + V”: tối đa 1.000 từ cho phần nội dung nhìn thấy (không tính thẻ HTML), gồm ý nghĩa/cách dùng chính và 1–3 ví dụ ngắn kèm dịch. Với “work out”, chọn 2–3 nghĩa thông dụng nhất, mỗi nghĩa tối đa một ví dụ; không liệt kê mọi nghĩa hiếm hay mọi biến thể. Chỉ thêm một lưu ý thật cần thiết nếu dễ dùng sai. Với các thì hoặc chủ đề ngữ pháp dài, rộng như câu điều kiện, giới hạn tối đa 2.000 từ cho phần nội dung nhìn thấy (không tính thẻ HTML). Đây là giới hạn trên, không phải độ dài bắt buộc; chỉ viết đủ ý và tránh kéo dài nội dung để đạt giới hạn.

Chỉ tạo các phần thực sự cần thiết; bỏ phần rỗng hoặc lặp lại ý. Không tạo bài dẫn nhập, kết luận, tóm tắt, ghi chú riêng hoặc bài tập. Không tự mở rộng sang ngữ pháp liên quan, so sánh dài hay bảng chia đủ các thì/thể cho một cụm từ đơn giản. Ưu tiên trình bày bằng bảng gọn: gom nghĩa/cách dùng, cấu trúc và ví dụ kèm dịch vào các cột phù hợp để dễ so sánh. Với cụm từ như “work out”, mỗi nghĩa thông dụng là một hàng; tránh lặp lại nội dung bảng thành các đoạn văn dài. Mỗi ô chỉ chứa thông tin ngắn gọn, cần thiết. Danh sách định dạng Tiptap bên dưới là các lựa chọn có thể dùng, không phải yêu cầu phải sử dụng hết.

Không đánh số bất kỳ tiêu đề hoặc tiêu đề con nào (h1–h6): dùng “Cách dùng”, “Ví dụ”, không thêm tiền tố như “1.”, “I.”, “A.” hoặc “Phần 1”. Mỗi phần phải có tiêu đề riêng và nội dung độc lập để tôi có thể dễ dàng xóa phần AI tạo thừa sau khi review mà không cần sửa lại số thứ tự các phần còn lại.

Nếu ngữ pháp có nhiều dạng hoặc biến thể, ưu tiên trình bày trong bảng để dễ so sánh. Với các thể khẳng định, phủ định và câu hỏi Yes/No, gom gọn vào cùng một bảng với các cột phù hợp như “Thể”, “Cấu trúc”, “Ví dụ” và “Nghĩa tiếng Việt”. Nhóm các dạng tương ứng theo hàng; chỉ đưa vào những thể thực sự áp dụng cho ngữ pháp đang giải thích. Các lưu ý chung đặt ngoài bảng để bảng ngắn gọn, dễ đọc.

Đầu ra: đúng một đối tượng JSON hợp lệ có hai trường:
- "name": tên ngữ pháp, tối đa 160 ký tự.
- "contentHtml": nội dung HTML để import vào trình soạn thảo Tiptap của ứng dụng, tối đa 1.500.000 ký tự.
Dùng JSON.stringify hoặc escape dấu nháy kép và xuống dòng đúng chuẩn JSON. Trả trực tiếp JSON, không bọc trong Markdown hay thêm lời dẫn.

Các định dạng mà trình soạn thảo này hỗ trợ:
1. Đoạn văn p, tiêu đề h1–h6, ngắt dòng br; strong/b, em/i, u, s, sup, sub.
2. Danh sách ul/ol/li, trích dẫn blockquote, mã nội dòng code, khối mã pre/code, đường phân cách hr.
3. Font trên span: font-family (Arial, Times New Roman, Georgia, Verdana, Tahoma, Courier New); font-size (12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64px); color và background-color (mã hex hoặc rgb). Dùng màu vừa phải, dễ đọc.
4. Tô sáng: <mark data-color="#fef08a" style="background-color: #fef08a">nội dung</mark>.
5. Căn lề trên p/h1–h6: style="text-align: left|center|right|justify"; giãn dòng style="line-height: 1.5"; thụt lề style="margin-left: 2em" (các mức 0–16em, bước 2em).
6. Bảng table/tbody/tr/th/td, có thể dùng colspan và rowspan để gộp ô. Ưu tiên bảng gọn để so sánh cấu trúc hoặc ví dụ.
7. Checklist theo đúng cấu trúc: <ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Việc cần nhớ</p></div></li></ul>. Đánh dấu hoàn thành bằng data-checked="true" và thuộc tính checked trên input.
8. Liên kết a với href https://... hoặc http://...; ảnh img với src là URL ảnh https://..., alt mô tả ảnh, width/height là số pixel nếu có ảnh phù hợp. Chỉ dùng ảnh khi có URL ảnh thật được cung cấp.
Chỉ sử dụng các thẻ, thuộc tính và định dạng nêu trên. Nội dung là HTML fragment, không cần html/head/body, CSS class, script, iframe hoặc CSS bố cục. Mã HTML phải hợp lệ để chỉnh sửa được sau khi import.

Ví dụ định dạng đầu ra (thay nội dung theo chủ đề):
${JSON.stringify({name:'Tên ngữ pháp',contentHtml:'<h2>Ý nghĩa</h2><p>Giải thích bằng tiếng Việt.</p><h2>Ví dụ</h2><p><strong>Câu ví dụ tiếng Anh.</strong><br>Bản dịch tiếng Việt.</p>'},null,2)}`
}
