import { z } from 'zod'
const date = z.string().refine(value => !Number.isNaN(Date.parse(value)), 'Invalid date')
const field = z.object({ id: z.string(), name: z.string(), required: z.boolean() })
const template = z.object({ id: z.string(), name: z.string(), fields: z.array(field), frontTemplate: z.string(), backTemplate: z.string(), format: z.enum(['text','html']).optional(), css: z.string().optional(), align: z.enum(['left','center','right']), fontSize: z.number().min(1).max(100), color: z.string(), speech: z.object({ fieldId: z.string(), lang: z.string(), rate: z.number().positive() }).optional() })
const card = z.object({ due: date, stability: z.number(), difficulty: z.number(), elapsed_days: z.number(), scheduled_days: z.number(), learning_steps: z.number(), reps: z.number(), lapses: z.number(), state: z.number().int().min(0).max(3), last_review: date.optional() })
export const snapshotSchema = z.object({
  version: z.literal(1), createdAt: date,
  folders: z.array(z.object({ id:z.string(), name:z.string(), nameKey:z.string(), createdAt:z.number(), parentId:z.string().optional(), reverseCards:z.boolean().optional() })),
  templates: z.array(template),
  notes: z.array(z.object({ id:z.string(), kind:z.enum(['basic','reverse','cloze','custom','ai']), front:z.string(), back:z.string(), extra:z.string(), tags:z.string(), folderId:z.string().optional(), createdAt:z.number(), values:z.record(z.string(),z.string()).optional(), template:template.optional() })),
  reviews: z.array(card.extend({id:z.string(),noteId:z.string(),lastRating:z.number().int().min(1).max(4),revision:z.number().int().min(1)})),
  reviewLogs: z.array(z.object({ id:z.string(),cardId:z.string(),noteId:z.string(),log:z.object({due:date,review:date,rating:z.number(),state:z.number(),stability:z.number(),difficulty:z.number(),elapsed_days:z.number(),last_elapsed_days:z.number(),scheduled_days:z.number(),learning_steps:z.number()}) })),
  preferences: z.object({reminderEnabled:z.boolean(),reminderMinutes:z.number().int().min(1).max(120),autoVoice:z.boolean()}),
})
export type Snapshot = z.infer<typeof snapshotSchema>
export function parseSnapshot(payload: unknown): Snapshot {
  const parsed = snapshotSchema.parse(payload)
  for(const rows of [parsed.folders,parsed.templates,parsed.notes,parsed.reviews,parsed.reviewLogs]) if(new Set(rows.map(row=>row.id)).size!==rows.length) throw new Error('Dữ liệu cloud có ID trùng.')
  return parsed
}
export function canUpload(owner: string | undefined, userId: string, localRevision: number, remoteRevision: number) {
  return (!owner || owner === userId) && localRevision === remoteRevision
}
