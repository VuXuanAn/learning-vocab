import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'
const blank = () => ({ requests: 0, failures: 0, inputTokens: 0, outputTokens: 0, missingUsage: 0 })
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0
const dayKey = date => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)
export function createUsageStore({ file, now = () => new Date() } = {}) {
  let data = {version:1,startedAt:now().toISOString(),days:{}}
  let storageError = false
  if (file && existsSync(file)) {
    try {
      const saved=JSON.parse(readFileSync(file,'utf8'))
      if(saved.version!==1 || !saved.days || typeof saved.days!=='object' || !Number.isFinite(Date.parse(saved.startedAt))) throw new Error('Invalid usage file')
      for(const [day,models] of Object.entries(saved.days)) {
        if(!/^\d{4}-\d{2}-\d{2}$/.test(day) || !models || typeof models!=='object')throw new Error('Invalid usage day')
        for(const metrics of Object.values(models))if(!metrics || Object.keys(blank()).some(key=>!Number.isSafeInteger(metrics[key])||metrics[key]<0))throw new Error('Invalid metrics')
      }
      data=saved
    } catch { storageError=true }
  }
  function record(model, usage, failed=false, at=now()) {
    const day=dayKey(at)
    const models=data.days[day] ??= {}
    const row=models[model] ??= blank()
    row.requests++; if(failed)row.failures++
    if(usage && Number.isSafeInteger(usage.input_tokens) && usage.input_tokens>=0 && Number.isSafeInteger(usage.output_tokens) && usage.output_tokens>=0) {
      row.inputTokens+=usage.input_tokens;row.outputTokens+=usage.output_tokens
    } else row.missingUsage++
    if(file) {
      try {mkdirSync(dirname(file),{recursive:true});writeFileSync(file+'.tmp',JSON.stringify(data),'utf8');renameSync(file+'.tmp',file)}
      catch {storageError=true}
    }
  }
  function summary(model) {
    const day=dayKey(now()),month=day.slice(0,7),monthly=blank()
    for(const [key,models] of Object.entries(data.days))if(key.startsWith(month)){
      const row=models[model]
      if(row)for(const metric of Object.keys(monthly))monthly[metric]+=count(row[metric])
    }
    const result=row=>({...row,totalTokens:row.inputTokens+row.outputTokens})
    return {model,timezone:'Asia/Ho_Chi_Minh',day,month,startedAt:data.startedAt,storageError,today:result({...blank(),...data.days[day]?.[model]}),monthUsage:result(monthly),quotaRemaining:null,scope:'backend',storageMode:file?'file':'memory'}
  }
  return {record,summary}
}
export function meteredClient(client, store) {
  if(!client)return null
  return {responses:{create:async request=>{
    try {
      const result=await client.responses.create(request)
      store.record(request.model,result.usage,result.status!=='completed')
      return result
    } catch(error){store.record(request.model,undefined,true);throw error}
  }}}
}
