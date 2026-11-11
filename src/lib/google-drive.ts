import { MAX_AUDIO_BYTES, validateAudio, type SpeakingRecording } from './speaking'
const base='https://www.googleapis.com/drive/v3/files'
const app='vocab-library-speaking'
export class DriveError extends Error { reconnect:boolean; constructor(message:string,reconnect=false){super(message);this.reconnect=reconnect} }
async function checked(response:Response){
 if(response.ok)return response
 let payload:{error?:{errors?:{reason?:string}[];details?:{reason?:string;metadata?:{consumer?:string}}[]}}={}
 try{payload=await response.json()}catch{/* Some Google errors have no JSON body. */}
 const details=payload.error?.details??[]
 const reasons=[...(payload.error?.errors??[]).map(item=>item.reason),...details.map(item=>item.reason)].filter((value):value is string=>!!value)
 const has=(...values:string[])=>reasons.some(reason=>values.includes(reason))
 const consumer=details.map(item=>item.metadata?.consumer).find(value=>/^projects\/\d+$/.test(value??''))
 const project=consumer?' (project '+consumer.split('/')[1]+')':''
 if(has('SERVICE_DISABLED','accessNotConfigured'))throw new DriveError('Google Drive API chưa được bật'+project+'. Mở Google Cloud → APIs & Services → Library → Google Drive API → Enable, rồi thử lại. [SERVICE_DISABLED]')
 if(response.status===401)throw new DriveError('Phiên truy cập Google Drive đã hết hạn hoặc không hợp lệ. Vào Cài đặt và bấm Kết nối lại Google Drive. [401]',true)
 if(has('ACCESS_TOKEN_SCOPE_INSUFFICIENT','insufficientPermissions'))throw new DriveError('Phiên Google hiện tại thiếu quyền drive.file. Bấm Kết nối Google Drive và chấp nhận quyền quản lý file do ứng dụng tạo. [INSUFFICIENT_SCOPE]',true)
 if(has('storageQuotaExceeded'))throw new DriveError('Google Drive đã hết dung lượng lưu trữ. Giải phóng dung lượng rồi tải lại. [STORAGE_QUOTA]')
 if(response.status===429||has('rateLimitExceeded','userRateLimitExceeded','RATE_LIMIT_EXCEEDED'))throw new DriveError('Google Drive đang giới hạn lượt gọi. Đợi một lúc rồi thử lại. [RATE_LIMIT]')
 if(response.status===404)throw new DriveError('Không tìm thấy file Drive hoặc tài khoản hiện tại không có quyền mở file này. [404]')
 if(response.status===403)throw new DriveError('Google Drive từ chối truy cập. Kiểm tra quyền của tài khoản và chính sách Google Workspace. [403]',true)
 throw new DriveError('Google Drive chưa xử lý được yêu cầu. Kiểm tra mạng rồi thử lại. [HTTP '+response.status+']')
}
async function request(token:string,url:string,options:RequestInit={},fetcher:typeof fetch=fetch){
 if(!token)throw new DriveError('Hãy kết nối Google Drive.',true)
 return checked(await fetcher(url,{...options,headers:{...options.headers,Authorization:'Bearer '+token}}))
}
async function find(token:string,query:string,fetcher:typeof fetch){
 const url=new URL(base);url.searchParams.set('q',query+" and trashed = false");url.searchParams.set('fields','files(id,name)');url.searchParams.set('pageSize','100')
 return (await (await request(token,url.href,{},fetcher)).json()).files as {id:string;name:string}[]
}
export async function checkDrive(token:string,fetcher:typeof fetch=fetch){
 await find(token,"appProperties has { key='app' and value='"+app+"' }",fetcher)
}
export async function uploadRecording(token:string,recording:SpeakingRecording,fetcher:typeof fetch=fetch){
 if(!recording.audio)throw new Error('Không còn bản âm thanh trên máy.')
 validateAudio(recording.audio)
 if(!/^[a-zA-Z0-9-]+$/.test(recording.id))throw new Error('ID bản ghi không hợp lệ.')
 const existing=await find(token,"appProperties has { key='recordingId' and value='"+recording.id+"' } and appProperties has { key='app' and value='"+app+"' }",fetcher)
 if(existing[0])return existing[0].id
 let folder=(await find(token,"mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='app' and value='"+app+"' }",fetcher))[0]?.id
 if(!folder){
  const response=await request(token,base+'?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Vocab Library - Speaking',mimeType:'application/vnd.google-apps.folder',appProperties:{app}})},fetcher)
  folder=(await response.json()).id
 }
 const started=await request(token,'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':recording.mimeType},body:JSON.stringify({name:recording.title,parents:[folder],appProperties:{app,recordingId:recording.id},description:recording.referenceText.slice(0,12000)})},fetcher)
 const location=started.headers.get('Location')
 if(!location)throw new Error('Drive không trả địa chỉ tải file.')
 const uploadUrl=new URL(location)
 if(uploadUrl.protocol!=='https:'||!['www.googleapis.com','content.googleapis.com'].includes(uploadUrl.hostname))throw new Error('Địa chỉ tải file không hợp lệ.')
 const uploaded=await request(token,uploadUrl.href,{method:'PUT',headers:{'Content-Type':recording.mimeType},body:recording.audio},fetcher)
 const id=(await uploaded.json()).id
 if(typeof id!=='string'||!id)throw new Error('Drive chưa xác nhận file đã được lưu.')
 return id
}
export async function downloadRecording(token:string,id:string,fetcher:typeof fetch=fetch){
 const response=await request(token,base+'/'+encodeURIComponent(id)+'?alt=media',{},fetcher)
 if(Number(response.headers.get('content-length'))>MAX_AUDIO_BYTES)throw new Error('File vượt giới hạn 20 MB.')
 const blob=await response.blob();validateAudio(blob);return blob
}


export async function deleteDriveRecording(token:string,id:string,fetcher:typeof fetch=fetch){
 if(!id)throw new Error('Thiếu ID file Drive.')
 await request(token,base+'/'+encodeURIComponent(id),{method:'DELETE'},fetcher)
}
