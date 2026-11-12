export interface GrammarSource {
 pattern?:string
 exactSelection?:boolean
 articleId:string
 articleTitle:string
 contentHtml:string
 quote:string
 start:number
 end:number
 highlights:{start:number;end:number}[]
}
export function grammarTokens(quote:string){
 return [...quote.matchAll(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'’-]*/gu)].map(match=>({text:match[0],start:match.index,end:match.index+match[0].length}))
}
export function grammarPattern(quote:string,chosen:Set<number>){
 const tokens=grammarTokens(quote);let previous=-1
 return tokens.flatMap((token,index)=>{
  if(!chosen.has(index))return []
  const prefix=previous<0?'':index===previous+1?' ':' … ';previous=index
  return [prefix+token.text]
 }).join('')
}

// Match only literal words and common inflections; fuzzy spelling never selects a highlight.
function sameGrammarWord(surface:string,base:string){
 surface=surface.toLowerCase();base=base.toLowerCase()
 const forms=new Set([base,base+'s',base+'es',base+'ed',base+'ing'])
 if(base.endsWith('e')){forms.add(base+'d');forms.add(base.slice(0,-1)+'ing')}
 if(/[^aeiou]y$/.test(base)){forms.add(base.slice(0,-1)+'ies');forms.add(base.slice(0,-1)+'ied')}
 if(/[aeiou][b-df-hj-np-tv-z]$/.test(base)&&!/[wxy]$/.test(base)){forms.add(base+base.at(-1)+'ed');forms.add(base+base.at(-1)+'ing')}
 const irregular:Record<string,string[]>={be:['am','is','are','was','were','been'],have:['has','had'],do:['does','did','done'],go:['went','gone'],take:['took','taken'],make:['made'],give:['gave','given'],get:['got','gotten'],keep:['kept'],break:['broke','broken'],write:['wrote','written'],speak:['spoke','spoken']}
 return forms.has(surface)||(irregular[base]??[]).includes(surface)
}
export function grammarKeywordIndices(quote:string,structure:string){
 const words=grammarTokens(structure).filter(token=>! /^(?:S|V|O|N|NP|VP|Adj|Adv|sb|sth|someone|something|somebody|oneself)$/.test(token.text))
 const tokens=grammarTokens(quote),chosen=new Set<number>();let cursor=0
 if(!words.length)return chosen
 for(const word of words){
  const index=tokens.findIndex((token,index)=>index>=cursor&&sameGrammarWord(token.text,word.text))
  if(index<0)return new Set<number>()
  chosen.add(index);cursor=index+1
 }
 return chosen
}
export function grammarHighlightRanges(source:GrammarSource,structure=source.pattern??''){
 if(source.exactSelection)return source.highlights
 const tokens=grammarTokens(source.quote)
 const allSelected=tokens.length>0&&tokens.every(token=>source.highlights.some(range=>range.start<=source.start+token.start&&range.end>=source.start+token.end))
 if(allSelected){
  const keywords=grammarKeywordIndices(source.quote,structure)
  if(keywords.size&&keywords.size<tokens.length)return tokens.filter((_,index)=>keywords.has(index)).map(token=>({start:source.start+token.start,end:source.start+token.end}))
 }
 return source.highlights
}
