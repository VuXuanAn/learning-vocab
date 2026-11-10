import type { Snapshot } from './cloud-schema'
export interface CloudMeta { id: string; userId: string; revision: number; lastSyncAt: string }
export interface LocalBackup { id: string; payload: Snapshot; createdAt: string; owner?: CloudMeta }
