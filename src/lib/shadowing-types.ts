import type { ReadingArticle } from './reading-types'
﻿export interface ShadowingFolder { id:string;ownerId:string;name:string;nameKey:string;createdAt:string;metadataSynced?:boolean }
export interface ShadowingLesson { id:string;ownerId:string;folderId:string;title:string;referenceText:string;detection?:ReadingArticle['detection'];createdAt:string;updatedAt:string;metadataSynced?:boolean }
