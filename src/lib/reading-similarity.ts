export interface VocabCandidate {noteId:string;word:string;meaning:string;reason:string}
export interface ReadingSuggestion {word:string;occurrences:{start:number;end:number;context:string}[];candidates:VocabCandidate[]}
const irregular:Record<string,string[]>={be:['am','is','are','was','were','been','being'],have:['has','had'],do:['does','did','done'],go:['goes','went','gone'],get:['gets','got','gotten'],make:['made'],take:['took','taken'],come:['came'],see:['saw','seen'],say:['said'],think:['thought'],buy:['bought'],bring:['brought'],teach:['taught'],catch:['caught'],write:['wrote','written'],read:['read'],speak:['spoke','spoken'],eat:['ate','eaten'],drink:['drank','drunk'],run:['ran'],begin:['began','begun'],give:['gave','given'],know:['knew','known'],find:['found'],feel:['felt'],leave:['left'],keep:['kept'],tell:['told'],hear:['heard'],meet:['met'],build:['built'],send:['sent'],stand:['stood'],understand:['understood'],hold:['held'],lose:['lost'],pay:['paid'],sit:['sat'],sleep:['slept'],rise:['rose','risen'],arise:['arose','arisen'],break:['broke','broken'],choose:['chose','chosen'],drive:['drove','driven'],fall:['fell','fallen'],forget:['forgot','forgotten'],grow:['grew','grown'],wear:['wore','worn'],child:['children'],person:['people'],man:['men'],woman:['women'],foot:['feet'],tooth:['teeth'],mouse:['mice']}
function forms(base:string){
 const values=new Set([...(irregular[base]??[]),base+'s',base+'ed',base+'ing'])
 if(/(?:s|x|z|ch|sh|o)$/.test(base))values.add(base+'es')
 if(/[^aeiou]y$/.test(base)){values.add(base.slice(0,-1)+'ies');values.add(base.slice(0,-1)+'ied')}
 if(base.endsWith('e')){values.add(base+'d');if(!base.endsWith('ee'))values.add(base.slice(0,-1)+'ing')}
 if(base.endsWith('ie'))values.add(base.slice(0,-2)+'ying')
 // Include doubled-consonant spellings as suggestions; the learner confirms them.
 if(/[aeiou][b-df-hj-np-tv-z]$/.test(base)&&!/[wxy]$/.test(base)){values.add(base+base.at(-1)+'ed');values.add(base+base.at(-1)+'ing')}
 if(base.endsWith('f'))values.add(base.slice(0,-1)+'ves')
 if(base.endsWith('fe'))values.add(base.slice(0,-2)+'ves')
 return values
}
// Bounded edit distance, including adjacent transpositions.
function distance(a:string,b:string,max:number){
 if(Math.abs(a.length-b.length)>max)return max+1
 let before:number[]|undefined,previous=Array.from({length:b.length+1},(_,i)=>i)
 for(let i=1;i<=a.length;i++){
  const row=[i];let minimum=i
  for(let j=1;j<=b.length;j++){
   let value=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1))
   if(before&&i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])value=Math.min(value,before[j-2]+1)
   row[j]=value;minimum=Math.min(minimum,value)
  }
  if(minimum>max)return max+1
  before=previous;previous=row
 }
 return previous[b.length]
}
export function createReadingSimilarity(words:{noteId:string;word:string;meaning:string}[]){
 const inflections=new Map<string,VocabCandidate[]>(),buckets=new Map<number,typeof words>()
 for(const entry of words){
  const base=entry.word.toLowerCase()
  if(!/^[a-z]+$/.test(base))continue
  const bucket=buckets.get(base.length)??[];bucket.push(entry);buckets.set(base.length,bucket)
  for(const form of forms(base)){const list=inflections.get(form)??[];list.push({...entry,reason:'Dạng biến thể'});inflections.set(form,list)}
 }
 return (word:string)=>{
  const token=word.toLowerCase(),found=new Map<string,VocabCandidate&{score:number}>()
  for(const entry of inflections.get(token)??[])found.set(entry.noteId,{...entry,score:0})
  if(token.length>=5){
   const probes=new Set([token])
   if(token.endsWith('ing')){probes.add(token.slice(0,-3));probes.add(token.slice(0,-3)+'e')}
   if(token.endsWith('ed')){probes.add(token.slice(0,-2));probes.add(token.slice(0,-1))}
   if(token.endsWith('s'))probes.add(token.slice(0,-1))
   for(const probe of probes){
    if(probe.length<4)continue
    const max=probe.length>=8?2:1
    for(let length=probe.length-max;length<=probe.length+max;length++)for(const entry of buckets.get(length)??[]){
     if(found.has(entry.noteId)||entry.word[0].toLowerCase()!==probe[0])continue
     const delta=distance(probe,entry.word.toLowerCase(),max)
     if(delta<=max&&delta/Math.max(probe.length,length)<=0.22)found.set(entry.noteId,{...entry,reason:'Gần giống · cần kiểm tra',score:delta+1})
    }
   }
  }
  return [...found.values()].sort((a,b)=>a.score-b.score||a.word.localeCompare(b.word)||a.noteId.localeCompare(b.noteId)).slice(0,5).map(({score,...entry})=>{void score;return entry})
 }
}
