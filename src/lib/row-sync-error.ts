export function contextualSyncError(error: { code?: string; message?: string }, table: string, operation: string) {
  return Object.assign(new Error(error.message || 'Supabase request failed'), error, { table, operation })
}
export function rowSyncErrorMessage(error: unknown) {
  const detail = error as { code?: string; table?: string; operation?: string }
  if (detail?.code === 'OFFLINE') return 'Đang mất mạng. Dữ liệu được giữ trên máy và sẽ tự đồng bộ khi kết nối trở lại.'
  if (['42P01', 'PGRST205'].includes(detail?.code ?? '') && ['grammar_folders', 'grammar_entries'].includes(detail?.table ?? '')) return 'Chưa có bảng Grammar trên Supabase. Hãy chạy 013_grammar_library.sql trong SQL Editor rồi bấm đồng bộ lại. Dữ liệu trên máy được giữ nguyên.'
  if (['42P01', 'PGRST205', 'PGRST202', '42883', '42703'].includes(detail?.code ?? '')) return 'Thiếu bảng hoặc hàm đồng bộ. Hãy chạy migrations 002, 003 và 005 trên Supabase (bỏ qua file đã chạy).'
  if (detail?.code === '42501' && detail.table === 'folders' && detail.operation === 'insert') return 'Supabase chặn tạo folder. Hãy chạy file 006_fix_folder_insert_rls.sql rồi bấm Đồng bộ lại ở header. Folder đang tạo vẫn được giữ trên máy.'
  if (detail?.code === 'LOCAL_CHANGED_DURING_DOWNLOAD') return 'Dữ liệu trên máy vừa thay đổi trong lúc tải. Chưa thay dữ liệu local; hãy hoàn tất chỉnh sửa rồi tải lại.'
  if (detail?.code === 'UPLOAD_UNAVAILABLE') return 'Dữ liệu đã bị xóa trên server hoặc quyền truy cập đã đổi. Hãy chọn Đồng bộ hai chiều; thay đổi trên máy vẫn được giữ.'
  if (detail?.code === '42501') return 'Supabase từ chối truy cập dữ liệu. Kiểm tra quyền tài khoản và cấu hình RLS; thay đổi chưa gửi vẫn được giữ trên máy.'
  return 'Chưa đồng bộ được từ vựng. Thay đổi được giữ trên máy. Bấm Đồng bộ ở header để gửi lại.'
}
