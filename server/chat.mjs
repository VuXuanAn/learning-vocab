import { z } from 'zod'
import { GenerationError } from './generate.mjs'
export const chatSchema=z.object({messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().trim().min(1).max(3000)}).strict()).min(1).max(19)}).strict().superRefine((value,ctx)=>{
 if(value.messages.reduce((sum,message)=>sum+message.content.length,0)>10000)ctx.addIssue({code:'custom',message:'Conversation too long'})
 if(value.messages.at(-1)?.role!=='user'||value.messages.some((message,index)=>message.role!==(index%2===0?'user':'assistant')))ctx.addIssue({code:'custom',message:'Invalid message order'})
})
export async function chatReply(client,model,request){
 const response=await client.responses.create({model,store:false,max_output_tokens:2200,input:'',messages:request.messages,instructions:'You are a helpful AI assistant in an English-learning app for a Vietnamese learner. Reply in Vietnamese by default, or in the language the user requests. Explain vocabulary, grammar, sentence structures, reading and speaking clearly with concise examples when useful. Be honest about uncertainty and do not fabricate citations or claim to access the app database, account, audio, files, or change flashcards. This conversation has no tools or access to other app data. Respond in plain text, no HTML. Return only the requested JSON object with a reply string.',text:{format:{schema:{type:'object',properties:{reply:{type:'string'}},required:['reply'],additionalProperties:false}}}})
 if(response.status!=='completed'||!response.output_text)throw new GenerationError('AI chưa trả lời xong. Hãy thử lại với câu hỏi ngắn hơn.')
 let payload;try{payload=JSON.parse(response.output_text)}catch{throw new GenerationError('AI trả lời chưa đúng định dạng. Hãy thử lại.')}
 const parsed=z.object({reply:z.string().trim().min(1).max(10000)}).strict().safeParse(payload)
 if(!parsed.success)throw new GenerationError('Phản hồi AI chưa hợp lệ. Hãy thử lại.')
 return parsed.data
}
