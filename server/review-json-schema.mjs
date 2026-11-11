// Gemini accepts a JSON Schema subset. Keep rich validation in Zod after
// generation, while sending only the structural contract to the model.
export function reviewGenerationSchema(value){
 if(Array.isArray(value))return value.map(reviewGenerationSchema)
 if(!value||typeof value!=='object')return value
 const output={}
 for(const key of ['type','description','enum','required','additionalProperties'])if(key in value)output[key]=value[key]
 if(value.properties)output.properties=Object.fromEntries(Object.entries(value.properties).map(([key,child])=>[key,reviewGenerationSchema(child)]))
 if(value.items)output.items=reviewGenerationSchema(value.items)
 if(value.anyOf){
  const branches=value.anyOf.map(reviewGenerationSchema)
  if(branches.every(branch=>typeof branch.type==='string'&&Object.keys(branch).length===1))output.type=branches.map(branch=>branch.type)
  else output.anyOf=branches
 }
 return output
}
