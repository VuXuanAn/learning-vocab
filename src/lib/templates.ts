export interface CardField { id: string; name: string; required: boolean }
export interface CardTemplate {
  id: string
  name: string
  fields: CardField[]
  frontTemplate: string
  backTemplate: string
  format?: 'text' | 'html'
  css?: string
  speech?: { fieldId: string; lang: string; rate: number }
  align: 'left' | 'center' | 'right'
  fontSize: number
  color: string
}
export function renderTemplate(template: string, values: Record<string, string>, frontSide = '') {
  return template.replace(/\{\{([^{}]+)\}\}/g, (_, key: string) => key.trim() === 'FrontSide' ? frontSide : values[key.trim()] ?? '').trim()
}
export function validateTemplate(template: CardTemplate): string | null {
  if (!template.name.trim()) return 'Hãy đặt tên kiểu thẻ.'
  const names = template.fields.map(field => field.name.trim())
  if (!names.length || names.some(name => !name || /[{}\n]/.test(name) || name === 'FrontSide')) return 'Tên trường không được trống, chứa dấu ngoặc nhọn, xuống dòng hoặc là FrontSide.'
  if (new Set(names).size !== names.length) return 'Tên các trường không được trùng nhau.'
  for (const [side, content] of [['Mặt trước', template.frontTemplate], ['Mặt sau', template.backTemplate]]) {
    if (!content.trim()) return `${side} chưa có bố cục.`
    for (const match of content.matchAll(/\{\{([^{}]+)\}\}/g)) {
      if (!names.includes(match[1].trim()) && !(side === 'Mặt sau' && match[1].trim() === 'FrontSide')) return `${side}: trường ${match[1]} không tồn tại.`
    }
    if ((template.format === 'html' ? /\{\{|\}\}/ : /[{}]/).test(content.replace(/\{\{([^{}]+)\}\}/g, ''))) return `${side}: cú pháp trường chưa đúng.`
  }
  if (!names.some(name => template.frontTemplate.includes(`{{${name}}}`))) return 'Mặt trước cần chứa ít nhất một trường.'
  if (!Number.isFinite(template.fontSize) || template.fontSize < 14 || template.fontSize > 48) return 'Cỡ chữ phải từ 14 đến 48.'
  if (template.speech && !template.fields.some(field => field.id === template.speech?.fieldId)) return 'Trường phát âm không tồn tại.'
  if (template.speech && (!Number.isFinite(template.speech.rate) || template.speech.rate < 0.5 || template.speech.rate > 1.5)) return 'Tốc độ đọc phải từ 0.5 đến 1.5.'
  return null
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}
export function renderCardTemplate(template: CardTemplate, side: 'frontTemplate' | 'backTemplate', values: Record<string, string>, frontSide?: string) {
  const safeValues = template.format === 'html' ? Object.fromEntries(Object.entries(values).map(([key, value]) => [key, escapeHtml(value).replace(/\r?\n/g, '<br>')])) : values
  const front = renderTemplate(template.frontTemplate, safeValues)
  return side === 'frontTemplate' ? front : renderTemplate(template.backTemplate, safeValues, frontSide ?? front)
}
export function cardDocument(template: CardTemplate, content: string) {
  const color = /^#[0-9a-f]{6}$/i.test(template.color) ? template.color : '#166534'
  const align = ['left', 'center', 'right'].includes(template.align) ? template.align : 'center'
  const size = Number.isFinite(template.fontSize) ? Math.min(48, Math.max(14, template.fontSize)) : 28
  const css = (template.css ?? '').replace(/</g, '\\3c ')
  return '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src https: data:; media-src https: data:; base-uri \'none\'; form-action \'none\'"><style>*{box-sizing:border-box}body{margin:0;padding:24px;font-family:system-ui,sans-serif;overflow-wrap:anywhere}.card{font-size:' + size + 'px;text-align:' + align + ';color:' + color + ';line-height:1.6}img{max-width:100%;height:auto}' + css + '</style></head><body><div class="card">' + content + '</div></body></html>'
}

