export interface ReadingFolder { id:string;ownerId:string;name:string;createdAt:string;updatedAt:string;deletedAt?:string;metadataSynced?:boolean }
export interface ReadingMatch { start:number;end:number;noteId:string;word:string;context?:string }
export interface ReadingArticle { id:string;ownerId:string;folderId:string;title:string;contentHtml:string;note:string;createdAt:string;updatedAt:string;deletedAt?:string;metadataSynced?:boolean;detection?:{html:string;matches:ReadingMatch[];createdAt:string} }
export type StudyNoteType='grammar'|'sentence_structure'|'expression'|'other'
export const studyNoteLabels:Record<StudyNoteType,string>={grammar:'Ngữ pháp',sentence_structure:'Cấu trúc câu',expression:'Cách diễn đạt',other:'Khác'}
export interface ReadingStudyNote { id:string;ownerId:string;articleId:string;type:StudyNoteType;title:string;content:string;sourceQuote:string;createdAt:string;updatedAt:string;deletedAt?:string;metadataSynced?:boolean }
