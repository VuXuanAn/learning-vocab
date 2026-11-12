// Run with node scripts/build-irregular-ipa.mjs. Only the catalog subset is shipped.
import fs from 'node:fs/promises'
const source = await fs.readFile('src/lib/irregular-verbs.ts', 'utf8')
const rows = source.match(/const rows = `([\s\S]*?)`/)[1].split('\n')
const forms = [...new Set(rows.flatMap(row => row.split('|').slice(0, 3).flatMap(value => value.split(' / '))))]
const upstream = 'https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/'
const [dictionary, license] = await Promise.all(['data/en_US.txt', 'LICENSE'].map(async path => {
 const response = await fetch(upstream + path)
 if (!response.ok) throw new Error(`${path}: ${response.status}`)
 return response.text()
}))
const dictionaryMap = new Map(dictionary.trim().split('\n').map(line => line.split('\t')))
// Reviewed US forms missing from the upstream word list, plus verb-specific homographs.
const reviewed = {
 awoken:'əˈwoʊkən', backslid:'ˈbækˌslɪd', backslidden:'ˈbækˌslɪdən',
 bespoken:'bɪˈspoʊkən', betted:'ˈbɛtɪd', browbeaten:'ˈbraʊˌbitən',
 chid:'tʃɪd', chidden:'ˈtʃɪdən', cleaved:'klivd', cloven:'ˈkloʊvən',
 daydreamt:'ˈdeɪˌdrɛmt', forbear:'fɔrˈbɛr', forbore:'fɔrˈbɔr', forborne:'fɔrˈbɔrn', forewent:'fɔrˈwɛnt',
 girded:'ˈɡɝdɪd', hewed:'hjud', kneeled:'nild', laded:'ˈleɪdɪd',
 mown:'moʊn', partook:'pɑrˈtʊk', partaken:'pɑrˈteɪkən', rend:'rɛnd',
 sawn:'sɔn', slink:'slɪŋk', slunk:'slʌŋk', spelt:'spɛlt', spoilt:'spɔɪlt',
 stridden:'ˈstrɪdən', sunburnt:'ˈsʌnˌbɝnt', waked:'weɪkt', wetted:'ˈwɛtɪd',
 // These have other pronunciations as nouns or regular verbs.
 read:'rid', wind:'waɪnd', wound:'waʊnd', learned:'lɝnd', lead:'lid', tear:'tɛr', sow:'soʊ', mow:'moʊ',
 misread:'ˌmɪsˈrid', reread:'ˌriˈrid', preread:'ˌpriˈrid', 'lip-read':'ˈlɪpˌrid', proofread:'ˈprufˌrid',
 begin:'bɪˈɡɪn', began:'bɪˈɡæn', begun:'bɪˈɡʌn', do:'du', did:'dɪd', done:'dʌn',
 unlearned:'ˌʌnˈlɝnd', relaid:'ˌriˈleɪd',
}
const prefixes = [
 ['quick-','ˌkwɪk'], ['cross','ˌkrɔs'], ['frost','ˈfrɔst'], ['hand-','ˈhænd'], ['hand','ˈhænd'],
 ['lip-','ˈlɪp'], ['inter','ˌɪntər'], ['under','ˌʌndər'], ['over','ˌoʊvər'],
 ['mis','ˌmɪs'], ['out','ˌaʊt'], ['pre','ˌpri'], ['re','ˌri'], ['un','ˌʌn'],
]
const result = {}, derived = []
function firstIpa(value) { return value.split(',')[0].trim().replace(/^\//,'').replace(/\/$/,'') }
function lookup(word, nested = false) {
 if (reviewed[word]) return reviewed[word]
 if (dictionaryMap.has(word)) return firstIpa(dictionaryMap.get(word))
 for (const [prefix, ipa] of prefixes) {
  if (!word.startsWith(prefix)) continue
  const stem = lookup(word.slice(prefix.length), true)
  if (!stem) continue
  if (!nested) derived.push(word)
  return ipa + (/[ˈˌ]/u.test(stem) ? stem : 'ˈ' + stem)
 }
 return ''
}
for (const word of forms) {
 const ipa = lookup(word)
 if (!ipa) throw new Error('Missing pronunciation: ' + word)
 result[word] = '/' + ipa + '/'
}
await fs.writeFile('src/lib/irregular-ipa.ts', '// General American IPA. Source: open-dict-data/ipa-dict (MIT).\n// Includes reviewed forms and compound pronunciations; regenerate with scripts/build-irregular-ipa.mjs.\nexport const irregularIpa: Record<string, string> = ' + JSON.stringify(result, null, 2) + '\n')
await fs.mkdir('third-party', {recursive:true})
await fs.writeFile('third-party/ipa-dict-LICENSE.txt', license)
console.log(`Saved ${forms.length} pronunciations (${derived.length} compounds composed from prefix + stem).`)
