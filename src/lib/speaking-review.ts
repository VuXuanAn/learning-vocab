import { z } from 'zod'
const score=z.number().min(0).max(100).nullable()
export const aiSpeakingReviewSchema=z.object({scoreScale:z.union([z.literal(10),z.literal(100)]).default(100),review:z.object({evaluable:z.boolean(),transcript:z.string().max(16000),summary:z.string().max(3000),scores:z.object({pronunciation:score,fluency:score,completeness:score}),issues:z.array(z.object({expected:z.string().max(500),heard:z.string().max(500),category:z.enum(['omission','insertion','pronunciation','pausing','other']),feedback:z.string().max(1000),timestampSeconds:z.number().min(0).max(1800).nullable()})).max(30),practiceTips:z.array(z.string().max(1000)).max(8),warnings:z.array(z.string().max(1000)).max(5)}),model:z.string(),createdAt:z.string(),usage:z.object({inputTokens:z.number(),outputTokens:z.number()}).nullable(),referenceText:z.string().optional()}).refine(report=>Object.values(report.review.scores).every(score=>score===null||score<=report.scoreScale),{message:'Score exceeds scale'})
export type AISpeakingReview=z.infer<typeof aiSpeakingReviewSchema>
export function audioMime(type:string){
 const mime=type.split(';')[0].toLowerCase()
 return ({'audio/mp3':'audio/mpeg','audio/x-m4a':'audio/mp4','audio/x-wav':'audio/wav','audio/wave':'audio/wav'} as Record<string,string>)[mime]??mime
}
export async function audioBase64(blob:Blob){
 const configured=Number(import.meta.env?.VITE_MAX_REVIEW_AUDIO_MB||10)
 const maxMB=Number.isFinite(configured)&&configured>0?Math.min(configured,10):10
 if(!blob.size||blob.size>maxMB*1024*1024)throw new Error(`AI review hỗ trợ file tối đa ${maxMB} MB. Hãy ghi đoạn ngắn hơn hoặc dùng file nén MP3/WebM.`)
 return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Không đọc được âm thanh.'));reader.readAsDataURL(blob)})
}

export function storedSpeakingReview(value:unknown){const result=aiSpeakingReviewSchema.safeParse(value);return result.success?result.data:undefined}

export function speakingScores10(report:AISpeakingReview){
 const convert=(value:number|null)=>!report.review.evaluable||value===null?null:Math.round(value*10/report.scoreScale*10)/10
 return {pronunciation:convert(report.review.scores.pronunciation),fluency:convert(report.review.scores.fluency),completeness:convert(report.review.scores.completeness)}
}
// Overall coaching score is the mean of available dimensions, never a fabricated zero.
export function speakingOverall10(report:AISpeakingReview){
 const values=Object.values(speakingScores10(report)).filter((value):value is number=>value!==null)
 return values.length?Math.round(values.reduce((sum,value)=>sum+value,0)/values.length*10)/10:null
}
export function latestLessonScores(recordings:{id:string;lessonId?:string;aiReview?:unknown}[]){
 const latest=new Map<string,AISpeakingReview>()
 for(const recording of recordings){const report=storedSpeakingReview(recording.aiReview);if(!report)continue;const id=recording.lessonId??recording.id;const previous=latest.get(id);if(!previous||Date.parse(report.createdAt)>Date.parse(previous.createdAt))latest.set(id,report)}
 return new Map([...latest].map(([id,report])=>[id,speakingOverall10(report)]))
}
