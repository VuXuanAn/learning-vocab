import {db,type VocabDatabase} from './db'
import type {SpeakingRecording} from './speaking'
export interface RecordingDeleteServices {
 check:(id:string)=>Promise<void>
 removeFile:(id:string)=>Promise<void>
 removeMetadata:(id:string)=>Promise<void>
}
export async function removeSpeakingRecording(row:SpeakingRecording,services:RecordingDeleteServices,account:VocabDatabase=db){
 const saved=await account.speakingRecordings.get(row.id)
 const current={...row,...saved}
 if(!current.driveFileId&&!current.metadataSynced){await account.speakingRecordings.delete(row.id);return}
 await account.speakingRecordings.put({...current,deletion:current.deletion??'requested'})
 await services.check(row.id)
 if(current.driveFileId&&current.deletion!=='driveDeleted'){
  await services.removeFile(current.driveFileId)
  await account.speakingRecordings.put({...current,deletion:'driveDeleted'})
 }
 await services.removeMetadata(row.id)
 await account.speakingRecordings.delete(row.id)
}
