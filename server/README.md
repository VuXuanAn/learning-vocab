# Backend Gemini cho Vocab Library

Node.js 22.23+ / Express / Google Gen AI SDK. Backend mặc định chỉ lắng nghe tại 127.0.0.1:4100. Dữ liệu từ vựng và thư mục vẫn lưu trong IndexedDB; backend chỉ xử lý yêu cầu AI.

## Cấu hình

Lấy key tại https://aistudio.google.com/apikey rồi điền trong `server/.env`:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash-lite
PORT=4100
FRONTEND_ORIGIN=http://localhost:5173
```

Có thể dùng GOOGLE_API_KEY nếu chưa đặt GEMINI_API_KEY. Model mặc định có free tier theo bảng giá Google tại thời điểm tích hợp; quyền truy cập và quota thực tế phụ thuộc project. Không tự chuyển model hay nhà cung cấp khi lỗi. OPENAI_API_KEY/OPENAI_MODEL cũ được giữ trong file nếu đã có nhưng không được sử dụng.

Key giữ ở backend, không dùng VITE_* hoặc gửi key vào chat. `.env` không được commit. Sau khi thay key/model, dừng và khởi động lại backend để đọc cấu hình mới.

## Chạy

```powershell
npm.cmd run dev
```

Chạy cả API :4100 và Vite :5173. Có thể chạy riêng `npm.cmd run dev:server` và `npm.cmd run dev:client`. Dừng bằng Ctrl+C.

Chạy bản build:

```powershell
npm.cmd run build
npm.cmd start
```

Mở http://127.0.0.1:4100. Vite/preview proxy /api sang backend khi dùng cổng 5173/4173.

## API

- GET /api/health: status, provider=gemini, aiConfigured và model. aiConfigured chỉ xác nhận đã có key, không xác nhận key/quota hợp lệ.
- POST /api/ai/generate-batch: words[], sourceFieldId, fields[{id,name}]. Trả rows[{index,values}] và usage{inputTokens,outputTokens}.
- POST /api/ai/generate: giữ endpoint một từ cũ, hiện cũng dùng Gemini.

Cả danh sách dùng một lần gọi Gemini generateContent, không vòng lặp từng từ, không tự retry. JSON Schema dùng chung; backend kiểm tra đủ dòng và field trước khi trả bảng. Giới hạn 20 từ, 20 trường, 200 ô và 64KB request; 10 request/phút/IP; timeout 45 giây.

Gemini trả token usage; output bao gồm token câu trả lời và thinking nếu có. Chi phí phụ thuộc model, tier và quota project. Không có web grounding, không gọi audio API. Giọng đọc trong ứng dụng vẫn dùng trình duyệt.

Phân biệt lỗi thiếu key, key/quyền không hợp lệ, model không khả dụng, quota và timeout. Không chuyển nguyên thông báo lỗi provider chứa dữ liệu nhạy cảm cho frontend. Không đưa backend local này lên mạng công khai trước khi bổ sung xác thực và hạn mức theo người dùng.

## Kiểm tra

```powershell
npm.cmd run build
npm.cmd run test:server
```

Tests giả lập Gemini và transport Google SDK, không tiêu tốn quota. Cần key thật để xác nhận kết nối thực tế.

Tài liệu chính thức: https://ai.google.dev/gemini-api/docs/pricing và https://googleapis.github.io/js-genai/
