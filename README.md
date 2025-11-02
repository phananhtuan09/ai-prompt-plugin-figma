# AI Prompt Generator - Figma Plugin

Plugin Figma giúp tự động tạo prompt mô tả kỹ thuật bằng tiếng Anh từ Frame thiết kế, sử dụng Google Gemini AI.

## Cài đặt

1. Cài đặt dependencies:
```bash
npm install
```

2. Build plugin:
```bash
npm run build
```

### Cách 1: Import trên Figma Desktop App (Khuyến nghị - Windows/Mac)

1. Mở **Figma Desktop App**
2. Vào menu `Plugins` → `Development` → `Import plugin from manifest...`
3. Chọn file `manifest.json` trong thư mục dự án
4. Plugin sẽ xuất hiện trong danh sách plugins và có thể sử dụng ngay

### Cách 1b: Figma trên Ubuntu/Linux (Không chính thức)

Figma không có Desktop App chính thức cho Linux. Bạn có các lựa chọn:

#### Option A: Cài đặt Figma từ file .deb (Khuyến nghị)

1. **Cài đặt file .deb:**

   Cách 1: Sử dụng dpkg (command line)
   ```bash
   sudo dpkg -i figma-*.deb
   # Nếu có lỗi dependency, chạy:
   sudo apt-get install -f
   ```

   Cách 2: Sử dụng GDebi (GUI - dễ hơn)
   ```bash
   # Cài đặt GDebi nếu chưa có:
   sudo apt install gdebi
   # Mở file .deb với GDebi:
   sudo gdebi figma-*.deb
   ```

   Cách 3: Double-click file .deb trong file manager và cài đặt qua Software Center

2. **Sau khi cài đặt xong:**
   - Tìm "Figma" trong Applications menu
   - Hoặc chạy từ terminal: `figma`
   - Mở Figma và đăng nhập

3. **Import development plugin:**
   - Mở một file design trong Figma
   - Vào menu `Plugins` → `Development` → `Import plugin from manifest...`
   - Chọn file `manifest.json` trong thư mục dự án
   - Plugin sẽ xuất hiện và sẵn sàng sử dụng

**Lưu ý:** 
- File .deb thường là phiên bản không chính thức do cộng đồng phát triển
- Có thể không hoàn toàn giống với Desktop App chính thức
- Development plugins nên hoạt động tốt với phiên bản này

#### Option B: Sử dụng Figma Web với Local Server (Xem Cách 2)

### Cách 2: Import trên Figma Web (Trình duyệt) - Dành cho Ubuntu/Linux

**Lưu ý cho Ubuntu/Linux:** Vì Figma Desktop App không có trên Linux, đây là cách khả thi nhất để phát triển plugin.

**Lưu ý:** Figma Web có giới hạn trong việc chạy development plugins. Nếu có Windows/Mac, khuyến nghị sử dụng **Figma Desktop App** (Cách 1).

Hướng dẫn cho Ubuntu/Linux:

1. Build plugin (nếu chưa build):
```bash
npm run build
```

2. Chạy local server:
```bash
npm run serve
```

3. Server sẽ chạy tại: `http://localhost:8080`

4. Mở **Figma Web** trong trình duyệt (Chrome/Firefox) và mở một file design

5. Trên Figma Web, để chạy development plugin, bạn cần:
   - Mở file design trong Figma Web
   - Click vào icon **Menu** (☰) ở góc trên bên trái hoặc click chuột phải trên canvas
   - Chọn `Plugins` → `Development` (nếu có) hoặc tìm trong menu
   - Nhập URL manifest: `http://localhost:8080/manifest.json`

6. **Nếu không tìm thấy menu Development:**
   
   Trên Figma Web, development plugins có thể không hoạt động đầy đủ. Các giải pháp thay thế:
   
   - **Giải pháp 1:** Publish plugin lên Figma Community để test (xem phần Publish Plugin bên dưới)
   - **Giải pháp 2:** Sử dụng AppImage không chính thức (Option A ở trên)
   - **Giải pháp 3:** Chạy Figma Desktop App qua Wine hoặc VM (phức tạp hơn)

**Giới hạn trên Web:**
- Figma Web có thể không hỗ trợ đầy đủ tính năng development plugins
- Một số tính năng có thể không hoạt động như trên Desktop
- **Khuyến nghị:** Sử dụng Figma Desktop App để phát triển và test plugin

**Lưu ý:** 
- Đảm bảo server vẫn đang chạy khi sử dụng plugin trên web
- Server đã được cấu hình với `--cors` flag để tránh lỗi CORS
- Để dừng server, nhấn `Ctrl+C` trong terminal

## Sử dụng

1. Chọn một Frame trên canvas Figma
2. Mở plugin "AI Prompt Generator"
3. Cấu hình API Key và Model AI trong Settings (⚙️)
4. (Tùy chọn) Chọn "Bao gồm gợi ý Responsive" và nhập chiều rộng màn hình cơ sở
5. Nhấn "Tạo Prompt"
6. Sao chép kết quả bằng nút "Sao chép"

## Yêu cầu

- **Figma Desktop App** (Windows/Mac) hoặc **Figma Web** (trình duyệt - cho Ubuntu/Linux)
- **Google Gemini API Key** (lấy tại [Google AI Studio](https://makersuite.google.com/app/apikey))
- **Node.js và npm** (để build và chạy development server)
- **Trình duyệt hiện đại** (Chrome, Firefox, Edge) nếu dùng Figma Web

## Cấu trúc dự án

- `code.ts` - Plugin code chạy trong Figma sandbox
- `ui.html` - Giao diện người dùng
- `manifest.json` - Cấu hình plugin
- `package.json` - Dependencies và scripts

## Development

Chạy watch mode để tự động build khi có thay đổi:
```bash
npm run watch
```

## Publish Plugin lên Figma Community (Cho Ubuntu/Linux)

Nếu không thể chạy development plugin trên Ubuntu, bạn có thể publish plugin lên Figma Community để test:

1. **Chuẩn bị:**
   - Build plugin: `npm run build`
   - Chuẩn bị icon và mô tả cho plugin
   - Test kỹ trên môi trường có Desktop App (nếu có thể)

2. **Publish:**
   - Truy cập [Figma Community](https://www.figma.com/community)
   - Click "Publish" → "Plugin"
   - Upload các file: `manifest.json`, `code.js`, `ui.html`
   - Thêm mô tả, tags, và screenshots
   - Submit để review

3. **Test sau khi publish:**
   - Plugin sẽ xuất hiện trong Figma Community sau khi được approve
   - Bạn và người khác có thể cài đặt và sử dụng trên Figma Web
   - Để update, publish lại phiên bản mới

**Lưu ý:** Quá trình publish có thể mất vài ngày để Figma review và approve.

