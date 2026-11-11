import type { AISpeakingReview } from './speaking-review'
﻿export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file'
export const MAX_AUDIO_BYTES=20*1024*1024
export interface SpeakingRecording {
 id:string;title:string;referenceText:string;createdAt:string;durationSeconds:number;mimeType:string;size:number
 deletion?:'requested'|'driveDeleted';aiReview?:AISpeakingReview;lessonId?:string;audio?:Blob;driveFileId?:string;metadataSynced?:boolean
}
export function driveSignInOptions(origin:string,path:'/speaking'|'/settings'='/speaking'){
 if(!['/speaking','/settings'].includes(path))throw new Error('Invalid redirect path')
 const url=new URL(path,origin)
 if(!['http:','https:'].includes(url.protocol))throw new Error('Invalid app origin')
 return {provider:'google' as const,options:{redirectTo:url.href,scopes:'openid email profile '+DRIVE_SCOPE,queryParams:{prompt:'consent select_account',include_granted_scopes:'true'}}}
}
export function validateAudio(blob:Blob){
 if(!blob.size||blob.size>MAX_AUDIO_BYTES)throw new Error('Âm thanh phải có dung lượng từ 1 byte đến 20 MB.')
 if(!/^audio\/(webm|ogg|mpeg|mp3|mp4|x-m4a|wav|x-wav|wave|aac|flac)(;|$)/i.test(blob.type))throw new Error('Chọn file âm thanh WebM, OGG, MP3, M4A, WAV, AAC hoặc FLAC.')
}
export function recordingPayload(recording:SpeakingRecording,userId:string){
 if(!userId||!recording.driveFileId)throw new Error('Chưa tải file lên Drive.')
 return {id:recording.id,user_id:userId,...(recording.lessonId?{lesson_id:recording.lessonId}:{}),...(recording.aiReview?{ai_review:recording.aiReview}:{}),title:recording.title,reference_text:recording.referenceText,drive_file_id:recording.driveFileId,mime_type:recording.mimeType,byte_size:recording.size,duration_seconds:recording.durationSeconds,created_at:recording.createdAt}
}
