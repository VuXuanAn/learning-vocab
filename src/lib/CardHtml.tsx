import { cardDocument, type CardTemplate } from './templates'
export default function CardHtml({ template, content, title }: { template: CardTemplate; content: string; title: string }) {
  return <iframe title={title} sandbox="" referrerPolicy="no-referrer" srcDoc={cardDocument(template, content)} className="h-80 w-full rounded-xl border-0 bg-white" />
}
