import { Navigate, useSearchParams } from 'react-router-dom'
export default function AddVocabularyRedirect() {
 const [params] = useSearchParams()
 return <Navigate to={'/?add=1&addFolder=' + encodeURIComponent(params.get('folder') ?? '')} replace />
}
