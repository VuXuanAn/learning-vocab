import { irregularIpa } from './irregular-ipa'

export type IrregularVerb = { base: string; past: string; participle: string; meaning: string }
export type VerbForm = 'base' | 'past' | 'participle'

export function verbPronunciations(verb: IrregularVerb, form: VerbForm) {
 return verb[form].split(' / ').map(word => {
  // The past forms of read (including compounds) are /rɛd/, not /rid/.
  const pastRead = form !== 'base' && word.endsWith('read')
  const ipa = pastRead ? irregularIpa[word]?.replace(/rid(?=\/$)/u, 'rɛd') : irregularIpa[word]
  return { word, ipa, speechText: pastRead ? word.replace(/read$/, 'red') : word }
 })
}

// Reference data only: deliberately separate from notes, cards and review storage.
// Forms cross-checked against IDP: https://ielts.idp.com/vietnam/about/news-and-articles/article-irregular-verbs
const rows = `abide|abode / abided|abode / abided|lưu trú, lưu lại
arise|arose|arisen|phát sinh
awake|awoke|awoken|đánh thức, thức
backslide|backslid|backslidden / backslid|tái phạm
be|was / were|been|thì, là, bị, ở
bear|bore|borne / born|mang, chịu đựng
beat|beat|beaten / beat|đánh, đập
become|became|become|trở nên
befall|befell|befallen|xảy đến
begin|began|begun|bắt đầu
behold|beheld|beheld|ngắm nhìn
bend|bent|bent|bẻ cong
beset|beset|beset|bao quanh
bespeak|bespoke|bespoken|chứng tỏ
bet|bet / betted|bet / betted|đánh cược
bid|bid|bid|trả giá
bind|bound|bound|buộc, trói
bite|bit|bitten|cắn
bleed|bled|bled|chảy máu
blow|blew|blown|thổi
break|broke|broken|đập vỡ
breed|bred|bred|sinh sản, gây giống
bring|brought|brought|mang đến
broadcast|broadcast|broadcast|phát thanh
browbeat|browbeat|browbeaten / browbeat|hăm dọa
build|built|built|xây dựng
burn|burnt / burned|burnt / burned|đốt, cháy
burst|burst|burst|nổ tung, vỡ òa
bust|busted / bust|busted / bust|làm bể, làm vỡ
buy|bought|bought|mua
cast|cast|cast|ném, tung
catch|caught|caught|bắt, chụp
chide|chid / chided|chid / chidden / chided|mắng, chửi
choose|chose|chosen|chọn, lựa
cleave|clove / cleft / cleaved|cloven / cleft / cleaved|chẻ, tách hai
cling|clung|clung|bám vào, dính vào
clothe|clothed / clad|clothed / clad|che phủ
come|came|come|đến, đi đến
cost|cost|cost|có giá là
creep|crept|crept|bò, trườn, lẻn
crossbreed|crossbred|crossbred|cho lai giống
crow|crew / crowed|crowed|gáy (gà)
cut|cut|cut|cắt, chặt
daydream|daydreamt|daydreamt|mơ mộng
deal|dealt|dealt|giải quyết, giao dịch
dig|dug|dug|đào
disprove|disproved|disproved / disproven|bác bỏ
dive|dove / dived|dived|lặn, lao xuống
do|did|done|làm
draw|drew|drawn|vẽ, kéo
dream|dreamt / dreamed|dreamt / dreamed|mơ thấy
drink|drank|drunk|uống
drive|drove|driven|lái xe
dwell|dwelt|dwelt|trú ngụ, ở
eat|ate|eaten|ăn
fall|fell|fallen|ngã, rơi
feed|fed|fed|cho ăn, nuôi
feel|felt|felt|cảm thấy
fight|fought|fought|chiến đấu
find|found|found|tìm thấy, thấy
fit|fitted / fit|fitted / fit|làm cho vừa
flee|fled|fled|chạy trốn
fling|flung|flung|tung, quăng
fly|flew|flown|bay
forbear|forbore|forborne|nhịn
forbid|forbade|forbidden|cấm, cấm đoán
forecast|forecast|forecast|tiên đoán
forego|forewent|foregone|đi trước; bỏ qua (biến thể của forgo)
foresee|foresaw|foreseen|thấy trước
foretell|foretold|foretold|đoán trước
forget|forgot|forgotten|quên
forgive|forgave|forgiven|tha thứ
forsake|forsook|forsaken|ruồng bỏ
freeze|froze|frozen|(Làm) đông lại
frostbite|frostbit|frostbitten|bỏng lạnh
get|got|got / gotten|có được
gild|gilt / gilded|gilt / gilded|mạ vàng
gird|girt / girded|girt / girded|đeo vào
give|gave|given|cho
go|went|gone|đi
grind|ground|ground|nghiền, xay
grow|grew|grown|mọc, trồng
hand-feed|hand-fed|hand-fed|cho ăn bằng tay
handwrite|handwrote|handwritten|viết tay
hang|hung|hung|móc lên, treo lên
have|had|had|có
hear|heard|heard|nghe
heave|hove / heaved|hove / heaved|trục lên
hew|hewed|hewn / hewed|chặt, đốn
hide|hid|hidden|giấu, trốn, nấp
hit|hit|hit|đụng
hold|held|held|cầm, giữ
hurt|hurt|hurt|làm đau
inbreed|inbred|inbred|lai giống cận huyết
inlay|inlaid|inlaid|cẩn, khảm
input|input|input|đưa vào máy tính
inset|inset|inset|dát, ghép
interbreed|interbred|interbred|giao phối, lai giống
interweave|interwove|interwoven|trộn lẫn, xen lẫn
interwind|interwound|interwound|cuộn vào, quấn vào
keep|kept|kept|giữ, duy trì
kneel|knelt / kneeled|knelt / kneeled|quỳ xuống
knit|knit / knitted|knit / knitted|đan (len,...)
know|knew|known|biết, hiểu biết
lade|laded|laden|chất hàng (lên tàu)
lay|laid|laid|đặt, để, đẻ (trứng)
lead|led|led|dẫn dắt, lãnh đạo
lean|leant / leaned|leant / leaned|dựa, tựa, nghiêng
leap|leapt / leaped|leapt / leaped|nhảy vọt, nhảy xa
learn|learnt / learned|learnt / learned|học, học tập
leave|left|left|rời đi, để lại
lend|lent|lent|cho mượn
let|let|let|để cho, cho phép
lie|lay|lain|nằm nghỉ
light|lit / lighted|lit / lighted|thắp sáng, đốt đèn
lip-read|lip-read|lip-read|đọc khẩu hình miệng
lose|lost|lost|làm mất, thua
make|made|made|chế tạo, làm ra
mean|meant|meant|có nghĩa là
meet|met|met|gặp gỡ
misbecome|misbecame|misbecome|không xứng
miscast|miscast|miscast|giao vai không hợp
mischoose|mischose|mischosen|chọn sai
misdeal|misdealt|misdealt|chia bài sai
misdo|misdid|misdone|làm sai, phạm lỗi
misfeed|misfed|misfed|nạp (dữ liệu) sai
misgive|misgave|misgiven|lo âu, nghi ngờ
mishear|misheard|misheard|nghe nhầm
mishit|mishit|mishit|đánh nhẹ, hụt
miskeep|miskept|miskept|giữ không kỹ
misknow|misknew|misknown|hiểu sai
mislay|mislaid|mislaid|để thất lạc
mislead|misled|misled|làm lạc đường
mislearn|mislearnt|mislearnt|học sai
misread|misread|misread|đọc sai
missay|missaid|missaid|nói sai
misset|misset|misset|đặt sai chỗ
misspeak|misspoke|misspoken|nói nhầm
misspell|misspelt|misspelt|viết sai chính tả
misspend|misspent|misspent|tiêu phí vô ích
mistake|mistook|mistaken|nhầm lẫn
misteach|mistaught|mistaught|dạy sai
mistell|mistold|mistold|kể sai
misthink|misthought|misthought|suy nghĩ sai
misunderstand|misunderstood|misunderstood|hiểu lầm
miswrite|miswrote|miswritten|viết sai
mow|mowed|mown / mowed|cắt cỏ
offset|offset|offset|đền bù, bù đắp
outbid|outbid|outbid|trả giá cao hơn
outbreed|outbred|outbred|giao phối xa
outdo|outdid|outdone|làm tốt hơn
outdraw|outdrew|outdrawn|thu hút hơn
outdrink|outdrank|outdrunk|uống nhiều hơn
outdrive|outdrove|outdriven|lái nhanh hơn
outfight|outfought|outfought|đánh giỏi hơn
outfly|outflew|outflown|bay nhanh/xa hơn
outgrow|outgrew|outgrown|lớn nhanh hơn
outleap|outleapt|outleapt|nhảy cao/xa hơn
outride|outrode|outridden|cưỡi ngựa giỏi hơn
outrun|outran|outrun|chạy nhanh hơn
outsell|outsold|outsold|bán chạy hơn
outshine|outshone|outshone|sáng chói hơn
outshoot|outshot|outshot|bắn giỏi hơn
outsing|outsang|outsung|hát hay hơn
outsit|outsat|outsat|ngồi lâu hơn
outsleep|outslept|outslept|ngủ lâu hơn
outspeak|outspoke|outspoken|nói dài/hay hơn
outspeed|outsped|outsped|đi nhanh hơn
outspend|outspent|outspent|tiêu nhiều hơn
outspin|outspun|outspun|quay nhanh hơn
outspring|outsprang|outsprung|nhảy nhanh hơn
outstand|outstood|outstood|nổi bật
outswim|outswam|outswum|bơi nhanh hơn
outthink|outthought|outthought|suy nghĩ nhanh hơn
outthrow|outthrew|outthrown|ném xa hơn
outwear|outwore|outworn|bền hơn
outwind|outwound|outwound|chạy nhanh hơn
outwrite|outwrote|outwritten|viết nhanh hơn
overbear|overbore|overborne|khuất phục
overbid|overbid|overbid|bỏ giá quá cao
overblow|overblew|overblown|thổi quá mạnh
overbreed|overbred|overbred|nhân giống quá mức
overbuild|overbuilt|overbuilt|xây quá nhiều
overbuy|overbought|overbought|mua quá nhiều
overcast|overcast|overcast|làm u ám
overcome|overcame|overcome|khắc phục, vượt qua
overcut|overcut|overcut|cắt quá nhiều
overdo|overdid|overdone|làm quá mức
overdraw|overdrew|overdrawn|rút quá số tiền
overdrink|overdrank|overdrunk|uống quá nhiều
overdrive|overdrove|overdriven|lái quá nhanh
overeat|overate|overeaten|ăn quá nhiều
overfeed|overfed|overfed|cho ăn quá mức
overfly|overflew|overflown|bay qua
overgrow|overgrew|overgrown|mọc quá mức
overhang|overhung|overhung|nhô ra trên
overhear|overheard|overheard|nghe trộm
overlay|overlaid|overlaid|phủ lên
overleap|overleapt|overleapt|nhảy qua
overlie|overlay|overlain|nằm lên trên
overpay|overpaid|overpaid|trả quá tiền
override|overrode|overridden|đè lên, gạt ra
overrun|overran|overrun|tràn ngập, vượt quá
oversee|oversaw|overseen|giám sát
oversell|oversold|oversold|bán quá mức
overset|overset|overset|đảo lộn, lật đổ
overshoot|overshot|overshot|đi quá đích
oversleep|overslept|overslept|ngủ quên
overspend|overspent|overspent|tiêu xài quá độ
overspread|overspread|overspread|lan phủ khắp
overtake|overtook|overtaken|đuổi kịp, vượt qua
overthrow|overthrew|overthrown|lật đổ
overwind|overwound|overwound|lên dây quá chặt
overwrite|overwrote|overwritten|ghi đè lên
partake|partook|partaken|tham gia, dự phần
pay|paid|paid|trả tiền
plead|pled / pleaded|pled / pleaded|bào chữa, van xin
prechoose|prechose|prechosen|chọn trước
precut|precut|precut|cắt trước
preknow|preknew|preknown|biết trước
premake|premade|premade|làm trước
prepay|prepaid|prepaid|trả trước
preread|preread|preread|đọc trước
presell|presold|presold|bán trước
preset|preset|preset|thiết lập trước
preshrink|preshrank|preshrunk|co trước
proofread|proofread|proofread|đọc soát lỗi
prove|proved|proven / proved|chứng minh
put|put|put|đặt, để
quick-freeze|quick-froze|quick-frozen|kết đông nhanh
quit|quit|quit|từ bỏ
read|read|read|đọc
rebind|rebound|rebound|đóng tập lại
rebuild|rebuilt|rebuilt|xây dựng lại
recast|recast|recast|đúc lại
redo|redid|redone|làm lại
redraw|redrew|redrawn|vẽ lại
refeed|refed|refed|cho ăn lại
regrind|reground|reground|nghiền lại
regrow|regrew|regrown|mọc lại
rehang|rehung|rehung|treo lại
rehear|reheard|reheard|nghe lại
relay|relaid|relaid|đặt lại
relearn|relearnt|relearnt|học lại
relight|relit|relit|thắp sáng lại
remake|remade|remade|làm lại
rend|rent|rent|xé nát
repay|repaid|repaid|hoàn tiền, trả lại
reread|reread|reread|đọc lại
rerun|reran|rerun|chạy lại
resell|resold|resold|bán lại
reset|reset|reset|thiết lập lại
resit|resat|resat|thi lại
retake|retook|retaken|lấy lại, thi lại
reteach|retaught|retaught|dạy lại
retell|retold|retold|kể lại
rethink|rethought|rethought|suy nghĩ lại
rewin|rewon|rewon|thắng lại
rewind|rewound|rewound|tua lại, lên dây lại
rewrite|rewrote|rewritten|viết lại
rid|rid|rid|giải thoát, tống khứ
ride|rode|ridden|cưỡi, đi xe
ring|rang|rung|rung chuông, reo
rise|rose|risen|mọc lên, đứng dậy
run|ran|run|chạy
saw|sawed|sawn / sawed|cưa
say|said|said|nói
see|saw|seen|nhìn, thấy
seek|sought|sought|tìm kiếm
sell|sold|sold|bán
send|sent|sent|gửi
set|set|set|để, đặt, thiết lập
sew|sewed|sewn / sewed|may, khâu
shake|shook|shaken|rung, lắc
shear|sheared|shorn / sheared|xén lông cừu
shed|shed|shed|rơi, rụng, bỏ
shine|shone / shined|shone / shined|chiếu sáng
shoot|shot|shot|bắn, quay phim
show|showed|shown / showed|cho xem, trình bày
shrink|shrank|shrunk|co lại, rút lại
shut|shut|shut|đóng lại
sing|sang|sung|hát
sink|sank|sunk|chìm, đắm
sit|sat|sat|ngồi
slay|slew|slain|sát hại, giết
sleep|slept|slept|ngủ
slide|slid|slid|trượt
sling|slung|slung|ném mạnh, treo
slink|slunk|slunk|lẻn đi
slit|slit|slit|rạch, khía
smell|smelt / smelled|smelt / smelled|ngửi thấy
sow|sowed|sown / sowed|gieo hạt
speak|spoke|spoken|nói
speed|sped / speeded|sped / speeded|chạy nhanh
spell|spelt / spelled|spelt / spelled|đánh vần
spend|spent|spent|tiêu xài, dành
spill|spilt / spilled|spilt / spilled|tràn ra, làm đổ
spin|spun|spun|quay, xoay
spit|spat / spit|spat / spit|khạc nhổ
split|split|split|chia cắt, chẻ
spoil|spoilt / spoiled|spoilt / spoiled|làm hỏng, chiều hư
spread|spread|spread|lan truyền, trải ra
spring|sprang|sprung|nhảy, nảy bật
stand|stood|stood|đứng
steal|stole|stolen|ăn cắp, lấy trộm
stick|stuck|stuck|dán, dính, đâm
sting|stung|stung|châm, chích, đốt
stink|stank / stunk|stunk|bốc mùi hôi
stride|strode|stridden|bước dài
strike|struck|struck / stricken|đánh, bãi công
string|strung|strung|thắt dây, lên dây
strive|strove|striven|phấn đấu, cố gắng
sublet|sublet|sublet|cho thuê lại
sunburn|sunburnt / sunburned|sunburnt / sunburned|cháy nắng
swear|swore|sworn|thề, chửi thề
sweat|sweat / sweated|sweat / sweated|đổ mồ hôi
sweep|swept|swept|quét
swell|swelled|swollen / swelled|sưng lên
swim|swam|swum|bơi
swing|swung|swung|đu đưa, xoay
take|took|taken|cầm, nắm, lấy
teach|taught|taught|dạy, giảng dạy
tear|tore|torn|xé, làm rách
tell|told|told|kể, bảo
think|thought|thought|suy nghĩ
throw|threw|thrown|ném, quăng
thrust|thrust|thrust|đẩy mạnh, tống
tread|trod|trodden / trod|giẫm lên, bước đi
unbend|unbent|unbent|làm thẳng lại
unbind|unbound|unbound|mở, tháo dây
undergo|underwent|undergone|trải qua
underlay|underlaid|underlaid|đặt dưới
underlie|underlay|underlain|nằm dưới, cơ sở
underpay|underpaid|underpaid|trả lương thấp
understand|understood|understood|hiểu
undertake|undertook|undertaken|đảm nhận
underwrite|underwrote|underwritten|bảo lãnh, bảo hiểm
undo|undid|undone|huỷ bỏ, tháo ra
unfreeze|unfroze|unfrozen|rã đông
unlearn|unlearnt / unlearned|unlearnt / unlearned|quên, bỏ thói quen
unmake|unmade|unmade|hủy bỏ, làm lại
unsay|unsaid|unsaid|rút lời
unstick|unstuck|unstuck|gỡ ra, bóc ra
unwind|unwound|unwound|tháo dây, thư giãn
uphold|upheld|upheld|ủng hộ, duy trì
upset|upset|upset|làm lo lắng, lật đổ
wake|woke / waked|woken / waked|thức giấc
waylay|waylaid|waylaid|mai phục, rình rập
wear|wore|worn|mặc, mang, đeo
weave|wove / weaved|woven / weaved|dệt, đan
wed|wed / wedded|wed / wedded|kết hôn
weep|wept|wept|khóc
wet|wet / wetted|wet / wetted|làm ướt
win|won|won|chiến thắng
wind|wound|wound|cuộn, lên dây
withdraw|withdrew|withdrawn|rút tiền, lui quân
withhold|withheld|withheld|giữ lại, từ chối
withstand|withstood|withstood|chống lại, chịu đựng
wring|wrung|wrung|vắt, bóp nghẹt
write|wrote|written|viết`

export const irregularVerbs: IrregularVerb[] = rows.split('\n').map(row => {
 const [base, past, participle, meaning] = row.split('|')
 return { base, past, participle, meaning }
})
export function verbPattern(verb: IrregularVerb) {
 if (verb.base === verb.past && verb.past === verb.participle) return 'same'
 if (verb.past === verb.participle) return 'past-same'
 if (verb.base === verb.participle) return 'base-same'
 return 'different'
}
export function normalizeVerbSearch(value: string) {
 return value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim()
}

export const irregularVerbId = (verb: IrregularVerb) => 'irregular:' + verb.base
export const irregularVerbForms = (verb: IrregularVerb) => [...new Set([verb.base, ...verb.past.split(' / '), ...verb.participle.split(' / ')])]
const irregularForms = new Set(irregularVerbs.flatMap(irregularVerbForms))
export const isIrregularVerbForm = (word: string) => irregularForms.has(word.trim().toLowerCase())
const verbsById = new Map(irregularVerbs.map(verb => [irregularVerbId(verb), verb]))
export const findIrregularVerb = (id: string) => verbsById.get(id)
export function searchIrregularVerbs(query: string) {
 const term = normalizeVerbSearch(query)
 if (!term) return []
 const rank = (verb: IrregularVerb) => irregularVerbForms(verb).some(form => form === term) ? 0 : verb.base.startsWith(term) ? 1 : 2
 return irregularVerbs.filter(verb => normalizeVerbSearch([verb.base, verb.past, verb.participle, verb.meaning].join(' ')).includes(term)).sort((a,b) => rank(a)-rank(b) || a.base.localeCompare(b.base))
}
